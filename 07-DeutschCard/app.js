// ── Storage ──────────────────────────────────────────────────────────────────
// The deck is never stored or sent whole. Every change is an op (see ops.js)
// appended to a log in IndexedDB and replayed into `words`. The ops this device
// created wait in an outbox until the vault (serve.py) has accepted them; ops
// from elsewhere (deck.py fail, another device) arrive by pulling after a cursor.
// Because ops only accumulate, a device that was offline for a week merges its
// changes without overwriting anyone else's.
//
// The server is whatever served this page: serve.py on the Mac (no auth) or the
// Cloudflare relay in cloud/ (needs a device token, delivered once by a setup
// link of the form  https://…/#token=…&device=phone  — see `deck.py device add`).
const API = '/api/ops';
const LEGACY_KEY = 'deutschcard_words';   // pre-op-log localStorage deck
const PUSH_CHUNK = 200;

let db = null;              // IndexedDB handle; null = memory only (still works)
let device = 'web';
let token = null;           // Cloudflare relay device token; serve.py needs none
let cursor = 0;             // ops already pulled from the server
let opLog = [];             // every op this device knows, any order
let knownOpIds = new Set();
let outbox = new Set();     // ids of our ops the server has not accepted yet
let opState = newState();
let lastOp = null;          // the latest op by (at, id) — enables incremental apply
let syncing = false;
let syncAgain = false;      // a change arrived mid-sync; run once more after it
let syncTimer = null;
let serverReachable = false;
let needsSetup = false;     // the relay refused our token (or we have none)

function idbRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Fire-and-forget write; the in-memory log is already updated, so a failed
// write only costs durability, never the current session.
function idbWrite(store, fn) {
  if (!db) return;
  try {
    const tx = db.transaction(store, 'readwrite');
    fn(tx.objectStore(store));
    tx.onerror = () => console.error('IndexedDB write failed', tx.error);
  } catch (e) { console.error('IndexedDB write failed', e); }
}

async function openStore() {
  try {
    const req = indexedDB.open('deutschcard', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('ops', { keyPath: 'id' });
      req.result.createObjectStore('outbox', { keyPath: 'id' });
      req.result.createObjectStore('meta');
    };
    db = await idbRequest(req);
    const tx = db.transaction(['ops', 'outbox', 'meta'], 'readonly');
    const [ops, out, dev, cur, tok] = await Promise.all([
      idbRequest(tx.objectStore('ops').getAll()),
      idbRequest(tx.objectStore('outbox').getAll()),
      idbRequest(tx.objectStore('meta').get('device')),
      idbRequest(tx.objectStore('meta').get('cursor')),
      idbRequest(tx.objectStore('meta').get('token')),
    ]);
    opLog = ops;
    outbox = new Set(out.map(x => x.id));
    cursor = cur || 0;
    token = tok || null;
    device = dev || 'web-' + Math.random().toString(36).slice(2, 8);
    if (!dev) idbWrite('meta', s => s.put(device, 'device'));
  } catch (e) {
    console.error('IndexedDB unavailable, changes last only this session', e);
    db = null;
  }
  readSetupLink();
  knownOpIds = new Set(opLog.map(o => o.id));
  rebuild();
}

// A setup link carries the token in the fragment, which browsers never send to
// the server. Store it, then strip it from the address bar and history.
function readSetupLink() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.get('token')) return false;
  token = params.get('token');
  idbWrite('meta', s => s.put(token, 'token'));
  if (params.get('device')) {
    device = params.get('device');
    idbWrite('meta', s => s.put(device, 'device'));
  }
  history.replaceState(null, '', location.pathname + location.search);
  return true;
}

function apiHeaders(extra = {}) {
  return token ? { ...extra, Authorization: 'Bearer ' + token } : extra;
}

