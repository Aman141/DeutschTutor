# 01 · Curriculum

Was gelernt wird und **warum in dieser Reihenfolge**.

| Datei | Inhalt |
|---|---|
| `plan.md` | Der ganze Bogen A2 → telc B1: alle Module, ihre Reihenfolge, die Begründung |
| `MNN-Thema.md` | Eine Datei pro Modul: Form, typische Fehler, Sitzungsplan, Bestehenskriterium |

## Nicht im Repo

Dieser Ordner steht in [`.gitignore`](../.gitignore). Sobald `/plan` einmal gelaufen
ist, enthält `plan.md` die Auswertung deines Einstufungstests — Punktzahl,
Teilergebnisse und Zitate aus deinem Fehlerlog. Die Moduldateien werden ebenso
persönlich: Sie zitieren deine Fehler mit Beleg, weil genau das sie brauchbar macht.

Das Repo liefert stattdessen eine neutrale Fassung in
[`templates/curriculum/`](../templates/curriculum/); `./setup.sh` kopiert sie hierher.

## Wann eine Moduldatei entsteht

**Nicht alle auf einmal.** `plan.md` legt Reihenfolge und Umfang fest — das ist
Planungsarbeit. Die Moduldatei mit Sitzungsplan und Drills entsteht erst, **wenn das
Modul drankommt**, weil ihr Wert daraus kommt, dass sie deine *aktuellen* Fehler
zitiert. Eine Moduldatei für ein Modul in drei Monaten wäre auf eine Diagnose gebaut,
die bis dahin überholt ist.

Faustregel: eine Moduldatei im Voraus, nicht fünfzehn.
