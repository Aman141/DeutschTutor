#!/usr/bin/env bash
# setup.sh — turn a fresh clone into your own tutoring vault.
#
# The repo ships the system and blank templates. This copies the templates into
# place and seeds the vocabulary deck. Everything it creates is gitignored, so
# your learning stays on your machine no matter how often you push.
#
# Safe to re-run: it never overwrites a file you already have.

set -euo pipefail
cd "$(dirname "$0")"

green() { printf '\033[32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[33m%s\033[0m\n' "$1"; }
red() { printf '\033[31m%s\033[0m\n' "$1"; }

echo
echo "  Deutsch — Einrichtung"
echo "  ─────────────────────"
echo

# ── 1. instantiate the state files ───────────────────────────────────────────
created=0
kept=0
for f in profil fortschritt fehlerlog; do
  if [ -e "00-State/$f.md" ]; then
    echo "  behalten   00-State/$f.md (existiert schon)"
    kept=$((kept + 1))
  else
    cp "templates/$f.md" "00-State/$f.md"
    green "  erstellt   00-State/$f.md"
    created=$((created + 1))
  fi
done

# ── 2. the placement test ────────────────────────────────────────────────────
mkdir -p 04-Prüfungen
for f in 00-Einstufungstest 00-Einstufungstest-KEY; do
  if [ -e "04-Prüfungen/$f.md" ]; then
    echo "  behalten   04-Prüfungen/$f.md (existiert schon)"
  else
    cp "templates/$f.md" "04-Prüfungen/$f.md"
    green "  erstellt   04-Prüfungen/$f.md"
  fi
done

# ── 3. Claude Code permissions ───────────────────────────────────────────────
# Not tracked by git: Claude Code appends approvals to it as you work, including
# absolute paths with your username. Installed from the example instead.
if [ -e ".claude/settings.json" ]; then
  echo "  behalten   .claude/settings.json (existiert schon)"
else
  cp ".claude/settings.example.json" ".claude/settings.json"
  green "  erstellt   .claude/settings.json (say/ffmpeg/python3 erlaubt)"
fi

# ── 4. seed the vocabulary deck ──────────────────────────────────────────────
if [ -e "05-Vokabeln/deck.json" ]; then
  echo "  behalten   05-Vokabeln/deck.json (existiert schon)"
else
  if command -v python3 >/dev/null 2>&1; then
    python3 07-DeutschCard/deck.py import-seed >/dev/null
    python3 07-DeutschCard/deck.py sync-md >/dev/null
    green "  erstellt   05-Vokabeln/deck.json (50 Startkarten)"
  else
    red "  python3 fehlt — Deck nicht angelegt. Installiere Python 3.9+."
  fi
fi

# ── 5. check the prerequisites, honestly ─────────────────────────────────────
echo
echo "  Voraussetzungen"
echo "  ───────────────"

check() { # name, command, hint
  if command -v "$2" >/dev/null 2>&1; then
    green "  ✓ $1"
  else
    yellow "  ✗ $1 — $3"
  fi
}

check "python3   (Flashcard-App, deck.py)" python3 "Python 3.9+ installieren"
check "ffmpeg    (Dialoge zusammenfügen)" ffmpeg "brew install ffmpeg"

if command -v say >/dev/null 2>&1; then
  voices=$(say -v '?' 2>/dev/null | grep -c de_DE || true)
  if [ "${voices:-0}" -gt 0 ]; then
    green "  ✓ deutsche Stimmen ($voices gefunden)"
    say -v '?' 2>/dev/null | grep de_DE | awk '{printf "      %s\n", $1}'
  else
    yellow "  ✗ keine deutsche Stimme — System Settings → Accessibility →"
    yellow "      Spoken Content → System Voice → Manage Voices → Deutsch"
  fi
else
  yellow "  ✗ 'say' nicht vorhanden (kein macOS?) — siehe README, Abschnitt"
  yellow "      'Other platforms': unter Linux Piper statt say"
fi

# optional, only for the pronunciation loop
for pair in "sox:Aufnahme" "whisper-cli:Transkription"; do
  bin="${pair%%:*}"; what="${pair##*:}"
  command -v "$bin" >/dev/null 2>&1 \
    && green "  ✓ $bin ($what, optional)" \
    || echo "  · $bin fehlt — nur für den Aussprache-Loop nötig ($what)"
done

# ── 6. tell them what to do next ─────────────────────────────────────────────
echo
echo "  Nächste Schritte"
echo "  ────────────────"
echo "  1. 00-State/profil.md ausfüllen — jedes TODO. Prüfungstermin,"
echo "     Ziel und Stunden pro Woche entscheiden über den ganzen Plan."
echo "  2. claude   → dann /permissions und diese vier erlauben:"
echo "     Bash(say:*) Bash(ffmpeg:*) Bash(afplay:*) Bash(python3:*)"
echo "  3. Den Einstufungstest machen: 04-Prüfungen/00-Einstufungstest.md"
echo "     Danach in einer NEUEN Session (/clear) bewerten lassen."
echo "  4. Eine Woche nur /lesson. Erst danach Audio und Prüfungen."
echo
if [ "$created" -eq 0 ] && [ "$kept" -gt 0 ]; then
  echo "  (Nichts überschrieben — dein Lernstand ist unverändert.)"
fi
green "  Fertig. Viel Erfolg."
echo
