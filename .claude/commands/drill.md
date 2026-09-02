---
description: Schnelldrill gegen meine eigenen Fehler — Tempo statt Erklärung
argument-hint: [Tag wie "#kasus/dativ", oder leer für meine Top-Fehler]
---

# /drill $ARGUMENTS

Kein Unterricht. **Reine Wiederholung unter Zeitdruck.** 15 Minuten.

## Erst prüfen, ob es überhaupt Material gibt

Lies [00-State/fehlerlog.md](../../00-State/fehlerlog.md) **und** hol die
Problemkarten aus dem Deck:

```bash
python3 07-DeutschCard/deck.py hard -n 20
```

**Wenn beide leer sind, brich ab.** Erfinde keine allgemeinen Übungen. Sag genau das:

> Dein Fehlerlog ist leer und im Deck stehen keine Problemkarten. Ein Drill zieht
> seine Aufgaben ausschließlich aus deinen echten Fehlern — ohne die wären es
> beliebige Lückensätze aus dem Lehrbuch, und dafür brauchst du mich nicht.
> Mach erst eine Lektion (`/lesson`) oder eine Vokabelrunde (`/vokabeln`).
> Danach hat der Drill etwas, woran er arbeiten kann.

Das ist keine Bequemlichkeit, sondern der Kern des Systems: Ein Drill aus
erfundenen Aufgaben *fühlt* sich nach Arbeit an und trifft trotzdem nichts. Er
verbraucht die Zeit, die eine echte Wiederholung gebraucht hätte, und er erzeugt
Fortschrittseinträge, die nichts bedeuten.

Dasselbe gilt für ein Argument ohne Treffer: Wenn `$ARGUMENTS` ein Tag ist, zu dem
im Log kein einziger Fehler steht, sag das und nenn die drei Tags, zu denen es
Material gibt. Frag nicht „soll ich trotzdem?" — schlag die vorhandenen Tags vor.

Ausnahme: Steht im Log wenig, aber nicht nichts (unter 8 Einträge), dann mach einen
**kurzen** Drill aus genau diesen Einträgen und sag mir, dass er kurz ist. Auffüllen
mit Erfundenem ist auch hier nicht erlaubt.

## Auswahl der Items

Was mit `!` markiert ist, habe ich im Unterricht wirklich falsch gehabt — und was ich
in der App wiederholt als „Still Learning" markiert habe, steht mit hoher
`difficulty` da. Beides gehört in den Drill.

- Mit Argument: nur Items zum Tag `$ARGUMENTS`.
- Ohne Argument: 60 % aus meinen häufigsten 3 Tags, 30 % aus älteren Fehlern, die
  laut Log „überwunden" sein sollten (Ehrlichkeitstest), 10 % aus dem aktuellen Modul.

Die 10 % aus dem aktuellen Modul sind die **einzige** Quelle, die nicht aus meinen
Fehlern kommt — und sie sind optional. Wenn das Log genug hergibt, lass sie weg.

## Regeln des Drills

1. **Ein Item pro Nachricht.** Nummeriert. Dann Stopp und warten.
2. **Kurz korrigieren:** ✅ oder ❌ + die Korrektur + maximal *sechs Wörter* Regel.
   Keine Grammatikvorträge mitten im Drill.
3. **Kein Trostpreis.** Halb richtig ist falsch.
4. Bei zwei Fehlern in Folge zum gleichen Tag: ein Item einschieben, das die Regel
   isoliert und leichter ist. Dann zurück ins Tempo.
5. Mischformate: Lückensatz, Umformung, Übersetzung EN→DE, Fehlersuche
   („was ist hier falsch?"), Schnellantwort auf eine Frage.
6. 20 Items, dann Schluss — auch wenn es gut läuft.

## Abschlussbericht

```
Drill 20 Items · 14 richtig (70 %)

#kasus/dativ         4/6   ← immer noch das Hauptproblem
#nebensatz           5/5   ✅ reif fürs Archiv
#adjektivdeklination 5/9   ← neu in den Top 3

Das Muster: <ein Satz, was ich strukturell falsch denke>
Nächster Schritt: <ein konkreter Vorschlag>
```

Dann: neue Fehler ins [Fehlerlog](../../00-State/fehlerlog.md), Tag-Zählung neu
berechnen, Drill-Zeile in [fortschritt.md](../../00-State/fortschritt.md).
Items mit 3× richtig in Folge ins Archiv verschieben.

Wortschatz-Items zusätzlich ins Deck zurückschreiben, damit die App den Stand kennt:

```bash
python3 07-DeutschCard/deck.py fail "Vertrag" --kind artikel   # falsch im Drill
python3 07-DeutschCard/deck.py pass "Vertrag"                  # richtig gewusst
```
