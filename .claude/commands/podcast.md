---
description: Hörverstehen — erzeugt einen deutschen Dialog als WAV mit mehreren Stimmen
argument-hint: [Thema] [optional: Länge in Minuten]
allowed-tools: Bash(say:*), Bash(ffmpeg:*), Bash(afplay:*), Bash(mkdir:*), Bash(rm:*), Read, Write, Edit, Glob, Grep
---

# /podcast $ARGUMENTS

Ein echtes Hörstück, nicht ein Text zum Mitlesen. **Erst hören, dann sehen.**

## Bauen

**1 · Skript.** Dialog oder Gespräch mit 2–3 Sprechern über `$ARGUMENTS` (wenn leer:
ein Alltagsthema, das zu meinen Zielen passt). Länge: Standard 3 Min ≈ 450 Wörter.

Anforderungen an das Skript:
- Sprache auf meinem Niveau + einen Schritt, aber **natürlich**: Einwürfe, Abbrüche,
  *also, ja, na ja, eigentlich, halt, ne?*
- Die Struktur des aktuellen Moduls muss mehrfach vorkommen — unauffällig.
- 5–8 neue Wörter, aus dem Kontext erschließbar.
- Ein Handlungsbogen: Konflikt, nicht nur Informationsaustausch.

**2 · Stimmen.** Pro Sprecher eine andere: `Anna`, `Reed`, `Sandy`, `Rocko`, `Shelley`,
`Eddy`, `Flo`, `Grandma`, `Grandpa`.

**3 · Rendern** — jede Replik einzeln, dann zusammenfügen:

```bash
D="06-Audio/tmp-$$"; mkdir -p "$D"
say -v Anna -r 155 --data-format=LEI16@22050 -o "$D/001.wav" "Erste Replik"
say -v Reed -r 155 --data-format=LEI16@22050 -o "$D/002.wav" "Zweite Replik"
# ... weiter fortlaufend
for f in "$D"/*.wav; do echo "file '$(basename "$f")'" >> "$D/liste.txt"; done
ffmpeg -y -f concat -safe 0 -i "$D/liste.txt" -c copy \
  "06-Audio/$(date +%F)-Podcast-THEMA.wav" && rm -rf "$D"
```

Für Pausen zwischen Sprechern:
`ffmpeg -f lavfi -i anullsrc=r=22050:cl=mono -t 0.4 -c:a pcm_s16le "$D/pause.wav"`
und in die Liste einfügen.

Zwei Fassungen sind Gold wert: `-r 130` (langsam) und `-r 175` (echtes Tempo).
Erzeuge beide, gib mir zuerst die schnelle.

## Aufgaben (gib sie mit der Audiodatei, ohne Transkript)

1. **Globalverstehen** — 2 Fragen: Worum geht es? Wie ist die Stimmung?
2. **Detailverstehen** — 5 Fragen, richtig/falsch oder Multiple Choice.
3. **Selektives Hören** — 4 Zahlen/Namen/Uhrzeiten heraushören.
4. **Wortschatz aus dem Kontext** — 4 Wörter: Was heißt das wohl? Nicht nachschauen.
5. **Nachsprechen** — ein Satz aus dem Dialog, den ich mit Intonation wiederhole.

Regel: **Zweimal hören, dann antworten.** Transkript erst nach meinen Antworten.

## Danach

- Transkript in `02-Lektionen/L-NNN-...-Hoeren-Thema.md`, mit Zeitmarken pro Sprecher.
- Neue Wörter als `#flashcard` in [05-Vokabeln/](../../05-Vokabeln/).
- Was ich nicht verstanden habe: mit `#hoerverstehen` ins
  [Fehlerlog](../../00-State/fehlerlog.md) — und die Ursache benennen
  (Tempo? Wort? Verschleifung? Struktur?).
- Audiopfad in der Lektionsdatei verlinken, Zeit in
  [fortschritt.md](../../00-State/fortschritt.md).
