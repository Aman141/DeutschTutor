// Replay must give the same deck in JS and Python. Run: node --test tests/test_ops.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { replay, deckOf } = require('../ops.js');

const dir = path.join(__dirname, 'fixtures');
const fixtures = fs.readdirSync(dir).filter(f => f.endsWith('.ops.jsonl')).sort().map(f => ({
  name: f,
  ops: fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(l => l.trim()).map(JSON.parse),
  expected: JSON.parse(fs.readFileSync(path.join(dir, f.replace('.ops.jsonl', '.expected.json')), 'utf8')),
}));

// deterministic shuffle so a failure can be reproduced
function shuffled(arr, seed) {
  const out = arr.slice();
  let s = seed + 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

for (const { name, ops, expected } of fixtures) {
  test(`${name} matches expected`, () => {
    assert.deepStrictEqual(deckOf(replay(ops)), expected);
  });
  test(`${name} ignores arrival order`, () => {
    for (let seed = 0; seed < 20; seed++) {
      assert.deepStrictEqual(deckOf(replay(shuffled(ops, seed))), expected, `seed ${seed}`);
    }
  });
}

test('replay does not alias op data', () => {
  const op = { id: 'o1', at: '2026-10-01T00:00:00.000Z', op: 'add', card: 'c1', data: { german: 'Haus', tags: ['A1'] } };
  deckOf(replay([op]))[0].tags.push('mutated');
  assert.deepStrictEqual(op.data.tags, ['A1']);
});
