# DeutschCard

A lightweight German vocabulary flashcard app — no build step, no dependencies.

Part of the **Deutsch tutoring vault** one directory up: the deck it studies is the
same file the tutor writes to, so mistakes made in a lesson show up here as
priority cards, and progress made here is visible to the tutor. See
[Vault integration](#vault-integration).

## Features

- **Flashcard study mode** — flip cards with a 3D animation, mark words as Known or Still Learning
- **Progress tracking** — session summary, progress bar, and per-tag/level stats
- **Deck management** — add, edit, and delete words via a modal form
- **Filters** — study or browse by content tag (animals, food, etc.) and CEFR level (A1–B2)
- **Shuffle mode** — randomize the study queue
- **Gender color coding** — `der` (blue), `die` (pink), `das` (purple)
- **50 seed words** — pre-loaded across A1–B1 levels on first launch
- **Mistake-first study order** — words the tutor logged as wrong come up first
- **Verb forms & prepositions** — Präteritum/Partizip II and fixed case on the card
- **Vault sync** — the deck is a real file on disk, not just browser storage
- **Offline-safe merging** — changes are an append-only op log, so the app, the
  tutor's CLI and the phone can each work offline and merge without overwriting
  each other
- **Installable on Android** — "Install app" in Chrome; opens offline, bottom tab
  bar, swipe right = Known / left = Still Learning, 🔈 reads the word aloud
- **Cloud relay** — sync while the Mac is off, see [cloud/README.md](cloud/README.md)

## Getting Started

```bash
python3 serve.py
```

It picks a free port, prints the URL and opens your browser. From the vault root the
slash command `/karten` does the same thing.

> Opening `index.html` directly still works, but the deck then lives only in your
> browser and the tutor cannot see it. The badge in the navbar tells you which mode
> you are in: **Vault** (synced), **3 offen** (changes waiting for the server) or
> **Offline**.

## Vault integration

The deck lives at `../05-Vokabeln/ops.jsonl`, an append-only log of changes. Two
things add to it:

```
  Frau Ritter (the tutor)                    You (studying)
      deck.py add / fail / pass                  the browser app (IndexedDB)
                  \                                /
                   \                    serve.py  GET/POST /api/ops
                    →   05-Vokabeln/ops.jsonl   ←
                                  |
                           replay (deck.py)
                                  |
                        05-Vokabeln/deck.json  (generated: the current deck)
                        05-Vokabeln/*.md       (generated mirror, for Obsidian)
```

Every change is an *op* — `add`, `edit`, `delete`, `review`, `fail` — with a unique
id and a timestamp. Replaying all ops in timestamp order gives the deck, and both
the app (`ops.js`) and the CLI (`deck.py`) run the same replay, so any device that
holds the same ops shows the same deck. Ops are only ever appended, so a browser that
was offline for a week sends its reviews and nothing the tutor logged meanwhile is
lost. Op shapes are documented at the top of the op-log section in `deck.py`.

So the loop closes in both directions:

- Get *der Vertrag* wrong in a lesson → the tutor runs
  `deck.py fail Vertrag --kind artikel` → the card jumps to the front of your next
  study session, and its back says *"1 Fehler im Unterricht: artikel"*.
- Mark a card "Still Learning" three times → the tutor sees it in
  `deck.py hard` and builds a drill around it.

### Tutor CLI

```bash
python3 deck.py add "Vertrag" --gender der --plural "Verträge" --en "contract" \
                   --example "Ich habe den Vertrag unterschrieben." --tags B1,arbeit
python3 deck.py fail "Vertrag" --kind artikel --tag "#genus" --source L-012
python3 deck.py pass "Vertrag"
python3 deck.py hard -n 20        # problem cards only, worst first
python3 deck.py due --days 3      # not seen in 3+ days (includes never-studied)
python3 deck.py stats
python3 deck.py activity --days 7 # app study time per day and device
python3 deck.py sync              # exchange ops with the Cloudflare relay
python3 deck.py device add phone  # setup link for a new device (list, revoke)
python3 deck.py sync-md           # rewrite deck.json + the Markdown mirror
python3 deck.py import-md         # pull in hand-written :: cards
```

## Project Structure

```
07-DeutschCard/
├── index.html      # App shell and all views
├── style.css       # Styles and card flip animation
├── app.js          # All app logic (state, routing, op log + sync)
├── ops.js          # Op replay — must match replay() in deck.py
├── sw.js           # Service worker: opens offline (network-first app shell)
├── manifest.webmanifest  # makes Chrome offer "Install app"
├── icons/          # app icons + make_icons.py (stdlib) that draws them
├── cloud/          # Cloudflare relay: worker, schema, setup
├── serve.py        # Static server + /api/ops sync endpoints
├── deck.py         # Tutor-facing CLI over the op log
├── tests/          # Python + Node tests pinning both replays to fixtures/
└── data/
    └── seed.json   # 50 starter words, used only to initialise an empty deck

../05-Vokabeln/
├── ops.jsonl       # the op log — source of truth, the file to back up
├── deck.json       # generated: the current deck (read it, don't write it)
├── deck.pre-ops.json # the deck as it was before the op log, kept once
└── *.md            # generated mirror for reading/searching in Obsidian

## Tests

```bash
python3 -m unittest discover tests
node --test tests/test_ops.js
```

Both run every `tests/fixtures/*.ops.jsonl` through their replay, in many arrival
orders, and compare with the matching `*.expected.json`. Change replay rules in
`ops.js` and `deck.py` together, and add a fixture for the new case.
```

## Word Data Model

Each card in `deck.json` (the result of replaying the log) has this shape. The
fields below the divider were added by the vault integration and are all optional —
a card without them behaves exactly as before.

```json
{
  "id": "unique string",
  "german": "Hund",
  "gender": "der",
  "plural": "Hunde",
  "english": "dog",
  "example": "Der Hund läuft im Park.",
  "tags": ["A1", "animals"],
  "known": false,
  "difficulty": 0,
  "lastSeen": "2026-05-09",

  "forms": "",
  "prep": "",
  "mistakes": 0,
  "mistakeKinds": [],
  "fehlerTags": [],
  "source": "",
  "added": "2026-09-02"
}
```

`mistakes` drives the study order — that is the whole mechanism behind
"mistakes update the flashcards".

## Adding Your Own Words

Go to **Manage → + Add Word** and fill in the form. Tags are comma-separated — use
CEFR levels (`A1`, `A2`, `B1`, `B2`) alongside content tags (`food`, `verbs`, etc.)
to make filters useful. Give nouns a gender and plural, and verbs their
Präteritum/Partizip II in **Verb Forms** — the tutor's vocabulary rules require both.

Or from the command line: `python3 deck.py add …` (see above).

## Resetting All Data

The browser keeps its own copy of the ops in IndexedDB. Clearing it is safe once
the badge says **Vault** (nothing waiting) — the next load pulls everything back from
the vault. With changes still waiting (`3 offen`), clearing loses those changes.

```js
indexedDB.deleteDatabase('deutschcard'); location.reload();
```

To reset the **deck itself**, move `../05-Vokabeln/ops.jsonl` and `deck.json` out of
the way and run `python3 deck.py import-seed`. This discards every mistake the tutor
has logged.
