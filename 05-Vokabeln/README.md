# 05 · Vokabeln

## Die Quelle der Wahrheit ist `ops.jsonl`

`ops.jsonl` ist ein Protokoll: jede Änderung am Deck ist eine Zeile, angehängt und
nie überschrieben. Zwei Dinge schreiben hinein:

- die **Flashcard-App** in [../07-DeutschCard/](../07-DeutschCard/) — starten mit `/karten`
- **Frau Ritter** über `07-DeutschCard/deck.py`

Deshalb sieht die App die Fehler, die ich im Unterricht gemacht habe, und deshalb
sieht Frau Ritter, was ich in der App gelernt habe — und keiner überschreibt die
Änderungen des anderen, auch wenn die App eine Weile offline war.

[deck.json](deck.json) ist das daraus berechnete Deck: zum Lesen, nach jedem
Schreibvorgang neu erzeugt.

## Die `.md`-Dateien sind generiert

Jede andere Datei hier (`wohnung.md`, `arbeit.md`, …) wird aus dem Protokoll
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
python3 07-DeutschCard/deck.py sync-md          # deck.json + Spiegel neu schreiben
python3 07-DeutschCard/serve.py                 # App starten (= /karten)
```

`deck.json` lässt sich jederzeit mit `deck.py sync-md` neu erzeugen. Wichtig zum
Sichern ist nur `ops.jsonl`. `deck.pre-ops.json` ist das alte Deck von vor der
Umstellung auf das Protokoll.

Erzeugt und abgefragt von `/vokabeln`, `/karten`, `/drill`, `/lesson`.