function rebuild() {
  opState = replay(opLog);
  lastOp = opLog.filter(validOp).sort(compareOps).pop() || null;
  words = deckOf(opState);
  // the study queue holds card objects; point it at the freshly built ones
  studyQueue = studyQueue.map(w => opState.cards.get(w.id)).filter(Boolean);
}

function todayLocal() {
  return new Date().toLocaleDateString('sv');   // YYYY-MM-DD in local time, like deck.py
}

function newOpId() {
  return (crypto.randomUUID ? crypto.randomUUID() : generateId() + generateId()).replace(/-/g, '');
}

// The one way to change the deck. Never mutate `words` directly: the change
// would vanish on the next replay and never reach the vault.
function emit(op, card, payload = {}) {
  const o = { id: newOpId(), at: new Date().toISOString(), device, op, card, ...payload };
  opLog.push(o);
  knownOpIds.add(o.id);
  outbox.add(o.id);
  if (!lastOp || compareOps(lastOp, o) < 0) {
    applyOp(opState, o);          // the usual case: the new op is the newest
    lastOp = o;
    words = deckOf(opState);
  } else {
    rebuild();                    // clock went backwards — replay from scratch
  }
  idbWrite('ops', s => s.put(o));
  idbWrite('outbox', s => s.put({ id: o.id }));
  scheduleSync(400);              // coalesce a run of card marks into one push
  updateSyncBadge();
}

function receive(ops) {
  const fresh = ops.filter(o => validOp(o) && !knownOpIds.has(o.id));
  if (!fresh.length) return 0;
  fresh.forEach(o => { opLog.push(o); knownOpIds.add(o.id); });
  idbWrite('ops', s => fresh.forEach(o => s.put(o)));
  rebuild();
  return fresh.length;
}

function scheduleSync(delay) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(sync, delay);
}

async function sync() {
  if (location.protocol === 'file:') return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  updateSyncBadge();
  let changed = 0, error = null;
  try {
    // push: our pending ops, in chunks so a long-offline device is not one huge body
    const pending = opLog.filter(o => outbox.has(o.id));
    for (let i = 0; i < pending.length; i += PUSH_CHUNK) {
      const chunk = pending.slice(i, i + PUSH_CHUNK);
      const res = await fetch(API, {
        method: 'POST',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ops: chunk }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw httpError(res, out);
      chunk.forEach(o => outbox.delete(o.id));
      idbWrite('outbox', s => chunk.forEach(o => s.delete(o.id)));
    }
    // pull: everything after our cursor, including what we just pushed; a fresh
    // device on a long log takes several pages
    let more = true;
    while (more) {
      const res = await fetch(`${API}?since=${cursor}`, { cache: 'no-store', headers: apiHeaders() });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw httpError(res, out);
      changed += receive(out.ops || []);
      cursor = out.seq;
      more = !!out.more;
      idbWrite('meta', s => s.put(cursor, 'cursor'));
    }
    serverReachable = true;
    needsSetup = false;
  } catch (e) {
    serverReachable = false;
    error = e instanceof TypeError ? null : e.message;   // TypeError = no server at all
    needsSetup = e.status === 401;
  } finally {
    syncing = false;
  }
  updateSyncBadge(error);
  updateSetupBanner();
  if (changed) refreshViews();
  if (syncAgain && serverReachable) { syncAgain = false; sync(); }
}

function httpError(res, out) {
  const e = new Error(out.error || 'HTTP ' + res.status);
  e.status = res.status;
  return e;
}

// The relay answered 401: this browser has no token (never opened a setup link)
// or its device was revoked. Say so plainly instead of showing an empty deck.
function updateSetupBanner() {
  const el = document.getElementById('setup-banner');
  if (!el) return;
  el.classList.toggle('hidden', !needsSetup);
  const n = outbox.size;
  document.getElementById('setup-pending').textContent = n
    ? ` ${n} Änderung(en) von diesem Gerät warten und werden danach gesendet.` : '';
}

function updateSyncBadge(error) {
  const el = document.getElementById('sync-badge');
  if (!el) return;
  const n = outbox.size;
  let state, label, detail;
  if (error) {
    [state, label, detail] = ['error', 'Fehler', 'Server meldet: ' + error];
  } else if (syncing) {
    [state, label, detail] = ['saving', 'Vault', 'synchronisiere …'];
  } else if (serverReachable && !n) {
    [state, label, detail] = ['live', 'Vault', words.length + ' Karten · synchron mit dem Vault'];
  } else if (n) {
    [state, label, detail] = ['pending', n + ' offen',
      n + ' Änderung(en) warten — werden gesendet, sobald der Server erreichbar ist'];
  } else {
    [state, label, detail] = ['offline', 'Offline', 'Server nicht erreichbar'];
  }
  el.className = 'sync-badge ' + state;
  el.textContent = label;
  el.title = detail;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── State ────────────────────────────────────────────────────────────────────
let words = [];
let studyQueue = [];
let studyIndex = 0;
let sessionKnown = 0;
let sessionLearning = 0;
let isFlipped = false;
let activeFilters = { tag: 'all', level: 'all' };

// ── First run ────────────────────────────────────────────────────────────────
// An empty log after the first sync means this browser has never seen the deck.
// Served by serve.py, the vault seeds itself, so an empty log here just means the
// server is down. Only a plain file:// copy seeds locally — seeding over http
// would mint a second set of seed cards that merge into the vault as duplicates.
async function firstRun() {
  let legacy = [];
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_KEY)) || [];
    if (db) localStorage.removeItem(LEGACY_KEY);   // without IndexedDB it is still the only copy
  } catch {}
  if (opLog.length) return;
  if (legacy.length) {
    // the old browser cache: same card ids as the vault, so adds of cards the
    // vault already has are no-ops when they meet
    legacy.forEach(w => w && w.id && w.german && emit('add', w.id, { data: w }));
  } else if (location.protocol === 'file:') {
    try {
      const seed = await (await fetch('data/seed.json')).json();
      seed.forEach(w => emit('add', generateId(), { data: w }));
    } catch (e) {
      console.error('Seed load failed', e);
    }
  }
  renderAll();
}

