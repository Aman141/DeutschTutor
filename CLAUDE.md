# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

The app requires an HTTP server to load `data/seed.json` via `fetch`. Open a file directly and seed loading silently fails (the user must add words manually).

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

There is no build step, no package manager, no transpilation.

## Architecture

Single-page app in three files — no framework, no modules.

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
}
```

## Key Conventions

- All persistence goes through `saveWords(words)` — never write to `localStorage` directly.
- After any mutation to `words`, call `saveWords(words)` then re-render the affected views.
- CSS variables are defined on `:root` in `style.css`; use them for any new color or spacing additions.
- Gender badge colors: `der` → `--accent-der` (blue), `die` → `--accent-die` (pink), `das` → `--accent-das` (purple). Apply the gender string as a CSS class to get the right color.
- The `.hidden` utility class uses `!important display:none`. Use `visibility:hidden` instead when you need to preserve layout (as the study action buttons do).
