# DeutschCard

A lightweight German vocabulary flashcard app that runs entirely in the browser — no build step, no backend, no dependencies.

## Features

- **Flashcard study mode** — flip cards with a 3D animation, mark words as Known or Still Learning
- **Progress tracking** — session summary, progress bar, and per-tag/level stats
- **Deck management** — add, edit, and delete words via a modal form
- **Filters** — study or browse by content tag (animals, food, etc.) and CEFR level (A1–B2)
- **Shuffle mode** — randomize the study queue
- **Gender color coding** — `der` (blue), `die` (pink), `das` (purple)
- **50 seed words** — pre-loaded across A1–B1 levels on first launch
- **Offline-ready** — all data stored in `localStorage`, works without internet after first load

## Getting Started

```bash
# Clone or download the repo, then serve from the project root
python3 -m http.server 8080
```

Open `http://localhost:8080` in your browser.

> You can also just open `index.html` directly — everything works without a server except the seed data fetch (which requires HTTP). If opening as a file, add words manually via Manage.

## Project Structure

```
DeutschCard/
├── index.html      # App shell and all views
├── style.css       # Styles and card flip animation
├── app.js          # All app logic (state, routing, localStorage)
└── data/
    └── seed.json   # 50 starter words loaded on first launch
```

## Word Data Model

Each word stored in `localStorage` follows this shape:

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
  "lastSeen": "2026-05-09"
}
```

## Adding Your Own Words

Go to **Manage → + Add Word** and fill in the form. Tags are comma-separated — use CEFR levels (`A1`, `A2`, `B1`, `B2`) alongside content tags (`food`, `verbs`, etc.) to make filters useful.

## Resetting All Data

Open your browser's DevTools console and run:

```js
localStorage.removeItem('deutschcard_words'); location.reload();
```

This wipes all words and reloads the 50 seed words.