// ── Navigation ───────────────────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const view = document.getElementById('view-' + name);
  if (view) view.classList.add('active');

  document.querySelectorAll('[data-view="' + name + '"]').forEach(b => {
    if (b.classList.contains('nav-btn')) b.classList.add('active');
  });

  if (name === 'study') initStudy();
  if (name === 'stats') renderStats();
  if (name === 'manage') renderManage();
  if (name === 'home') renderHome();
}

// ── Home ─────────────────────────────────────────────────────────────────────
function renderHome() {
  const filtered = getFilteredWords();
  document.getElementById('stat-total').textContent = filtered.length;
  document.getElementById('stat-known').textContent = filtered.filter(w => w.known).length;
  document.getElementById('stat-learning').textContent = filtered.filter(w => !w.known).length;
  populateTagFilter('home-tag-filter');
}

function getFilteredWords() {
  return words.filter(w => {
    const tagOk = activeFilters.tag === 'all' || w.tags.includes(activeFilters.tag);
    const levelOk = activeFilters.level === 'all' || w.tags.includes(activeFilters.level);
    return tagOk && levelOk;
  });
}

function getAllTags() {
  const tagSet = new Set();
  words.forEach(w => w.tags.forEach(t => tagSet.add(t)));
  return [...tagSet].sort();
}

function populateTagFilter(selectId) {
  const sel = document.getElementById(selectId);
  const current = sel.value;
  const levels = new Set(['A1', 'A2', 'B1', 'B2']);
  const contentTags = getAllTags().filter(t => !levels.has(t));
  sel.innerHTML = '<option value="all">All</option>';
  contentTags.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  });
  sel.value = current && [...sel.options].some(o => o.value === current) ? current : 'all';
}

