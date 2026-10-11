// ── Op log replay ────────────────────────────────────────────────────────────
// The deck is not stored; it is computed by replaying an append-only log of ops
// in (at, id) order. Every device that holds the same ops gets the same deck,
// which is what lets the phone, the browser and the tutor's CLI edit offline and
// merge later without overwriting each other.
//
// KEEP IN SYNC with replay()/apply_op() in deck.py — tests/fixtures/ pins both
// implementations to the same expected output. Op shapes are documented there.
//
// Loaded as a plain <script> in the browser (globals) and via require() in tests.

const OP_FIELDS = {
  id: '', german: '', gender: '', plural: '', english: '',
  example: '', tags: [], known: false, difficulty: 0, lastSeen: null,
  forms: '', prep: '', mistakes: 0, mistakeKinds: [],
  fehlerTags: [], source: '', added: null,
};

const clone = v => (v === null || typeof v !== 'object') ? v : JSON.parse(JSON.stringify(v));

function validOp(o) {
  return !!o && typeof o === 'object' &&
    typeof o.id === 'string' && o.id !== '' &&
    typeof o.at === 'string' &&
    typeof o.card === 'string' && o.card !== '' &&
    typeof o.op === 'string';
}

// Plain code-unit comparison, same as Python's string ordering for ASCII.
function compareOps(a, b) {
  if (a.at !== b.at) return a.at < b.at ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

function cardFrom(data, op) {
  const out = {};
  for (const [k, def] of Object.entries(OP_FIELDS)) {
    const v = data[k];
    out[k] = clone(v === undefined || v === null ? def : v);
  }
  out.id = op.card;
  out.added = out.added || op.at.slice(0, 10);
  return out;
}

function newState() {
  return { cards: new Map(), order: [], deleted: new Set() };
}

function applyOp(state, o) {
  const { cards, order, deleted } = state;
  const cid = o.card;
  if (o.op === 'add') {
    if (!cards.has(cid) && !deleted.has(cid)) {
      cards.set(cid, cardFrom(o.data || {}, o));
      order.push(cid);
    }
    return;
  }
  const w = cards.get(cid);
  if (!w) return;
  if (o.op === 'edit') {
    for (const [k, v] of Object.entries(o.data || {})) {
      if (k in OP_FIELDS && k !== 'id') w[k] = clone(v);
    }
  } else if (o.op === 'delete') {
    cards.delete(cid);
    order.splice(order.indexOf(cid), 1);
    deleted.add(cid);
  } else if (o.op === 'review') {
    w.known = !!o.known;
    const d = w.difficulty || 0;
    w.difficulty = w.known ? Math.max(0, d - 1) : Math.min(3, d + 1);
    w.lastSeen = o.date || o.at.slice(0, 10);
  } else if (o.op === 'fail') {
    w.mistakes = (w.mistakes || 0) + 1;
    w.known = false;
    w.difficulty = 3;
    w.lastSeen = o.date || o.at.slice(0, 10);
    if (o.kind && !w.mistakeKinds.includes(o.kind)) w.mistakeKinds.push(o.kind);
    if (o.tag && !w.fehlerTags.includes(o.tag)) w.fehlerTags.push(o.tag);
    if (o.source) w.source = o.source;
  }
  // unknown op types are skipped: an older client must not choke on a newer log
}

// Returns the state (not the deck) so callers can keep applying ops to it
// incrementally. A duplicate op id is applied once (the first copy wins).
function replay(ops) {
  const state = newState();
  const seen = new Set();
  ops.filter(o => validOp(o) && !seen.has(o.id) && seen.add(o.id))
     .sort(compareOps)
     .forEach(o => applyOp(state, o));
  return state;
}

function deckOf(state) {
  return state.order.map(id => state.cards.get(id));
}

if (typeof module !== 'undefined') {
  module.exports = { OP_FIELDS, validOp, compareOps, applyOp, newState, replay, deckOf };
}
