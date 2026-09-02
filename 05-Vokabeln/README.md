# 05 · Vokabeln

## Die Quelle der Wahrheit ist `deck.json`

[deck.json](deck.json) ist das Deck. Zwei Dinge greifen darauf zu:

- die **Flashcard-App** in [../07-DeutschCard/](../07-DeutschCard/) — starten mit `/karten`
- **Frau Ritter** über `07-DeutschCard/deck.py`

Beide schreiben in dieselbe Datei. Deshalb sieht die App die Fehler, die ich im
Unterricht gemacht habe, und deshalb sieht Frau Ritter, was ich in der App gelernt
habe.

## Die `.md`-Dateien sind generiert

Jede andere Datei hier (`wohnung.md`, `arbeit.md`, …) wird aus `deck.json`
erzeugt, damit ich in Obsidian suchen, lesen und verlinken kann. **Nicht direkt
hineinschreiben** — beim nächsten Schreibvorgang wird sie überschrieben.

Habe ich doch von Hand Karten hineingeschrieben, dann einlesen statt verlieren:

```bash
python3 07-DeutschCard/deck.py import-md
```

Oben in jeder Datei stehen die **Problemkarten**: die Wörter, bei denen ich im
Unterricht echte Fehler gemacht habe, mit `!` nach Anzahl.

## Kartenformat im Spiegel

```
der Mietvertrag, die Mietverträge :: lease — *Der Mietvertrag läuft zwei Jahre.* #flashcard
umziehen, zog um, ist umgezogen :: to move house — *Wir ziehen im Mai um.* #flashcard
sich beschweren über (+Akk) :: to complain about — *Sie beschwert sich über den Lärm.* #flashcard
```

Nomen mit Artikel und Plural, Verben mit Präteritum und Partizip II, Verben mit
Präposition samt Kasus, immer ein Beispielsatz. Das ist keine Kosmetik: ohne
Artikel ist ein deutsches Nomen nicht gelernt.

Das `#flashcard`-Tag bleibt erhalten, damit das Obsidian-Plugin *Spaced Repetition*
die Karten weiterhin abfragen kann, wenn ich lieber in Obsidian bleibe.

## Befehle

```bash
python3 07-DeutschCard/deck.py stats            # Überblick
python3 07-DeutschCard/deck.py hard -n 20       # Problemkarten
python3 07-DeutschCard/deck.py due --days 3     # lange nicht gesehen
python3 07-DeutschCard/deck.py sync-md          # Spiegel neu schreiben
python3 07-DeutschCard/serve.py                 # App starten (= /karten)
```

`deck.json.bak` ist die letzte Fassung vor dem jüngsten Schreibvorgang — falls
etwas schiefgeht.

Erzeugt und abgefragt von `/vokabeln`, `/karten`, `/drill`, `/lesson`.