// ── Study ────────────────────────────────────────────────────────────────────
function initStudy() {
  document.getElementById('session-summary').classList.add('hidden');
  document.getElementById('flashcard').classList.remove('hidden');
  document.getElementById('study-actions').style.visibility = 'hidden';

  // Priority, not deck order: real mistakes from lessons first, then hard cards,
  // then unknown, then least recently seen. deck.py fail() feeds this.
  studyQueue = [...getFilteredWords()].sort((a, b) =>
    (b.mistakes || 0) - (a.mistakes || 0) ||
    (b.difficulty || 0) - (a.difficulty || 0) ||
    (a.known ? 1 : 0) - (b.known ? 1 : 0) ||
    String(a.lastSeen || '').localeCompare(String(b.lastSeen || ''))
  );
  if (studyQueue.length === 0) {
    showCard({ german: 'No cards', english: 'Add some words first!', gender: '', tags: [], example: '' });
    return;
  }
  studyIndex = 0;
  sessionKnown = 0;
  sessionLearning = 0;
  isFlipped = false;
  document.getElementById('flashcard').classList.remove('flipped');
  updateProgress();
  showCard(studyQueue[studyIndex]);
}

function showCard(word) {
  document.getElementById('card-word').textContent = word.german;
  document.getElementById('card-translation').textContent = word.english;
  document.getElementById('card-plural').textContent = word.plural ? `Plural: ${word.plural}` : '';

  // Verb forms and fixed prepositions — the vault requires them on every verb.
  document.getElementById('card-forms').textContent =
    [word.forms, word.prep].filter(Boolean).join('  ·  ');

  // Flag cards I have actually got wrong in a lesson, and say how.
  const flag = document.getElementById('card-mistake');
  const n = word.mistakes || 0;
  if (n > 0) {
    const kinds = (word.mistakeKinds || []).join(', ');
    flag.textContent = `${n} ${n === 1 ? 'Fehler' : 'Fehler'} im Unterricht` +
                       (kinds ? ': ' + kinds : '');
    flag.classList.remove('hidden');
  } else {
    flag.textContent = '';
    flag.classList.add('hidden');
  }
  document.getElementById('card-example').textContent = word.example || '';
  document.getElementById('btn-speak').classList.toggle('hidden', !canSpeak || !word.id);

  const genderEl = document.getElementById('card-gender');
  if (word.gender) {
    genderEl.textContent = word.gender;
    genderEl.className = 'card-gender ' + word.gender;
  } else {
    genderEl.textContent = '';
    genderEl.className = 'card-gender none';
  }

  const tagEl = document.getElementById('card-tag');
  tagEl.textContent = (word.tags || []).join(', ');

  isFlipped = false;
  document.getElementById('flashcard').classList.remove('flipped');
  document.getElementById('study-actions').style.visibility = 'hidden';
}

function flipCard() {
  if (!studyQueue.length || studyIndex >= studyQueue.length) return;
  isFlipped = !isFlipped;
  document.getElementById('flashcard').classList.toggle('flipped', isFlipped);
  if (isFlipped) {
    document.getElementById('study-actions').style.visibility = 'visible';
  }
}

// ── Swipe & speech (phone) ───────────────────────────────────────────────────
// On a flipped card, drag right = Known, left = Still Learning, the same as the
// buttons. On the front a drag does nothing and a tap still flips. Mouse input is
// ignored: on a desktop the buttons are the interface.
const SWIPE_COMMIT = 90;    // px of horizontal travel that counts as an answer
let swipe = null;           // { x, y, dx, active } while a finger is down
let suppressClick = false;  // the click a browser fires after a drag is not a tap

