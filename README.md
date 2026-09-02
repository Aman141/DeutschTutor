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
- **Offline-ready** — falls back to `localStorage`, works without the server

## Getting Started

```bash
python3 serve.py
```

It picks a free port, prints the URL and opens your browser. From the vault root the
slash command `/karten` does the same thing.

> Opening `index.html` directly still works, but the deck then lives only in your
> browser and the tutor cannot see it. The badge in the navbar tells you which mode
> you are in: **Vault** or **Offline**.

## Vault integration

The deck lives at `../05-Vokabeln/deck.json`. Two things read and write it:

```
  Frau Ritter (the tutor)                    You (studying)
      deck.py add / fail / pass                  the browser app
                  \                                /
                   \                              /
                    →   05-Vokabeln/deck.json   ←
                                  |
                          serve.py  GET/POST /api/deck
                                  |
                        05-Vokabeln/*.md  (generated mirror, for Obsidian)
```

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
python3 deck.py hard -n 20        # problem cards, worst first
python3 deck.py due --days 3      # not seen in 3+ days
python3 deck.py stats
python3 deck.py sync-md           # rewrite the Markdown mirror
python3 deck.py import-md         # pull in hand-written :: cards
```

## Project Structure

```
07-Karten/
├── index.html      # App shell and all views
├── style.css       # Styles and card flip animation
├── app.js          # All app logic (state, routing, storage)
├── serve.py        # Static server + /api/deck sync endpoints
├── deck.py         # Tutor-facing CLI over the deck
└── data/
    └── seed.json   # 50 starter words, used only to initialise an empty deck

../05-Vokabeln/
├── deck.json       # the deck — source of truth
├── deck.json.bak   # previous version, kept on every write
└── *.md            # generated mirror for reading/searching in Obsidian
```

## Word Data Model

Each card in `deck.json` (and mirrored into `localStorage`) has this shape. The
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

With the vault sync in place, the browser is only a cache — clearing it is safe and
the deck comes back from disk on reload:

```js
localStorage.removeItem('deutschcard_words'); location.reload();
```

To reset the **deck itself**, delete `../05-Vokabeln/deck.json` and run
`python3 deck.py import-seed`. The previous version is kept at `deck.json.bak`.
Note this discards every mistake the tutor has logged.
