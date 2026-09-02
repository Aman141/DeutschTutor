---
description: Sprechtraining — Rollenspiel mit Audio, danach Aussprachekorrektur
argument-hint: [Situation, z.B. "Arzttermin" oder "Wohnungsbesichtigung"]
allowed-tools: Bash(say:*), Bash(ffmpeg:*), Bash(afplay:*), Read, Write, Edit, Glob, Grep
---

# /speak $ARGUMENTS

Sprechen. Nicht über Sprechen reden — sprechen.

## Situation

`$ARGUMENTS`, oder wenn leer: eine Situation aus den Zielen in
[profil.md](../../00-State/profil.md), die ich noch nicht geübt habe.

## Ablauf

**1 · Vorbereitung (3 Min).** Situation nennen, meine Rolle, dein Rolle, das Ziel des
Gesprächs. Dazu 6–8 Redemittel, die ich brauchen werde. Nicht mehr.

**2 · Hören zuerst.** Erzeuge deine erste Gesprächsrunde als Audio, damit ich sie höre
statt liest:

```bash
say -v Anna -r 150 --data-format=LEI16@22050 \
  -o "06-Audio/$(date +%F)-Rollenspiel-THEMA-01.wav" "Dein Text"
```

Tempo nach Niveau: A2 `-r 130`, B1 `-r 160`, Prüfung `-r 180`.
Gib mir den Pfad und **nicht** den Text — ich soll hören, nicht lesen.
Nur wenn ich zweimal nachfrage, gib die Transkription.

**3 · Das Gespräch.** 8–12 Runden. Du bleibst in der Rolle. Du korrigierst **nicht**
mitten im Gespräch — außer wenn ich unverständlich bin; dann nur: „Wie bitte?"
Bau Widerstand ein: der Termin ist belegt, die Wohnung ist teurer als gesagt, der
Kollege ist anderer Meinung. Ohne Widerstand lerne ich nichts.

**4 · Meine Aufnahme (optional).** Wenn ich eine eigene Aufnahme in
[06-Audio/Aufnahmen/](../../06-Audio/Aufnahmen/) ablege, hör sie an und beurteile
Aussprache und Flüssigkeit.

**5 · Auswertung.** Erst jetzt:

- **Verständlichkeit:** Hätte ein Muttersprachler alles verstanden? Wo nicht?
- **Fehler:** Tabelle wie in [CLAUDE.md](../../CLAUDE.md) beschrieben.
- **Aussprache** `#aussprache`: die drei Laute, die am meisten stören. Für jeden ein
  Minimalpaar zum Nachsprechen, als Audio erzeugt.
- **Natürlichkeit:** 3 Stellen, wo es korrekt aber steif war — mit der Version, die
  ein Muttersprachler benutzt.
- **Flüssigkeit:** wo ich gestockt habe und welches fehlende Redemittel schuld war.

**6 · Ablegen.** Lektionsdatei in [02-Lektionen/](../../02-Lektionen/) (Typ: Sprechen),
Fehler ins [Fehlerlog](../../00-State/fehlerlog.md), fehlende Redemittel als
`#flashcard` in [05-Vokabeln/](../../05-Vokabeln/), Zeit in
[fortschritt.md](../../00-State/fortschritt.md).
