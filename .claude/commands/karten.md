---
description: Startet die DeutschCard-App im Browser, synchron mit dem Vault
argument-hint: [optional: Port, z.B. 8080]
allowed-tools: Bash(python3:*), Bash(pkill:*), Bash(lsof:*), Read, Glob, Grep
---

# /karten $ARGUMENTS

Starte die Flashcard-App. Sie tauscht Änderungen mit `05-Vokabeln/ops.jsonl` aus —
demselben Protokoll, in das Frau Ritter mit `deck.py` schreibt; daraus entsteht
[05-Vokabeln/deck.json](../../05-Vokabeln/deck.json).

## Vorher: Fehler des Tages in das Deck schieben

Bevor du den Server startest, schau in
[00-State/fehlerlog.md](../../00-State/fehlerlog.md) nach `#wortschatz`-Einträgen
der letzten Session, die noch nicht im Deck vermerkt sind, und trag sie nach:

```bash
python3 07-DeutschCard/deck.py fail "Vertrag" --kind artikel --tag "#genus" --source L-012
```

`--kind` ist eines von: `artikel` `plural` `bedeutung` `form` `praeposition`
`rechtschreibung`. Wörter, die noch gar nicht im Deck sind, vorher anlegen:

```bash
python3 07-DeutschCard/deck.py add "Vertrag" --gender der --plural "Verträge" \
  --en "contract" --example "Ich habe den Vertrag unterschrieben." \
  --tags B1,arbeit --source L-012
```

## Welche App?

**Ist das Cloud-Relay eingerichtet** (`05-Vokabeln/sync.json` existiert), läuft die
App dort — auf dem Handy installiert, am Laptop im Browser, auch wenn der Mac aus
ist. Dann brauchst du keinen Server zu starten. Gleiche vorher ab und nenn mir die
Adresse:

```bash
python3 07-DeutschCard/deck.py sync
python3 -c "import json; print(json.load(open('05-Vokabeln/sync.json'))['url'])"
```

**Lies `sync.json` nie ganz und gib nie den `token` aus** — er ist das Passwort des
Macs für das Relay. Ein neuer Browser oder ein neues Handy braucht ein eigenes Gerät:
`python3 07-DeutschCard/deck.py device add NAME` erzeugt den Einrichtungslink. Schreib
ihn in eine Datei statt in den Chat, lesbar nur für mich:
`(umask 077; python3 07-DeutschCard/deck.py device add NAME | grep -o 'https://[^ ]*' > 05-Vokabeln/NAME-link.txt)`
— und sag mir, dass ich die Datei nach dem Öffnen löschen soll.

**Ohne Relay** (oder zum Arbeiten am Mac ohne Internet) startest du den lokalen
Server:

```bash
python3 07-DeutschCard/serve.py
```

Mit Port: `python3 07-DeutschCard/serve.py --port $ARGUMENTS`
Ohne Browser: `--no-open`

**Starte den Server im Hintergrund**, damit ich weiterarbeiten kann, und sag mir
die URL. Wenn der Port belegt ist, nimmt `serve.py` selbst den nächsten freien —
lies die Adresse aus der Ausgabe, statt sie zu raten.

Läuft schon einer? `lsof -ti :8080` bzw. beenden mit `pkill -f serve.py`.

## Was ich in der App sehe

- **Problemkarten stehen vorn.** Die Lernreihenfolge ist nicht die Deck-Reihenfolge:
  erst Karten mit echten Unterrichtsfehlern, dann schwere, dann unbekannte, dann die
  am längsten nicht gesehenen.
- Auf der Rückseite steht bei solchen Karten, **wie oft und auf welche Art** ich das
  Wort falsch hatte.
- Auf dem Handy: Karte umdrehen, dann **nach rechts wischen = gewusst, nach links =
  noch nicht**. 🔈 liest das Wort mit Artikel vor.
- Das Abzeichen oben rechts zeigt `Vault`, wenn alles synchron ist. `3 offen`
  heißt: drei Änderungen warten im Browser und werden gesendet, sobald `serve.py`
  erreichbar ist — nichts geht verloren. Die App holt alle 60 Sekunden neue
  Fehler ab, die Frau Ritter mit `deck.py fail` einträgt.

## Danach

Wenn ich sage, dass ich fertig bin (oder Strg-C im Server), lies das Ergebnis und
berichte:

```bash
python3 07-DeutschCard/deck.py stats
python3 07-DeutschCard/deck.py hard -n 10
python3 07-DeutschCard/deck.py activity --days 1    # wie lange, auf welchem Gerät
```

Trag die Sitzung in [fortschritt.md](../../00-State/fortschritt.md) ein
(Kartenzahlen im Abschnitt „Wortschatz", die Minuten aus `activity` als Lernzeit). Karten, die ich in der App wiederholt
als „Still Learning" markiert habe, sind Kandidaten für den nächsten `/drill` —
nenn sie mir.
