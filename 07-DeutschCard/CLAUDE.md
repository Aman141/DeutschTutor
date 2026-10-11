# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context: this app lives inside a vault

This directory is `07-DeutschCard/` inside the Deutsch tutoring vault one level up. The
vault's `../CLAUDE.md` defines the tutor persona; this file covers the app only.

The important consequence: **the deck is no longer browser-local.** Its source of
truth is `../05-Vokabeln/ops.jsonl`, an append-only log of changes that both the app
and the tutor's CLI (`deck.py`) add to. `../05-Vokabeln/deck.json` is generated from
it. Changing the storage layer without preserving that link breaks the whole point
of the integration.

## Running the App

```bash
python3 serve.py            # from anywhere: python3 07-DeutschCard/serve.py
```

`serve.py` serves this directory and adds two endpoints:

- `GET  /api/ops?since=N` — `{ops, seq}`: the ops after the first N in the log
- `POST /api/ops` — `{ops: [...]}`: append the ones whose id is new, regenerate
  `deck.json` and the Markdown mirror

The Cloudflare relay in `cloud/` speaks the same protocol (plus a bearer token per
device, and `more` for paging), so the app is identical on both: it talks to
whatever origin served it. See `cloud/README.md`. `deck.py` syncs with the relay
around every command when `../05-Vokabeln/sync.json` exists.

`POST /api/deck` (the old whole-deck overwrite) answers 410 so a stale cached page
fails loudly instead of clobbering the vault. With plain `python3 -m http.server`
nothing reaches the vault; ops wait in the browser's outbox until `serve.py` runs.

There is no build step, no package manager, no transpilation. `serve.py` and
`deck.py` are stdlib-only by design — the app has no dependencies and neither
should its server. Tests use only `unittest` and `node:test`:

```bash
python3 -m unittest discover tests
node --test tests/test_ops.js
```

## Architecture

Single-page app, no framework, no modules: `index.html`, `style.css`, `ops.js`
(replay, loaded first) and `app.js`.

**The deck is computed, never stored or sent whole.** Every change is an op —
`add`, `edit`, `delete`, `review`, `fail` — with a unique `id`, an `at` timestamp
(UTC ISO, ms) and a `device`. `replay()` in `ops.js` sorts ops by `(at, id)` and
folds them into cards; `deck.py` has the identical `replay()` in Python, and
`tests/fixtures/` pins both to the same output. Op shapes and their rules are
documented once, above `make_op()` in `deck.py`.

**Sync is push-outbox, pull-since-cursor.** `openStore()` loads this device's ops
from IndexedDB (`ops`, `outbox`, `meta` stores) and replays them — the app works
before any network. `emit()` appends an op, applies it incrementally, stores it,
adds its id to the outbox and schedules `sync()` 400 ms later (a run of card marks
becomes one request). `sync()` posts the outbox in chunks, then pulls everything after
`cursor` and replays if anything new arrived. It runs on load, on `online`, when the
page becomes visible and every 60 s, so a `deck.py fail` during a lesson appears
within a minute. Because ops only accumulate and duplicates are dropped by id, no
device can overwrite another's changes — the bug the old whole-deck `POST` had.

**`app.js`** holds all state as module-level `let` variables:
- `words` — the replayed deck (`deckOf(opState)`); read it, never mutate it
- `opLog`, `opState`, `outbox`, `cursor` — the log, its replayed state, ids not yet
  accepted by the server, and how many server ops have been pulled
- `studyQueue` — a filtered, sorted copy of `words` taken when study starts. It holds the same card objects as `opState`, so incremental ops update it in place; a full `rebuild()` re-points it at the new objects by id
- `activeFilters` — `{ tag, level }` used by `getFilteredWords()`, which feeds both the home stats and `initStudy()`

**Routing** is class-based: `showView(name)` toggles `.active` on `#view-{name}` sections and calls the corresponding render function. There is no URL routing.

**Rendering** is direct DOM manipulation (no virtual DOM). Each view has a dedicated render function (`renderHome`, `renderManage`, `renderStats`). HTML for list items is built via template literals and set via `innerHTML`. Event delegation is used for the card list (edit/delete buttons).

