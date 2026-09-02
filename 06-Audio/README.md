# 06 · Audio

`JJJJ-MM-TT-Thema.wav` — von Frau Ritter erzeugt.
[Aufnahmen/](Aufnahmen/) — meine eigenen Sprachaufnahmen, für Aussprachekorrektur.

## Erzeugen (macOS `say`)

```bash
say -v Anna -r 155 --data-format=LEI16@22050 -o "06-Audio/2026-09-02-Thema.wav" "Text"
```

Deutsche Stimmen auf diesem Rechner: **Anna, Eddy, Flo, Grandma, Grandpa, Reed,
Rocko, Sandy, Shelley** — genug für mehrstimmige Dialoge.
Alle prüfen: `say -v '?' | grep de_DE`

Sprechtempo: A2 `-r 130` · B1 `-r 160` · Prüfungstempo `-r 180`

## Dialoge zusammenfügen

```bash
ffmpeg -y -f concat -safe 0 -i liste.txt -c copy ausgabe.wav
```

`liste.txt` enthält pro Zeile `file '001.wav'` in Reihenfolge.
Pause erzeugen:
```bash
ffmpeg -f lavfi -i anullsrc=r=22050:cl=mono -t 0.4 -c:a pcm_s16le pause.wav
```

## Selbst aufnehmen

macOS Sprachmemos, oder:
```bash
ffmpeg -f avfoundation -i ":0" -t 60 -ar 22050 -ac 1 "06-Audio/Aufnahmen/2026-09-02-Vorstellung.wav"
```
(Mikrofon-Index prüfen mit `ffmpeg -f avfoundation -list_devices true -i ""`.)

## Abspielen

```bash
afplay "06-Audio/2026-09-02-Thema.wav"
afplay -r 0.8 "..."   # langsamer, zum Nachsprechen
```

Erzeugt von `/speak`, `/podcast` und dem Hörteil von `/exam`.