function initSwipe() {
  const card = document.getElementById('flashcard');
  const clear = () => {
    card.style.transform = '';
    card.classList.remove('swipe-known', 'swipe-learning');
    swipe = null;
  };
  card.addEventListener('pointerdown', e => {
    suppressClick = false;
    if (e.pointerType === 'mouse' || e.target.closest('.card-speak')) return;
    swipe = { x: e.clientX, y: e.clientY, dx: 0, active: false };
  });
  card.addEventListener('pointermove', e => {
    if (!swipe) return;
    swipe.dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    if (!swipe.active) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(swipe.dx)) { swipe = null; return; }  // a scroll
      if (Math.abs(swipe.dx) < 12) return;
      swipe.active = true;
      card.classList.remove('settle');
      try { card.setPointerCapture(e.pointerId); } catch {}
    }
    if (!isFlipped) return;
    card.style.transform = `translateX(${swipe.dx}px) rotate(${swipe.dx / 25}deg)`;
    card.classList.toggle('swipe-known', swipe.dx > SWIPE_COMMIT);
    card.classList.toggle('swipe-learning', swipe.dx < -SWIPE_COMMIT);
  });
  card.addEventListener('pointerup', () => {
    if (!swipe) return;
    const { active, dx } = swipe;
    if (active) suppressClick = true;
    card.classList.add('settle');
    if (active && isFlipped && Math.abs(dx) > SWIPE_COMMIT) {
      card.style.transform = `translateX(${dx > 0 ? '' : '-'}110vw) rotate(${dx > 0 ? 12 : -12}deg)`;
      swipe = null;
      setTimeout(() => {                    // after the fly-out, answer and come back
        card.classList.remove('settle');
        clear();
        markCard(dx > 0);
      }, 200);
      return;
    }
    clear();                                // not far enough: spring back
  });
  card.addEventListener('pointercancel', () => { card.classList.add('settle'); clear(); });
  card.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    flipCard();
  });
}

const canSpeak = 'speechSynthesis' in window;

// The phone's own German voice (Android ships de-DE). Article included: the
// gender is the part worth hearing.
function speakCard(e) {
  e.stopPropagation();                      // not a tap on the card
  const w = studyQueue[studyIndex];
  if (!w || !canSpeak) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance([w.gender, w.german].filter(Boolean).join(' '));
  u.lang = 'de-DE';
  u.rate = 0.9;
  const voice = speechSynthesis.getVoices().find(v => /^de[-_]/i.test(v.lang));
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}

function markCard(known) {
  if (studyIndex >= studyQueue.length) return;
  const word = studyQueue[studyIndex];
  if (known) sessionKnown++;
  else sessionLearning++;
  // difficulty and lastSeen follow from the op — see applyOp() in ops.js
  emit('review', word.id, { known, date: todayLocal() });

  studyIndex++;
  updateProgress();

  if (studyIndex >= studyQueue.length) {
    showSummary();
    return;
  }
  showCard(studyQueue[studyIndex]);
}

function updateProgress() {
  const total = studyQueue.length;
  const done = studyIndex;
  document.getElementById('progress-text').textContent = `Card ${done} of ${total}`;
  document.getElementById('progress-bar').style.width = total ? (done / total * 100) + '%' : '0%';
}

