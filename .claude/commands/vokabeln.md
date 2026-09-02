---
description: Vokabeltraining im Chat — fällige Karten abfragen, neue Karten anlegen
argument-hint: [Thema, z.B. "Wohnung", oder leer für fällige Karten]
allowed-tools: Bash(python3:*), Read, Write, Edit, Glob, Grep
---

# /vokabeln $ARGUMENTS

Abfrage **durch dich**, mündlich und mit Varianten — die App
([`/karten`](karten.md)) macht das stumpfe Wiederholen, du machst das, was eine
App nicht kann: Artikel erfragen, Sätze bilden lassen, Kollokationen prüfen.

Quelle ist immer das Deck, nie eine `.md`-Datei:
**[05-Vokabeln/deck.json](../../05-Vokabeln/deck.json)**

## Ohne Argument: abfragen

```bash
python3 07-DeutschCard/deck.py hard -n 20     # Problemkarten, echte Fehler zuerst
python3 07-DeutschCard/deck.py due --days 3   # lange nicht gesehen
```

Nimm 20 Karten: erst alles aus `hard`, den Rest aus `due`. Frag **nicht** nur
„Wort → Bedeutung", sondern rotiere die Form — und zwar gezielt die Form, in der
ich die Karte falsch hatte (`mistakeKinds` steht in der Ausgabe von `hard`):

| Form | Beispiel | prüft |
|---|---|---|
| DE → EN | *der Vertrag* → ? | `bedeutung` |
| EN → DE **mit Artikel** | contract → ? | `artikel` |
| Plural | *der Vertrag* → ? | `plural` |
| Verbformen | *umziehen* → Präteritum, Perfekt? | `form` |
| Präposition + Kasus | *sich beschweren* ___ ? | `praeposition` |
| Lücke | *Ich habe den ___ unterschrieben.* | Anwendung |
| Aktiv | Bilde einen Satz mit *kündigen*. | Produktion |
| Kollokation | Was macht man mit einem Vertrag? | Natürlichkeit |

**Artikel falsch = Karte falsch.** Plural fehlt = falsch.

Nach jeder Karte sofort ins Deck zurückschreiben:

```bash
python3 07-DeutschCard/deck.py fail "Vertrag" --kind artikel --tag "#genus"
python3 07-DeutschCard/deck.py pass "Vertrag"
```

Damit steht das Wort beim nächsten `/karten` in der App vorn — das ist die
Verbindung zwischen unserem Gespräch und meinem Kartentraining.

## Mit Argument: neue Karten zum Thema

15–20 Karten zu `$ARGUMENTS` anlegen. Eine Zeile pro Karte:

```bash
python3 07-DeutschCard/deck.py add "Mietvertrag" --gender der --plural "Mietverträge" \
  --en "lease" --example "Der Mietvertrag läuft zwei Jahre." --tags B1,wohnung
python3 07-DeutschCard/deck.py add "umziehen" --en "to move house" \
  --forms "zog um, ist umgezogen" --example "Wir ziehen im Mai um." --tags B1,wohnung
python3 07-DeutschCard/deck.py add "sich beschweren" --en "to complain" \
  --prep "über (+Akk)" --example "Sie beschwert sich über den Lärm." --tags B1,wohnung
```

Pflicht bei jeder Karte:

- Nomen: `--gender` **und** `--plural`. Ein Nomen ohne Artikel ist keine Vokabel.
- Verben: `--forms` mit Präteritum und Partizip II, bei *sein*-Verben mit `ist`.
- Verben mit fester Präposition: `--prep` mit Kasus, z. B. `"über (+Akk)"`.
- `--tags`: immer Niveau (`A1`–`B2`) **plus** ein Themen-Tag. Das Themen-Tag
  bestimmt, in welche `.md`-Datei die Karte gespiegelt wird und wonach ich in der
  App filtern kann.
- `--example`: ein Satz aus einer Situation, in der ich wirklich lande.
- `--source`: die Lektion, aus der das Wort kommt.

Keine Vokabeln, die ich nie brauche. Kein *der Elefant*, wenn ich zum Bürgeramt muss.

## Themen-Tags

Nach Situation bündeln, nicht alphabetisch — Wörter, die zusammen auftreten,
werden zusammen abgerufen:

`wohnung` `arzt` `arbeit` `behoerden` `einkaufen` `verkehr` `meinung` `konjunktiv2`

## Danach

- Falsche Karten mit `#wortschatz` ins
  [Fehlerlog](../../00-State/fehlerlog.md) (Falsch → Richtig → „Artikel"/„Plural"/
  „Bedeutung") — **und** per `deck.py fail` ins Deck.
- `python3 07-DeutschCard/deck.py stats` → Kartenzahlen in den Abschnitt „Wortschatz" in
  [fortschritt.md](../../00-State/fortschritt.md).
- Kurzbericht:
  `20 Karten · 15 richtig · Artikel 4× falsch (alle Feminina) · 5 Karten ins Deck zurück`
- Wenn ich lieber selbst wiederhole: `/karten` startet die App mit genau diesen
  Problemkarten vorn.
