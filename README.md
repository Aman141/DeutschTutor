# Deutsch — a German tutor that lives in your files

An Obsidian vault plus [Claude Code](https://claude.com/claude-code) that acts as a
personal German teacher with a memory. Every lesson, mistake, exam and flashcard is a
file on your disk, so the tutor picks up where it left off instead of starting fresh
every session.

**Target exam: telc Deutsch B1 (Zertifikat Deutsch).** Everything in here — the
curriculum order, the exam formats, the writing rubric, the speaking practice — is
built for telc specifically, not for Goethe. The two exams are both CEFR B1 but they
are *not* interchangeable; see [telc B1 — what you are actually training for](#telc-b1--what-you-are-actually-training-for).

---

## What you get

| | |
|---|---|
| A tutor persona | **Frau Ritter** — speaks German, corrects everything, logs every mistake |
| Persistent state | your level, progress, and every error you have ever made, in `00-State/` |
| A curriculum | 17 modules from A2 to telc B1, in a deliberate order, in `01-Curriculum/` |
| 10 commands | `/lesson` `/drill` `/exam` `/speak` `/podcast` `/vokabeln` `/karten` `/fehler` `/review` `/plan` |
| Generated audio | multi-voice German dialogues as `.wav`, from macOS text-to-speech |
| A flashcard app | in `07-DeutschCard/`, wired to the tutor so lesson mistakes become priority cards |

The design premise: **the error log is the engine.** Drills, revision, module order and
exam focus are all derived from `00-State/fehlerlog.md`. Progress is defined as errors
disappearing, not checkboxes appearing.

---

## Requirements

| | Needed for | Notes |
|---|---|---|
| **macOS** | audio generation | Linux/Windows: see [Other platforms](#other-platforms) |
| **Claude Code** | everything | [install guide](https://docs.claude.com/en/docs/claude-code/setup) |
| **Python 3.9+** | flashcard app + deck CLI | stdlib only, no `pip install` ever |
| **ffmpeg** | stitching multi-voice dialogues | `brew install ffmpeg` |
| **A German TTS voice** | `/podcast`, `/speak`, listening exams | built into macOS, see below |
| **Obsidian** | reading the vault comfortably | optional — it is all plain Markdown |

You do **not** need `sox` or `whisper` to start. They are only for the optional
pronunciation loop in [Add-on A](#a--pronunciation-feedback-with-whisper).

---

## Install

### 0 · Prerequisites (~15 minutes, once)

```bash
brew install ffmpeg
```

Then install a German voice: **System Settings → Accessibility → Spoken Content →
System Voice → Manage Voices**, and download the German (Germany) voices you want.
More voices means more distinct speakers in generated dialogues.

Verify what you actually have — do this rather than trusting a list, because the
available German voices differ by macOS version:

```bash
say -v '?' | grep de_DE
```

On this machine that returns nine: `Anna, Eddy, Flo, Grandma, Grandpa, Reed, Rocko,
Sandy, Shelley`. Older guides reference *Petra*, *Markus* and *Yannick*, which are
**not** present on current macOS. If a voice in a command file does not exist, `say`
fails — use names from your own list.

Now confirm the whole audio chain works:

```bash
say -v Anna -r 150 --data-format=LEI16@22050 -o /tmp/probe.wav "Guten Tag, es funktioniert."
afplay /tmp/probe.wav && ffmpeg -hide_banner -i /tmp/probe.wav 2>&1 | grep Duration
```

You should hear German and see a duration. If you hear nothing, the rest of the audio
features will not work either — fix this before continuing.

**Obsidian plugins** (optional): install **Spaced Repetition** if you want to revise
the `#flashcard` cards inside Obsidian, and **Dataview** if you plan to build
[Add-on C](#c--a-morning-dashboard). Community plugins → Browse.

### 1 · Get the vault and open a session

```bash
git clone <this-repo> Deutsch
cd Deutsch
./setup.sh
```

`setup.sh` copies the blank state files out of `templates/`, seeds the vocabulary deck
with 50 starter words, and checks your prerequisites — telling you exactly which German
voices you have. It never overwrites anything, so it is safe to re-run.

Then open a session, and open the folder in Obsidian too if you use it:

```bash
claude
```

`setup.sh` already wrote `.claude/settings.json`, so `say`, `ffmpeg`, `afplay` and the
two Python scripts are allowlisted and it will not prompt on every audio call. Review
them with `/permissions` if you want to see what you granted.

> That file is deliberately **not** tracked by git — Claude Code appends approvals to
> it as you work, and those can include absolute paths with your username. The repo
> ships `.claude/settings.example.json` instead.

First real task in the session: **read [CLAUDE.md](CLAUDE.md) yourself, properly.** It is loaded into every future
session, so a bad rule there compounds forever. Check that it still contains: where
state lives, the rule that every correction appends to `fehlerlog.md` with a tag, the
rule to write lessons to files rather than only chatting, and the instruction to speak
German at your level with English reserved for grammar explanation. Change the persona,
the tone, or the correction format now if you want something different — you are the
one who has to live with it.

### 2 · Fill in your profile

`setup.sh` already created your state files from `templates/`. One of them needs you:

**[00-State/profil.md](00-State/profil.md)** — fill in every **TODO**. Three matter
most, because `/plan` does arithmetic with them:

| Field | Why it changes the whole plan |
|---|---|
| **Exam date** | Decides whether 17 modules fit or have to be cut |
| **Why you're learning** | Decides your entire vocabulary, and can reorder modules |
| **Hours per week** | Decides pace, and whether the date is realistic at all |

That second one is not a formality. If you need German for **Behörden** — residence,
applications, official letters — then Passiv (M08) and Nominalstil (M10) stop being
late-phase modules and become early ones, because that is the grammar every official
decision is written in. If you need it for **work**, you get different vocabulary and
different Redemittel. The tutor adapts to this, but only if it is written down.

Leave the "Bekannte Schwächen" table empty for now. Do not guess at your own
weaknesses — the placement test in the next step measures them, and a wrong guess here
steers months of teaching in the wrong direction.

### 3 · Placement test, before anything else

Do not let it teach you until it knows where you are. `setup.sh` already put the test
in place:

**[04-Prüfungen/00-Einstufungstest.md](04-Prüfungen/00-Einstufungstest.md)** — 40
minutes, five parts, A1 → B1+. Reading, telc-style Sprachbausteine in both formats, and
a short formal letter. Type your answers straight into the file.

Two rules that decide whether it is worth anything:

- **No dictionary, no translator, no search.** It measures what you have, not what you
  can look up.
- **Write `?` when you do not know.** The key counts an honest `?` as more useful than
  a lucky guess — a guessed-correct answer builds seventeen modules on a false reading
  of your level.

Then **start a new session with `/clear` first** and say:

> Grade `04-Prüfungen/00-Einstufungstest.md` against the key and write the result into
> `00-State/profil.md`.

Do not open the key yourself. Every one of its 30 items carries the error tag it tests,
so grading produces a weakness profile rather than just a score — and the key says
outright that the number out of 40 is the least important thing it returns.

The fresh context is deliberate. A session that watched you struggle and encouraged you
through it has a reason to be generous. One that sees only your answers and the key does
not.

### 4 · Generate your curriculum

[01-Curriculum/plan.md](01-Curriculum/plan.md) ships as a complete 17-module A2→B1 arc,
but it was written for someone else's diagnosis. Rebuild it against yours:

> Read `00-State/profil.md`. Rebuild `01-Curriculum/plan.md` as a module-by-module
> curriculum from my actual level to telc Deutsch B1. Each module needs: grammar focus,
> thematic vocabulary field, targets for all four skills, and an exit threshold of 75%.
> Include a dedicated module for **Sprachbausteine**, since telc tests grammar and
> vocabulary as their own scored section and Goethe-oriented curricula omit it. Then
> create one stub file per module in `01-Curriculum/`, in the format of
> `M07-Konjunktiv-II.md`.

75% is deliberately above telc's 60% pass mark — you want headroom on exam day, not a
curriculum that certifies you as *just barely* passing.

**Then read it critically.** If it is twenty modules deep on cases and thin on
Konjunktiv II, Passiv or Sprachbausteine, say so and make it rebalance. This is the
document that decides what you spend three months on.

### 5 · Use it for a week. Only `/lesson`.

No audio, no exams, no flashcard app. Once a day:

```
/lesson
```

This step is not filler. You will find the lessons run too long, or it re-explains
grammar you already own, or the flashcards it generates are trivial. Fix
[CLAUDE.md](CLAUDE.md) and [.claude/commands/lesson.md](.claude/commands/lesson.md) as
you go. Building an audio and exam layer on top of a tutor you have not validated means
rebuilding it later.

---

## Daily use

| Command | What happens |
|---|---|
| `/lesson [topic]` | Full 45-minute taught session; writes a lesson file, an assignment, new flashcards, and updates state |
| `/drill [#tag]` | 20 items under time pressure, built **only** from your own logged errors and problem cards |
| `/vokabeln [topic]` | Vocabulary quizzed conversationally — articles, plurals, verb forms, collocations |
| `/karten` | Launches the flashcard app in your browser, synced to the vault |
| `/speak [situation]` | Roleplay with generated examiner audio, then pronunciation and fluency feedback |
| `/podcast [topic]` | Multi-voice German listening material as `.wav`, plus comprehension questions |
| `/exam [part]` | telc-format exam under real timing, then scored against telc criteria |
| `/fehler` | Diagnosis: counts your error tags, names the structural pattern behind them, plans the fix |
| `/review` | Weekly retrospective and next week's day-by-day plan |
| `/plan` | Re-fits the curriculum to reality — your pace, your errors, your exam date |

A workable rhythm, also written into `plan.md`: lesson Monday, drill Tuesday, speaking
Wednesday, lesson or assignment Thursday, listening Friday, vocabulary Saturday, mini
exam Sunday.

---

## How it works

### The error log is the engine

Every correction Frau Ritter makes appends a tagged row to
[00-State/fehlerlog.md](00-State/fehlerlog.md):

```
| 2026-09-02 | #kasus/dativ | "mit meine Freund" | "mit meinem Freund" | Dativ nach *mit* | L-012 |
```

Tags come from a **fixed** taxonomy (`#kasus/dativ`, `#genus`, `#nebensatz`,
`#adjektivdeklination`, `#konjunktiv2`, `#passiv`, …) so that errors are countable.
That is the whole point: `/fehler` counts them, the top three set the next lesson's
content, `/drill` generates exercises from them, and a module cannot be marked complete
while its signature error is still in your top five.

If you change the taxonomy, change it in [CLAUDE.md](CLAUDE.md) — and keep it closed.
Free-form tags cannot be counted, and the moment they cannot be counted, the system
stops working.

### Vocabulary is a two-way loop

The deck is a real file, [05-Vokabeln/deck.json](05-Vokabeln/deck.json). Both the tutor
and the flashcard app read and write it:

```
  Frau Ritter ──deck.py──┐                    ┌──the browser app
                         ↓                    ↓
                    05-Vokabeln/deck.json  ←──serve.py  /api/deck
                         ↓
                    05-Vokabeln/*.md   (generated mirror, for Obsidian)
```

So it closes in both directions:

- You get *der Vertrag* wrong in conversation → the tutor runs
  `deck.py fail Vertrag --kind artikel` → that card jumps to the **front** of your next
  study session, and its back reads *"1 Fehler im Unterricht: artikel"*.
- You mark a card "Still Learning" three times in the app → the tutor sees it in
  `deck.py hard` and builds the next `/drill` around it.

The `.md` files in `05-Vokabeln/` are **generated** — a readable mirror so the cards stay
searchable in Obsidian, with `#flashcard` tags intact for the Spaced Repetition plugin.
Do not hand-edit them; they get overwritten. If you do, recover with
`python3 07-DeutschCard/deck.py import-md`.

Full app documentation: [07-DeutschCard/README.md](07-DeutschCard/README.md).

### Everything is a file

| Folder | Holds |
|---|---|
| `00-State/` | profile, progress, error log — read at the start of every session |
| `01-Curriculum/` | the plan and one file per module |
| `02-Lektionen/` | one file per taught session, so explanations build on each other |
| `03-Aufgaben/` | assignments — **your submission and its correction live in the same file** |
| `04-Prüfungen/` | exams with your answers and scored results |
| `05-Vokabeln/` | the deck, plus its generated Markdown mirror |
| `06-Audio/` | generated `.wav` files; your own recordings in `Aufnahmen/` |
| `07-DeutschCard/` | the flashcard app and the deck CLI |

---

## telc B1 — what you are actually training for

If you have followed a Goethe-oriented guide before, these differences change how you
prepare. They are why this vault is not exam-agnostic.

| | telc Deutsch B1 |
|---|---|
| **Sprachbausteine** | A scored grammar-and-vocabulary section in two parts. **Goethe B1 has no equivalent.** If your curriculum omits it, you are unprepared for a chunk of the written exam. |
| **Schreiben** | *One* semi-formal letter or email, 3 given Leitpunkte, ~80 words, 30 minutes. |
| **Sprechen** | Three parts, taken in pairs, with preparation time: Kontaktaufnahme → Gespräch über ein Thema → gemeinsam eine Aufgabe lösen. **There is no presentation** — Goethe B1 has one, telc does not. Do not train for it. |
| **Hören** | Three parts. Parts 1 and 3 are played **once only**; part 2 is played twice. Strategy differs per part. |
| **Passing** | Written and oral parts are assessed separately and you must reach the threshold (60%) in both. |
| **Retakes** | All or nothing. Goethe B1 can be passed module by module and retaken one module at a time; **telc cannot.** One weak skill sinks the whole certificate, so do not let any single skill lag. |

**Get the exact numbers from the source, not from memory — anyone's, including an
LLM's.** Download *telc Deutsch B1 · Prüfungsziele, Testbeschreibung* free from
telc.net, and use the Bewertungsbogen inside your own Übungstest PDF. Then:

> Read the telc Deutsch B1 Testbeschreibung and the Bewertungsbogen in
> `telc_deutsch_b1_zd_uebungstest_1.pdf`. Extract the exact point allocation per exam
> part and the full band descriptors for Schriftlicher Ausdruck and Mündlicher Ausdruck
> into `01-Curriculum/rubrik-b1.md`, quoting the official wording. Then check
> `.claude/commands/exam.md` against it and correct any criterion that does not match.

Keep one official Übungstest **unused** until you are close to the exam. `/exam` builds
new tasks in the telc format rather than reusing your mock test, precisely so you still
have a clean dress rehearsal available (module M17).

---

## Optional add-ons

The vault works without these. Each is a prompt you can run when you want the feature —
none of them is built yet.

### A · Pronunciation feedback with Whisper

`/speak` currently generates examiner audio and grades your written responses, and will
listen to a recording you drop into `06-Audio/Aufnahmen/`. What it does *not* do is
transcribe you automatically. Adding that turns it into a real pronunciation detector.

```bash
brew install sox whisper-cpp
mkdir -p ~/models && cd ~/models
curl -L -O https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin
```

Add `Bash(sox:*)` and `Bash(whisper-cli:*)` to `/permissions`, then:

> Rewrite `.claude/commands/speak.md` to implement this loop: (1) generate a telc B1
> Sprechen prompt — Kontaktaufnahme, Gespräch über ein Thema, or gemeinsam planen, never
> a presentation — render the examiner audio with `say` and play it; (2) print the exact
> `sox` command for me to run, and wait; (3) transcribe with
> `whisper-cli -m ~/models/ggml-large-v3-turbo.bin -l de -otxt`; (4) grade the
> transcript against the telc B1 Mündlicher Ausdruck criteria in
> `01-Curriculum/rubrik-b1.md`; (5) separately, list every place Whisper's transcription
> diverges from what I clearly intended.

Your recording command, `Ctrl-C` to stop:

```bash
sox -d -r 16000 -c 1 06-Audio/Aufnahmen/antwort-$(date +%s).wav
```

Step 5 is the one that matters. If Whisper hears *schön* when you said *schon*, or turns
your *ch* into a *k*, that is a genuine pronunciation defect surfacing — not a
transcription bug.

### B · Split exam grading

`/exam` currently sets *and* grades in one session. Splitting them removes the grader's
memory of watching you work:

> Change `.claude/commands/exam.md` so that it generates the exam with real timing,
> writes it to `04-Prüfungen/`, and then **stops without grading**. It must end by
> printing the exact command I should run in a fresh session to grade it. The grading
> command reads only my answer file and `01-Curriculum/rubrik-b1.md`, and must cite a
> band descriptor for every score it gives.
>
> Then add to `CLAUDE.md`: never revise a score because I disagree with it. Log the
> objection in the exam file and re-grade only if I identify a specific misapplication
> of a rubric criterion.

Build `rubrik-b1.md` first — see the prompt in the telc section above.

### C · A morning dashboard

Requires the **Dataview** Obsidian plugin.

> Create `00-State/dashboard.md` with Dataview queries for: modules completed vs
> remaining, average score by skill over time, the ten most frequent tags in
> `fehlerlog.md`, flashcards due today, and total study hours from lesson frontmatter.

Pin it in Obsidian. It becomes the file you open every morning.

### D · Lessons from real German news

> Fetch today's *Langsam gesprochene Nachrichten* from DW and a story from
> nachrichtenleicht.de. Build a lesson around one story: pre-teach the vocabulary, write
> comprehension questions, and add the new words to the deck with `deck.py add`.

Authentic slow-spoken audio is the best bridge between generated dialogues and real
German. Worth adding as soon as `/podcast` feels easy.

### E · A weekly `/status`

`/review` already does this. If you prefer the name, or want a blunter tone, copy
`.claude/commands/review.md` to `status.md` and adjust. Worth running monthly, whatever
you call it:

> Review the last month of lessons and my `fehlerlog.md`. What is this system failing to
> teach me? Propose changes to `CLAUDE.md` or the command files.

---

## Troubleshooting

**`say` fails with "Voice not found"** — the command file names a voice you do not have.
Check `say -v '?' | grep de_DE` and use a name from your own list. *Petra*, *Markus* and
*Yannick* are not on current macOS.

**Flashcard app shows `Offline` in the navbar** — `serve.py` is not running, so the app
is using browser storage and nothing reaches the vault. Start it with `/karten`, or
`python3 07-DeutschCard/serve.py`.

**"Port already in use"** — `serve.py` picks the next free port automatically. Read the
URL from its output rather than assuming 8080. Kill a stray one with
`pkill -f serve.py`.

**`/drill` has nothing to work with** — correct behaviour. It only uses errors you have
actually made. Run `/lesson` a few times first.

**Vocabulary edits vanished** — you hand-edited a generated `.md` file in
`05-Vokabeln/`. Recover with `python3 07-DeutschCard/deck.py import-md`, and add cards with
`deck.py add` in future.

**Corrupt deck** — `05-Vokabeln/deck.json.bak` is the version immediately before the
last write. Copy it back over `deck.json`.

**Claude asks permission constantly** — you skipped the `/permissions` step in
[install 1](#1--get-the-vault-and-open-a-session).

---

## Your learning never gets published

This repo is designed to be forked and shown off while your actual learning stays on
your machine. The split is deliberate:

| Tracked — the system | Ignored — your instance |
|---|---|
| `CLAUDE.md`, `.claude/commands/` | `00-State/profil.md` — level, goals, **residence status** |
| `templates/curriculum/` — neutral plan | `01-Curriculum/` — **your** plan, once `/plan` personalises it |
| `07-DeutschCard/` — the flashcard app | `00-State/fehlerlog.md` — every mistake you've made |
| `.claude/settings.example.json` | `00-State/fortschritt.md` — your scores |
| `templates/` — blank state files | `02-Lektionen/`, `03-Aufgaben/` — lessons, submissions |
| `README.md`, `setup.sh` | `04-Prüfungen/` — your exam answers and grades |
| folder `README.md`s | `05-Vokabeln/` — deck carries your mistake history |
| | `06-Audio/` — **your voice recordings** |

**Why templates exist at all.** Git cannot ignore a file it is already tracking. If
`00-State/profil.md` were committed once, it would stay in history forever — including
the commit where you wrote down your visa situation. So the repo ships
`templates/profil.md` and `.gitignore`s the live one; `setup.sh` copies it into place.

Two things worth knowing:

- **`profil.md` is the sensitive one.** It can hold immigration status, employer, and
  language background. It is first in `.gitignore` for that reason. If you ever move it
  or rename it, update `.gitignore` in the same commit.
- **Never commit exam PDFs.** `.gitignore` blocks `*.pdf` outright. telc and Goethe
  mock tests are copyrighted and not yours to redistribute — keep them outside the repo
  (the vault references them by relative path from the parent folder).

Check what a push would actually publish, any time:

```bash
git ls-files                 # exactly what is tracked
git status --ignored --short  # and what is deliberately not
```

If either shows something personal, stop and fix `.gitignore` **before** committing.

## Other platforms

Only the audio layer is macOS-specific; the tutor, the curriculum, the error log, the
exams and the flashcard app are all portable.

**Linux** — replace `say` with [Piper](https://github.com/rhasspy/piper) and a German
voice model, then update the `say` invocations in
[.claude/commands/podcast.md](.claude/commands/podcast.md),
[speak.md](.claude/commands/speak.md), [exam.md](.claude/commands/exam.md) and
[CLAUDE.md](CLAUDE.md). `afplay` becomes `aplay` or `paplay`. Everything downstream —
`.wav` files, the ffmpeg concat, the comprehension questions — is identical.

**Windows** — use WSL and follow the Linux notes, or drop the audio commands and use the
vault for reading, writing, grammar and vocabulary only. That is still most of it.

---

## Known gaps

Stated plainly so you are not surprised:

- **The Schreiben criteria in `exam.md` are unverified.** They list four criteria taken
  from general telc practice, not from the official Bewertungsbogen. Check them against
  the real document before trusting any score — the prompt is in the
  [telc section](#telc-b1--what-you-are-actually-training-for).
- **No pronunciation transcription, no dashboard, no split grading.** See
  [Optional add-ons](#optional-add-ons).
- **`06-Audio/` will grow.** Generated `.wav` is uncompressed. Convert to mp3 with
  ffmpeg or delete old files periodically.

---

## A note on how to use this well

The tutor is only as honest as the state files. If you skip logging a mistake because it
was embarrassing, or mark a module complete because you are bored of it, the system will
cheerfully build your next three weeks on a false picture — and it has no way to know.
Its single advantage over an app is that it remembers exactly what you get wrong. Protect
that.

Start with [Start hier.md](Start%20hier.md).
