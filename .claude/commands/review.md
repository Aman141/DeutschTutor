---
description: Wochenrückblick — was sitzt, was nicht, was nächste Woche dran ist
argument-hint: [optional: "monat" für den größeren Rückblick]
---

# /review $ARGUMENTS

Der ehrliche Blick zurück. Lies **alle** State-Dateien, die letzten 5 Dateien in
[02-Lektionen/](../../02-Lektionen/), offene Aufgaben in
[03-Aufgaben/](../../03-Aufgaben/) und die letzte Prüfung in
[04-Prüfungen/](../../04-Prüfungen/).

## Bericht

**1 · Zahlen.** Stunden diese Woche vs. Ziel aus [profil.md](../../00-State/profil.md).
Sessions. Die Lernzeit in der App (Handy, Browser) steht nicht in
[fortschritt.md](../../00-State/fortschritt.md), sondern im Deck-Log — rechne sie dazu:

```bash
python3 07-DeutschCard/deck.py activity --days 7     # bei "monat": --days 30
```
 Neue Fehler vs. archivierte Fehler — die Richtung dieser Differenz *ist* der
Fortschritt. Neue Karten, fällige Karten.

**2 · Was jetzt sitzt.** Konkret, mit Beweis: „Nebensätze — 5/5 im Drill am Mittwoch
und in der Aufgabe A-009 kein einziger Verbpositionsfehler." Keine Freundlichkeiten
ohne Belegstelle.

**3 · Was nicht sitzt.** Genauso konkret. Und die unbequeme Frage: liegt es an zu
wenig Übung oder daran, dass ich es nie verstanden habe?

**4 · Offene Enden.** Nicht abgegebene Aufgaben. Angefangene Module. Parkplatz-Themen
aus den Lektionen. Nichts unter den Tisch fallen lassen.

**5 · Prüfungsprognose.** Wenn ein Termin in [profil.md](../../00-State/profil.md)
steht: reicht das Tempo? Wenn nicht, sag es klar und rechne vor, wie viele Stunden
pro Woche nötig wären. Wenn kein Termin steht: wann wäre ein realistischer?

**6 · Nächste Woche.** Konkreter Plan, Tag für Tag, mit Befehlen:

```
Mo  /lesson M05      Adjektivdeklination, zweiter Anlauf
Di  /drill #kasus/dativ
Mi  /speak Wohnungsbesichtigung
Do  A-011 abgeben, dann /lesson
Fr  /podcast Arbeitswelt
Sa  /vokabeln
So  /exam schreiben
```

**7 · Eine Sache.** Die *eine* Änderung an meiner Lernweise, die diese Woche den
größten Unterschied machen würde. Nur eine.

Danach: [fortschritt.md](../../00-State/fortschritt.md) aktualisieren (Wochensumme,
Streak, Modulstatus) und den Rückblick als
`02-Lektionen/R-JJJJ-WNN-Rueckblick.md` ablegen.