**Tags vs Levels** — tags array on each word mixes content tags (`animals`, `food`) and CEFR levels (`A1`–`B2`). `populateTagFilter()` strips out level tags so they don't appear in the content tag dropdown. The home view has two separate `<select>` elements that filter independently via `activeFilters.tag` and `activeFilters.level`.

**The card flip** is pure CSS (`rotateY(180deg)` on `.card-inner` when `.flashcard.flipped` is present). The answer buttons are hidden via `visibility:hidden` (not `display:none`) until the card is flipped, so layout doesn't shift.

**First run** (`firstRun`) runs after the first sync. If the log is still empty it imports the pre-op-log `localStorage` deck as `add` ops (same card ids as the vault, so they are no-ops there). It seeds from `data/seed.json` only on `file://` — over http the vault seeds itself, and seeding in the browser would merge a second set of seed cards into the vault as duplicates.

## Word Schema

```js
{
  id,        // string — timestamp+random, generated client-side
  german,    // string — bare word, no article (article lives in `gender`)
  gender,    // 'der' | 'die' | 'das' | ''
  plural,    // string
  english,   // string
  example,   // string — full German sentence
  tags,      // string[] — mix of CEFR levels and content tags
  known,     // boolean — toggled by study mode buttons
  difficulty,// 0–3 — incremented on "Still Learning", decremented on "Known"
  lastSeen,  // ISO date string 'YYYY-MM-DD' | null

  // ── added by the vault integration; all optional, all safe to omit ──
  forms,        // string — verb: 'zog um, ist umgezogen' (Präteritum, Partizip II)
  prep,         // string — fixed preposition + case: 'über (+Akk)'
  mistakes,     // number — times the tutor logged this word wrong in a lesson
  mistakeKinds, // string[] — 'artikel' | 'plural' | 'bedeutung' | 'form' | …
  fehlerTags,   // string[] — grammar tags from the vault's Fehlerlog, e.g. '#genus'
  source,       // string — lesson that introduced it, e.g. 'L-012'
  added,        // ISO date string
}
```

`mistakes` is what makes this more than a flashcard app: `initStudy()` sorts the
queue by it, so words the user actually got wrong in conversation surface first.
`deck.py fail <word>` is what sets it.

## Key Conventions

- Every change goes through `emit(op, cardId, payload)` — never mutate `words` or a
  card directly (the change vanishes on the next replay and never reaches the vault),
  and never talk to `/api/ops` outside `sync()`.
- Replay rules live in two places, `ops.js` and `deck.py`. Change them together and
  add a fixture to `tests/fixtures/`. A new op type must be *ignored* by older code
  (unknown types are skipped), so devices on different versions still converge.
- `edit` ops carry only the fields that changed, so editing one field cannot undo a
  concurrent edit of another field elsewhere. Keep it that way.
- `id`, `at` and `card` are what replay depends on. Never rewrite or delete lines
  in `ops.jsonl`; correct a mistake with a new op.
- Study order is deliberate, not incidental. `initStudy()` sorts by
  `mistakes → difficulty → unknown → least recently seen`. Shuffle is opt-in.
- `deck.py hard` means *evidence of difficulty* — `mistakes > 0` or `difficulty >= 2`
  — and deliberately excludes merely-unstudied cards. The vault's `/drill` refuses to
  run when it returns nothing, so widening this predicate to include `not known`
  would silently re-enable drills built from vocabulary the learner has never seen.
  Unstudied cards belong to `due`.
- After `emit()`, re-render the affected views. Ops arriving from elsewhere call `refreshViews()`, which deliberately leaves the study view alone.
- CSS variables are defined on `:root` in `style.css`; use them for any new color or spacing additions.
- Gender badge colors: `der` → `--accent-der` (blue), `die` → `--accent-die` (pink), `das` → `--accent-das` (purple). Apply the gender string as a CSS class to get the right color.
- The `.hidden` utility class uses `!important display:none`. Use `visibility:hidden` instead when you need to preserve layout (as the study action buttons do).
