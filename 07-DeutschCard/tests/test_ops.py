"""Replay must give the same deck in Python and JS. Run: python3 -m unittest discover tests"""

import glob
import json
import os
import random
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import deck  # noqa: E402


def fixtures():
    for path in sorted(glob.glob(os.path.join(HERE, "fixtures", "*.ops.jsonl"))):
        with open(path, encoding="utf-8") as f:
            ops = [json.loads(line) for line in f if line.strip()]
        with open(path.replace(".ops.jsonl", ".expected.json"), encoding="utf-8") as f:
            yield os.path.basename(path), ops, json.load(f)


class ReplayTest(unittest.TestCase):
    def test_fixtures(self):
        for name, ops, expected in fixtures():
            with self.subTest(name):
                self.assertEqual(deck.replay(ops), expected)

    def test_arrival_order_does_not_matter(self):
        for name, ops, expected in fixtures():
            for seed in range(20):
                shuffled = ops[:]
                random.Random(seed).shuffle(shuffled)
                with self.subTest(name, seed=seed):
                    self.assertEqual(deck.replay(shuffled), expected)

    def test_replay_does_not_alias_op_data(self):
        op = deck.make_op("add", "c1", data={"german": "Haus", "tags": ["A1"]})
        deck.replay([op])[0]["tags"].append("mutated")
        self.assertEqual(op["data"]["tags"], ["A1"])


if __name__ == "__main__":
    unittest.main()
