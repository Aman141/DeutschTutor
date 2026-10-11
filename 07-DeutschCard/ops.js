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

// Ids, timestamps and card ids are printable ASCII, so JS (UTF-16 units) and
// Python (code points) sort them identically. Anything else is not an op.
const PRINTABLE = /^[\x21-\x7e]+$/;
const MAX_MISTAKES = 1000;

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const hasField = k => Object.prototype.hasOwnProperty.call(OP_FIELDS, k);

function validOp(o) {
  return isObject(o) &&
    typeof o.id === 'string' && o.id.length <= 64 && PRINTABLE.test(o.id) &&
    typeof o.at === 'string' && o.at.length <= 40 && PRINTABLE.test(o.at) &&
    typeof o.card === 'string' && o.card.length <= 64 && PRINTABLE.test(o.card) &&
    typeof o.op === 'string';
}

// Plain code-unit comparison, same as Python's string ordering for ASCII.
function compareOps(a, b) {
  if (a.at !== b.at) return a.at < b.at ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

// Every field gets the type its default has, whatever an op carried. The log is
// shared by all devices, so one garbled op must not crash or split them: a
// wrong type falls back to the default, numbers are clamped integers.
function coerce(k, v) {
  const def = OP_FIELDS[k];
  if (Array.isArray(def)) return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
  if (typeof def === 'boolean') return v === true;
  if (typeof def === 'string') return typeof v === 'string' ? v : def;
  if (typeof def === 'number') {
    if (!Number.isInteger(v)) return 0;
    return k === 'difficulty' ? Math.min(3, Math.max(0, v)) : Math.min(MAX_MISTAKES, Math.max(0, v));
  }
  return typeof v === 'string' ? v : null;      // lastSeen, added
}

const str = v => (typeof v === 'string' && v !== '') ? v : null;

function cardFrom(data, op) {
  const out = {};
  for (const k of Object.keys(OP_FIELDS)) out[k] = coerce(k, data[k]);
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
  const data = isObject(o.data) ? o.data : {};
  if (o.op === 'add') {
    if (!cards.has(cid) && !deleted.has(cid)) {
      cards.set(cid, cardFrom(data, o));
      order.push(cid);
    }
    return;
  }
  const w = cards.get(cid);
  if (!w) return;
  if (o.op === 'edit') {
    for (const [k, v] of Object.entries(data)) {
      if (hasField(k) && k !== 'id') w[k] = coerce(k, v);
    }
  } else if (o.op === 'delete') {
    cards.delete(cid);
    order.splice(order.indexOf(cid), 1);
    deleted.add(cid);
  } else if (o.op === 'review') {
    w.known = o.known === true;
    w.difficulty = w.known ? Math.max(0, w.difficulty - 1) : Math.min(3, w.difficulty + 1);
    w.lastSeen = str(o.date) || o.at.slice(0, 10);
  } else if (o.op === 'fail') {
    w.mistakes = Math.min(MAX_MISTAKES, w.mistakes + 1);
    w.known = false;
    w.difficulty = 3;
    w.lastSeen = str(o.date) || o.at.slice(0, 10);
    if (str(o.kind) && !w.mistakeKinds.includes(o.kind)) w.mistakeKinds.push(o.kind);
    if (str(o.tag) && !w.fehlerTags.includes(o.tag)) w.fehlerTags.push(o.tag);
    if (str(o.source)) w.source = o.source;
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
