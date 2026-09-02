# Start hier

Mein Deutsch-Tutor. Lehrerin: **Frau Ritter** (Persona und Regeln in `CLAUDE.md`).
Ziel: **telc Deutsch B1**.

## Erste Schritte

1. [00-State/profil.md](00-State/profil.md) öffnen und die **TODO**-Felder ausfüllen —
   vor allem Prüfungstermin, Ziel und wöchentliche Zeit. Alles andere hängt daran.
2. `/exam mini` — Einstufung, damit die Startannahmen durch echte Zahlen ersetzt werden.
3. `/lesson` — erste Stunde.

## Befehle

| Befehl | Was passiert |
|---|---|
| `/lesson [Thema]` | Vollständige Unterrichtsstunde, ~45 Min, mit Hausaufgabe |
| `/drill [#tag]` | 20 Items unter Zeitdruck, gebaut aus meinen eigenen Fehlern |
| `/exam [teil]` | Prüfung im telc-Format, danach Bewertung und Prognose |
| `/speak [Situation]` | Rollenspiel mit Audio, danach Aussprachekorrektur |
| `/podcast [Thema]` | Mehrstimmiger Hördialog als WAV + Hörverstehensaufgaben |
| `/vokabeln [Thema]` | Karten abfragen, oder neue zu einem Thema bauen |
| `/karten` | Startet die Flashcard-App im Browser, synchron mit dem Vault |
| `/fehler` | Fehleranalyse: Zählung, Muster, Plan |
| `/review` | Wochenrückblick und Plan für die nächste Woche |
| `/plan` | Lehrplan an die Wirklichkeit anpassen |

## Wie das System funktioniert

Der Motor ist [00-State/fehlerlog.md](00-State/fehlerlog.md). Jeder Fehler wird dort
mit Tag festgehalten; Drills, Wiederholungen und die Reihenfolge der Module ziehen
ihre Inhalte daraus. Fortschritt heißt hier nicht „Häkchen erscheinen", sondern
„Fehler verschwinden".

- **Was ich lerne** → [01-Curriculum/plan.md](01-Curriculum/plan.md)
- **Wo ich stehe** → [00-State/fortschritt.md](00-State/fortschritt.md)
- **Wer ich bin** → [00-State/profil.md](00-State/profil.md)

## Vokabeln und die App

Die Flashcard-App liegt in [07-DeutschCard/](07-DeutschCard/) und wird mit `/karten`
gestartet. Sie und Frau Ritter arbeiten auf **derselben Datei**,
[05-Vokabeln/deck.json](05-Vokabeln/deck.json):

- Wort im Unterricht falsch → Frau Ritter setzt es im Deck auf „Fehler" → beim
  nächsten Lernen steht es in der App **vorn**, mit dem Hinweis, *wie* ich es
  falsch hatte.
- In der App dreimal „Still Learning" → Frau Ritter sieht es und baut den nächsten
  `/drill` darum.

Die `.md`-Dateien in [05-Vokabeln/](05-Vokabeln/) sind ein generierter Spiegel zum
Lesen und Suchen in Obsidian — nicht hineinschreiben. Wer die Karten lieber in
Obsidian wiederholt, kann zusätzlich das Community-Plugin *Spaced Repetition*
aktivieren; die `#flashcard`-Tags bleiben dafür erhalten.

<sub>`Welcome.md` ist noch die Obsidian-Vorlage und kann gelöscht werden.</sub>
