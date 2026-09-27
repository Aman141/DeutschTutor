---
description: Lehrplan prüfen und anpassen — nach Diagnose, Prüfung oder Zieländerung
argument-hint: [optional: was sich geändert hat]
---

# /plan $ARGUMENTS

Der Lehrplan ist ein Werkzeug, kein Vertrag. Passe ihn an die Wirklichkeit an.

## Prüfe

1. [01-Curriculum/plan.md](../../01-Curriculum/plan.md) — die geplante Reihenfolge
2. [00-State/fortschritt.md](../../00-State/fortschritt.md) — das tatsächliche Tempo
3. [00-State/fehlerlog.md](../../00-State/fehlerlog.md) — die tatsächlichen Probleme
4. [00-State/profil.md](../../00-State/profil.md) — Ziel, Termin, verfügbare Zeit

## Beantworte

- **Stimmt die Reihenfolge noch?** Wenn ein späteres Modul mein größtes Problem
  behandelt, zieh es vor. Wenn ein Modul auf einem Fundament aufbaut, das noch wackelt,
  verschieb es nach hinten. Begründe jede Verschiebung mit einer Zeile aus dem
  Fehlerlog.
- **Reicht die Zeit bis zum Termin?** Rechne: verbleibende Module × Sessions pro Modul
  ÷ Sessions pro Woche. Wenn es nicht passt, kürze — und sag klar, **was gestrichen
  wird** und was das für die Prüfung bedeutet. Kürze niemals das Fundament.
- **Fehlt ein Modul?** Wenn das Fehlerlog ein Thema zeigt, das im Plan nicht vorkommt,
  leg eine neue Moduldatei an: `01-Curriculum/MNN-Thema.md`, im Format von
  [M07-Konjunktiv-II](../../01-Curriculum/M07-Konjunktiv-II.md). Das gilt **nur für
  Module, die du gerade neu erfindest** — sie brauchen eine Begründung, die es sonst
  nirgends gibt.

  **Für alle anderen Module schreibst du keine Datei.** Der Plan legt Reihenfolge und
  Umfang fest; den Sitzungsplan schreibt `/lesson`, wenn das Modul tatsächlich beginnt.
  Grund: Eine Moduldatei ist nur so gut wie die Fehler, die sie zitiert. Fünfzehn
  Dateien auf Vorrat wären auf die Diagnose von heute gebaut, würden aber in drei
  Monaten befolgt — und sähen dabei verbindlich aus, obwohl sie raten.
- **Ist ein Modul zu groß?** Teilen. Ein Modul, das nach 4 Sessions nicht fertig ist,
  war zwei Module.

## Schreibe

Änderungen direkt in [plan.md](../../01-Curriculum/plan.md) und die Modultabelle in
[fortschritt.md](../../00-State/fortschritt.md). Dann in drei Sätzen: was sich
geändert hat, warum, und was das für den Prüfungstermin bedeutet.
