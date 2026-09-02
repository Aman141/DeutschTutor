---
description: Startet die DeutschCard-App im Browser, synchron mit dem Vault
argument-hint: [optional: Port, z.B. 8080]
allowed-tools: Bash(python3:*), Bash(pkill:*), Bash(lsof:*), Read, Glob, Grep
---

# /karten $ARGUMENTS

Starte die Flashcard-App. Sie liest und schreibt
[05-Vokabeln/deck.json](../../05-Vokabeln/deck.json) — dieselbe Datei, aus der
Frau Ritter arbeitet.

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

## Starten

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
- Das Abzeichen oben rechts zeigt `Vault`, wenn geschrieben wird — bei `Offline`
  läuft `serve.py` nicht und alles bleibt im Browser hängen.

## Danach

Wenn ich die App schließe (Strg-C im Server), lies das Ergebnis und berichte:

```bash
python3 07-DeutschCard/deck.py stats
python3 07-DeutschCard/deck.py hard -n 10
```

Trag die Sitzung in [fortschritt.md](../../00-State/fortschritt.md) ein
(Kartenzahlen im Abschnitt „Wortschatz"). Karten, die ich in der App wiederholt
als „Still Learning" markiert habe, sind Kandidaten für den nächsten `/drill` —
nenn sie mir.
