// ── Storage ──────────────────────────────────────────────────────────────────
// Two layers. The vault (05-Vokabeln/deck.json, via serve.py) is the source of
// truth; localStorage is an offline cache so the app still works when opened as
// a plain file. `vaultLive` records which one we are actually talking to.
const STORAGE_KEY = 'deutschcard_words';
const API = '/api/deck';
let vaultLive = false;
let pendingSave = null;

function loadWords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { return []; }
}

// Pull the deck from the vault. Mistakes the tutor logged (deck.py fail) live
// there, so on load the vault wins over the browser cache.
async function loadFromVault() {
  try {
    const res = await fetch(API, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const deck = await res.json();
    if (!Array.isArray(deck)) throw new Error('deck is not an array');
    vaultLive = true;
    words = deck;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
    setSyncState('live', words.length + ' Karten aus dem Vault');
    return true;
  } catch (e) {
    vaultLive = false;
    setSyncState('offline', 'nur im Browser gespeichert — serve.py läuft nicht');
    return false;
  }
}

function saveWords(words) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));   // never lose data
  if (!vaultLive) return;
  clearTimeout(pendingSave);              // coalesce bursts of card marking
  setSyncState('saving', 'speichere …');
  pendingSave = setTimeout(() => pushToVault(words), 400);
}

async function pushToVault(words) {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(words),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'HTTP ' + res.status);
    setSyncState('live', out.count + ' Karten im Vault');
  } catch (e) {
    setSyncState('error', 'Vault nicht erreichbar — ' + e.message);
  }
}

function setSyncState(state, detail) {
  const el = document.getElementById('sync-badge');
  if (!el) return;
  el.className = 'sync-badge ' + state;
  el.textContent = { live: 'Vault', saving: 'Vault', offline: 'Offline', error: 'Fehler' }[state];
  el.title = detail || '';
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── State ────────────────────────────────────────────────────────────────────
let words = loadWords();
let studyQueue = [];
let studyIndex = 0;
let sessionKnown = 0;
let sessionLearning = 0;
let isFlipped = false;
let activeFilters = { tag: 'all', level: 'all' };

// ── Seed data (load once) ────────────────────────────────────────────────────
async function maybeSeed() {
  if (vaultLive || words.length > 0) return;   // serve.py seeds the vault itself
  try {
    const res = await fetch('data/seed.json');
    const seed = await res.json();
    words = seed.map(w => ({
      id: generateId(),
      german: w.german,
      gender: w.gender || '',
      plural: w.plural || '',
      english: w.english,
      example: w.example || '',
      tags: w.tags || [],
      known: false,
      difficulty: 0,
      lastSeen: null,
      forms: w.forms || '',
      prep: w.prep || '',
      mistakes: 0,
      mistakeKinds: [],
    }));
    saveWords(words);
    renderAll();
  } catch (e) {
    console.error('Seed load failed', e);
  }
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
    const w = studyQueue[studyIndex];
    w.lastSeen = new Date().toISOString().slice(0, 10);
  }
}

function markCard(known) {
  if (studyIndex >= studyQueue.length) return;
  const word = studyQueue[studyIndex];
  word.known = known;
  if (known) {
    sessionKnown++;
    word.difficulty = Math.max(0, word.difficulty - 1);
  } else {
    sessionLearning++;
    word.difficulty = Math.min(3, word.difficulty + 1);
  }
  saveWords(words);

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
    const idx = words.findIndex(w => w.id === id);
    if (idx !== -1) Object.assign(words[idx], data);
  } else {
    words.push({
      id: generateId(), known: false, difficulty: 0, lastSeen: null,
      mistakes: 0, mistakeKinds: [], fehlerTags: [], source: '',
      added: new Date().toISOString().slice(0, 10), ...data,
    });
  }

  saveWords(words);
  closeModal();
  renderManage();
  renderHome();
}

function deleteWord(id) {
  if (!confirm('Delete this word?')) return;
  words = words.filter(w => w.id !== id);
  saveWords(words);
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

// ── Event wiring ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadFromVault();     // the vault wins if serve.py is running
  await maybeSeed();         // otherwise fall back to the bundled seed
  renderAll();

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
  document.getElementById('flashcard').addEventListener('click', flipCard);
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
});