function showSummary() {
  document.getElementById('flashcard').classList.add('hidden');
  document.getElementById('study-actions').style.visibility = 'hidden';
  document.getElementById('session-summary').classList.remove('hidden');
  document.getElementById('summary-text').textContent =
    `You reviewed ${studyQueue.length} cards — ✓ Known: ${sessionKnown}  ✗ Still Learning: ${sessionLearning}`;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Manage ───────────────────────────────────────────────────────────────────
let manageFilter = { search: '', tag: 'all' };

function renderManage() {
  populateTagFilter('manage-tag-filter');
  renderWordList();
}

function renderWordList() {
  const list = document.getElementById('card-list');
  const search = manageFilter.search.toLowerCase();
  const tag = manageFilter.tag;

  const filtered = words.filter(w => {
    const matchSearch = !search ||
      w.german.toLowerCase().includes(search) ||
      w.english.toLowerCase().includes(search);
    const matchTag = tag === 'all' || w.tags.includes(tag);
    return matchSearch && matchTag;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);padding:1rem;">No words found.</p>';
    return;
  }

  list.innerHTML = filtered.map(w => `
    <div class="word-item" data-id="${w.id}">
      <span class="word-gender-badge ${w.gender || 'none'}">${w.gender || '—'}</span>
      <div class="word-main">
        <div class="word-german">${w.german}${w.plural ? ' · ' + w.plural : ''}</div>
        <div class="word-english">${w.english}</div>
      </div>
      <div class="word-tags">
        ${(w.tags || []).map(t => `<span class="tag-pill">${t}</span>`).join('')}
      </div>
      <span class="word-status ${w.known ? 'known' : 'learning'}">${w.known ? 'Known' : 'Learning'}</span>
      <div class="word-actions">
        <button class="btn-icon edit" data-id="${w.id}" title="Edit">✎</button>
        <button class="btn-icon delete" data-id="${w.id}" title="Delete">✕</button>
      </div>
    </div>
  `).join('');
}

// ── Modal ────────────────────────────────────────────────────────────────────
function openModal(wordId) {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');

  if (wordId) {
    const w = words.find(x => x.id === wordId);
    document.getElementById('modal-title').textContent = 'Edit Word';
    document.getElementById('form-id').value = w.id;
    document.getElementById('form-german').value = w.german;
    document.getElementById('form-gender').value = w.gender || '';
    document.getElementById('form-english').value = w.english;
    document.getElementById('form-plural').value = w.plural || '';
    document.getElementById('form-example').value = w.example || '';
    document.getElementById('form-tags').value = (w.tags || []).join(', ');
    document.getElementById('form-forms').value = w.forms || '';
    document.getElementById('form-prep').value = w.prep || '';
  } else {
    document.getElementById('modal-title').textContent = 'Add Word';
    document.getElementById('card-form').reset();
    document.getElementById('form-id').value = '';
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function saveCard(e) {
  e.preventDefault();
  const id = document.getElementById('form-id').value;
  const tags = document.getElementById('form-tags').value
    .split(',').map(t => t.trim()).filter(Boolean);

  const data = {
    german: document.getElementById('form-german').value.trim(),
    gender: document.getElementById('form-gender').value,
    english: document.getElementById('form-english').value.trim(),
    plural: document.getElementById('form-plural').value.trim(),
    example: document.getElementById('form-example').value.trim(),
    forms: document.getElementById('form-forms').value.trim(),
    prep: document.getElementById('form-prep').value.trim(),
    tags,
  };

  if (id) {
    // only the fields that changed, so an edit here cannot undo a concurrent
    // edit of another field on another device
    const w = words.find(x => x.id === id);
    const changed = {};
    if (w) {
      for (const [k, v] of Object.entries(data)) {
        if (JSON.stringify(w[k] ?? '') !== JSON.stringify(v)) changed[k] = v;
      }
    }
    if (Object.keys(changed).length) emit('edit', id, { data: changed });
  } else {
    emit('add', generateId(), { data: { ...data, added: todayLocal() } });
  }

  closeModal();
  renderManage();
  renderHome();
}

function deleteWord(id) {
  if (!confirm('Delete this word?')) return;
  emit('delete', id);
  renderManage();
  renderHome();
}

// ── Stats ────────────────────────────────────────────────────────────────────
function renderStats() {
  const grid = document.getElementById('stats-grid');
  const levels = ['A1', 'A2', 'B1', 'B2'];
  const contentTags = getAllTags().filter(t => !levels.includes(t));
  const groups = [...levels, ...contentTags];

  const cards = groups.map(tag => {
    const group = words.filter(w => w.tags.includes(tag));
    if (group.length === 0) return '';
    const known = group.filter(w => w.known).length;
    const pct = Math.round((known / group.length) * 100);
    return `
      <div class="stat-card">
        <h4>${tag}</h4>
        <div class="stat-bar-wrap">
          <div class="stat-bar" style="width:${pct}%"></div>
        </div>
        <div class="stat-label">${known} / ${group.length} known (${pct}%)</div>
      </div>
    `;
  }).join('');

  const total = words.length;
  const known = words.filter(w => w.known).length;
  const pct = total ? Math.round((known / total) * 100) : 0;

  grid.innerHTML = `
    <div class="stat-card" style="grid-column:1/-1">
      <h4>Overall Progress</h4>
      <div class="stat-bar-wrap">
        <div class="stat-bar" style="width:${pct}%"></div>
      </div>
      <div class="stat-label">${known} / ${total} words known (${pct}%)</div>
    </div>
    ${cards}
  `;
}

// ── Render all ───────────────────────────────────────────────────────────────
function renderAll() {
  renderHome();
}

// After ops arrive from elsewhere. The study view is left alone: its queue was
// re-pointed at the new card objects by rebuild(), and redrawing would lose the
// card that is on screen.
function refreshViews() {
  renderHome();
  const active = document.querySelector('.view.active');
  if (active && active.id === 'view-manage') renderWordList();
  if (active && active.id === 'view-stats') renderStats();
}

// ── Event wiring ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await openStore();         // this device's log, instantly — no network needed
  renderAll();
  updateSyncBadge();

  // Installed app: open offline (sw.js), and ask Chrome not to evict the deck
  // under storage pressure — IndexedDB holds changes not yet synced.
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(e => console.error('Service worker', e));
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // Nav
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', () => showView(el.dataset.view));
  });

  // Home filters
  document.getElementById('home-tag-filter').addEventListener('change', e => {
    activeFilters.tag = e.target.value;
    renderHome();
  });
  document.getElementById('home-level-filter').addEventListener('change', e => {
    activeFilters.level = e.target.value;
    renderHome();
  });

  // Study
  initSwipe();                // also handles the tap that flips
  document.getElementById('btn-speak').addEventListener('click', speakCard);
  document.getElementById('btn-known').addEventListener('click', () => markCard(true));
  document.getElementById('btn-still-learning').addEventListener('click', () => markCard(false));
  document.getElementById('btn-shuffle').addEventListener('click', () => {
    shuffleArray(studyQueue);
    studyIndex = 0;
    sessionKnown = 0;
    sessionLearning = 0;
    updateProgress();
    if (studyQueue.length) showCard(studyQueue[0]);
  });
  document.getElementById('btn-reset-session').addEventListener('click', initStudy);
  document.getElementById('btn-study-again').addEventListener('click', initStudy);

  // Manage
  document.getElementById('btn-add-card').addEventListener('click', () => openModal(null));
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  document.getElementById('card-form').addEventListener('submit', saveCard);

  document.getElementById('search-input').addEventListener('input', e => {
    manageFilter.search = e.target.value;
    renderWordList();
  });
  document.getElementById('manage-tag-filter').addEventListener('change', e => {
    manageFilter.tag = e.target.value;
    renderWordList();
  });

  // Delegate edit/delete clicks in card list
  document.getElementById('card-list').addEventListener('click', e => {
    const editBtn = e.target.closest('.btn-icon.edit');
    const delBtn = e.target.closest('.btn-icon.delete');
    if (editBtn) openModal(editBtn.dataset.id);
    if (delBtn) deleteWord(delBtn.dataset.id);
  });

  // Sync: now, whenever the page comes back into view or the network returns,
  // and once a minute while visible (picks up deck.py fail during a lesson).
  window.addEventListener('online', () => sync());
  // A setup link pasted into an already open tab changes only the fragment:
  // no reload, so read it here too.
  window.addEventListener('hashchange', () => { if (readSetupLink()) sync(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  setInterval(() => { if (!document.hidden) sync(); }, 60000);
  await sync();
  await firstRun();
});
