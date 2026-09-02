# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context: this app lives inside a vault

This directory is `07-Karten/` inside the Deutsch tutoring vault one level up. The
vault's `../CLAUDE.md` defines the tutor persona; this file covers the app only.

The important consequence: **the deck is no longer browser-local.** It lives at
`../05-Vokabeln/deck.json`, and both the app and the tutor's CLI (`deck.py`) read
and write it. Changing the storage layer without preserving that link breaks the
whole point of the integration.

## Running the App

```bash
python3 serve.py            # from anywhere: python3 07-Karten/serve.py
```

`serve.py` serves this directory and adds two endpoints:

- `GET  /api/deck` — the deck from `../05-Vokabeln/deck.json`
- `POST /api/deck` — persist the deck and regenerate the Markdown mirror

Plain `python3 -m http.server 8080` still works, but then `/api/deck` 404s, the app
falls back to `localStorage`, and nothing reaches the vault. The sync badge in the
navbar shows `Offline` when that happens.

There is no build step, no package manager, no transpilation. `serve.py` and
`deck.py` are stdlib-only by design — the app has no dependencies and neither
should its server.

## Architecture

Single-page app in three files — no framework, no modules.

**Storage is two-layered.** `loadFromVault()` fetches `/api/deck` on boot; if that
succeeds, `vaultLive` is true and the vault's copy replaces whatever was in
`localStorage` (the tutor may have logged mistakes since the last session, so the
file wins). `saveWords()` always writes `localStorage` first — data is never lost if
the server dies — then debounces a `POST` 400 ms later, so marking a run of cards
produces one write, not twenty. When `vaultLive` is false the app behaves exactly as
it did before this integration.

**`app.js`** holds all state as module-level `let` variables:
- `words` — master array, always in sync with `localStorage` via `saveWords()`
- `studyQueue` — a snapshot copy of `words` (filtered) taken when study starts; mutations to queue items (e.g. `known`, `lastSeen`) write through to `words` by reference since objects are shared
- `activeFilters` — `{ tag, level }` used by `getFilteredWords()`, which feeds both the home stats and `initStudy()`

**Routing** is class-based: `showView(name)` toggles `.active` on `#view-{name}` sections and calls the corresponding render function. There is no URL routing.

**Rendering** is direct DOM manipulation (no virtual DOM). Each view has a dedicated render function (`renderHome`, `renderManage`, `renderStats`). HTML for list items is built via template literals and set via `innerHTML`. Event delegation is used for the card list (edit/delete buttons).

**Tags vs Levels** — tags array on each word mixes content tags (`animals`, `food`) and CEFR levels (`A1`–`B2`). `populateTagFilter()` strips out level tags so they don't appear in the content tag dropdown. The home view has two separate `<select>` elements that filter independently via `activeFilters.tag` and `activeFilters.level`.

**The card flip** is pure CSS (`rotateY(180deg)` on `.card-inner` when `.flashcard.flipped` is present). The answer buttons are hidden via `visibility:hidden` (not `display:none`) until the card is flipped, so layout doesn't shift.

**Seed loading** (`maybeSeed`) runs once on `DOMContentLoaded` only if `localStorage` is empty. It fetches `data/seed.json`, maps entries to the full word schema, and saves to storage.

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

- All persistence goes through `saveWords(words)` — never write to `localStorage`
  directly, and never bypass it with your own `fetch`. It is the single point where
  the browser and the vault meet.
- Study order is deliberate, not incidental. `initStudy()` sorts by
  `mistakes → difficulty → unknown → least recently seen`. Shuffle is opt-in.
- `deck.py hard` means *evidence of difficulty* — `mistakes > 0` or `difficulty >= 2`
  — and deliberately excludes merely-unstudied cards. The vault's `/drill` refuses to
  run when it returns nothing, so widening this predicate to include `not known`
  would silently re-enable drills built from vocabulary the learner has never seen.
  Unstudied cards belong to `due`.
- After any mutation to `words`, call `saveWords(words)` then re-render the affected views.
- CSS variables are defined on `:root` in `style.css`; use them for any new color or spacing additions.
- Gender badge colors: `der` → `--accent-der` (blue), `die` → `--accent-die` (pink), `das` → `--accent-das` (purple). Apply the gender string as a CSS class to get the right color.
- The `.hidden` utility class uses `!important display:none`. Use `visibility:hidden` instead when you need to preserve layout (as the study action buttons do).
