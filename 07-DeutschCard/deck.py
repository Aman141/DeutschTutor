#!/usr/bin/env python3
"""deck.py — the bridge between the Deutsch vault and the DeutschCard app.

Source of truth is 05-Vokabeln/ops.jsonl: an append-only log of changes ("ops")
from every device — this CLI, the browser, later the phone. Replaying the log in
(at, id) order gives the deck; the same replay runs in the app (ops.js), so every
device that holds the same ops computes the same deck. Ops are never edited, only
appended, which is what makes offline devices safe to merge.

05-Vokabeln/deck.json and the Markdown files next to it are generated from the
log on every write — read them freely, never write them by hand.

Usage:
  deck.py add "Vertrag" --gender der --plural "Verträge" --en "contract" \
      --example "Ich habe den Vertrag unterschrieben." --tags B1,arbeit --source L-012
  deck.py fail "Vertrag" --kind artikel --tag "#genus" --source L-012
  deck.py pass "Vertrag"
  deck.py hard [-n 20] [--tag arbeit]
  deck.py due  [-n 20] [--days 3]
  deck.py stats
  deck.py sync-md            # rebuild deck.json + Markdown from the log
  deck.py import-md          # pull hand-written :: cards from 05-Vokabeln/*.md
  deck.py import-seed        # one-time: data/seed.json -> deck
"""

import argparse
import copy
import json
import os
import random
import re
import shutil
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

APP_DIR = os.path.dirname(os.path.abspath(__file__))
VAULT = os.path.dirname(APP_DIR)
VOKABELN = os.path.join(VAULT, "05-Vokabeln")
DECK = os.path.join(VOKABELN, "deck.json")
OPS = os.path.join(VOKABELN, "ops.jsonl")
DEVICE = os.environ.get("DEUTSCHCARD_DEVICE", "mac")
OP_TYPES = ("add", "edit", "delete", "review", "fail")
LEVELS = {"A1", "A2", "B1", "B2", "C1"}
KINDS = ("artikel", "plural", "bedeutung", "form", "praeposition", "rechtschreibung")

FIELDS = {
    "id": "", "german": "", "gender": "", "plural": "", "english": "",
    "example": "", "tags": [], "known": False, "difficulty": 0, "lastSeen": None,
    # vault extensions — the app treats these as optional
    "forms": "", "prep": "", "mistakes": 0, "mistakeKinds": [],
    "fehlerTags": [], "source": "", "added": None,
}


# ── op log ───────────────────────────────────────────────────────────────────
# One op per line. Every op has: id (unique), at (UTC ISO, ms precision — the
# replay order), device, op (one of OP_TYPES), card (card id). Payload by type:
#   add     data: {full card}       creates the card; ignored if the id exists
#   edit    data: {field: value}    later op wins, field by field
#   delete  —                       tombstone: the card stays gone
#   review  known, date             the app's Known / Still Learning buttons
#   fail    kind, tag, source, date a real mistake in a lesson
# Unknown op types are skipped, so an older client never chokes on a newer log.
# KEEP IN SYNC with ops.js — tests/fixtures/ pins both to the same output.

def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def make_op(op_type, card, at=None, **payload):
    return {"id": uuid.uuid4().hex, "at": at or now_iso(), "device": DEVICE,
            "op": op_type, "card": card, **payload}


def valid_op(o):
    return (isinstance(o, dict) and isinstance(o.get("id"), str) and o["id"]
            and isinstance(o.get("at"), str) and isinstance(o.get("card"), str)
            and o["card"] and isinstance(o.get("op"), str))


def read_ops():
    if not os.path.exists(OPS):
        return []
    ops = []
    with open(OPS, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            if not line.strip():
                continue
            try:
                ops.append(json.loads(line))
            except json.JSONDecodeError as e:
                sys.exit(f"ops.jsonl Zeile {n} ist beschädigt ({e}).")
    return ops


def append_ops(new):
    """Append ops to the log and regenerate deck.json + Markdown. Returns the deck."""
    os.makedirs(VOKABELN, exist_ok=True)
    with open(OPS, "a", encoding="utf-8") as f:
        for o in new:
            f.write(json.dumps(o, ensure_ascii=False) + "\n")
    words = replay(read_ops())
    save(words)
    return words


def card_from(data, op):
    out = {}
    for k, default in FIELDS.items():
        v = data.get(k)
        out[k] = copy.deepcopy(default) if v is None else copy.deepcopy(v)
    out["id"] = op["card"]
    out["added"] = out["added"] or op["at"][:10]
    return out


def apply_op(state, o):
    cards, order, deleted = state["cards"], state["order"], state["deleted"]
    cid, kind = o["card"], o["op"]
    if kind == "add":
        if cid not in cards and cid not in deleted:
            cards[cid] = card_from(o.get("data") or {}, o)
            order.append(cid)
        return
    w = cards.get(cid)
    if w is None:
        return
    if kind == "edit":
        for k, v in (o.get("data") or {}).items():
            if k in FIELDS and k != "id":
                w[k] = copy.deepcopy(v)
    elif kind == "delete":
        del cards[cid]
        order.remove(cid)
        deleted.add(cid)
    elif kind == "review":
        w["known"] = bool(o.get("known"))
        d = w["difficulty"] or 0
        w["difficulty"] = max(0, d - 1) if w["known"] else min(3, d + 1)
        w["lastSeen"] = o.get("date") or o["at"][:10]
    elif kind == "fail":
        w["mistakes"] = (w["mistakes"] or 0) + 1
        w["known"] = False
        w["difficulty"] = 3
        w["lastSeen"] = o.get("date") or o["at"][:10]
        if o.get("kind") and o["kind"] not in w["mistakeKinds"]:
            w["mistakeKinds"].append(o["kind"])
        if o.get("tag") and o["tag"] not in w["fehlerTags"]:
            w["fehlerTags"].append(o["tag"])
        if o.get("source"):
            w["source"] = o["source"]


def replay(ops):
    state = {"cards": {}, "order": [], "deleted": set()}
    unique = {}
    for o in ops:
        if valid_op(o):
            unique.setdefault(o["id"], o)   # a duplicate op id is applied once
    for o in sorted(unique.values(), key=lambda o: (o["at"], o["id"])):
        apply_op(state, o)
    return [state["cards"][cid] for cid in state["order"]]


def migrate_legacy():
    """First run after the switch: turn the old deck.json into one `add` per card.

    Cards keep their ids and full state (known, difficulty, mistakes …). Each gets
    its own millisecond so the replay keeps the old card order.
    """
    if os.path.exists(OPS) or not os.path.exists(DECK):
        return
    with open(DECK, encoding="utf-8") as f:
        try:
            old = json.load(f)
        except json.JSONDecodeError as e:
            sys.exit(f"deck.json ist beschädigt ({e}). Sichere Kopie: {DECK}.bak")
    if not old:
        return
    shutil.copy2(DECK, os.path.join(VOKABELN, "deck.pre-ops.json"))
    base = datetime.now(timezone.utc)
    ops = []
    for i, w in enumerate(old):
        w = normalise(w)
        at = (base + timedelta(milliseconds=i)).isoformat(timespec="milliseconds")
        ops.append(make_op("add", w["id"], at=at.replace("+00:00", "Z"), data=w))
    append_ops(ops)
    print(f"deck.json → ops.jsonl migriert ({len(ops)} Karten). "
          "Alte Datei: 05-Vokabeln/deck.pre-ops.json", file=sys.stderr)


# ── storage ──────────────────────────────────────────────────────────────────
def load():
    migrate_legacy()
    return replay(read_ops())


def normalise(w):
    out = {}
    for k, default in FIELDS.items():
        v = w.get(k, default)
        out[k] = list(default) if isinstance(default, list) and v is None else v
    if not out["id"]:
        out["id"] = new_id()
    if not out["added"]:
        out["added"] = date.today().isoformat()
    return out


def save(words, sync_md=True):
    """Write the generated views of the log. Only append_ops() should call this."""
    os.makedirs(VOKABELN, exist_ok=True)
    if os.path.exists(DECK):                      # keep one generation of backup
        os.replace(DECK, DECK + ".bak")
    tmp = DECK + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, DECK)
    if sync_md:
        write_markdown(words)


def new_id():
    return f"{int(datetime.now().timestamp() * 1000):x}{random.randrange(1 << 20):05x}"


def find(words, german):
    # "die Katze" -> "katze"; a char-set lstrip would eat into words like "Idee"
    needle = re.sub(r"^(?:der|die|das)\s+", "", german.strip().lower())
    exact = [w for w in words if w["german"].lower() == german.strip().lower()]
    if exact:
        return exact[0]
    part = [w for w in words if needle and needle in w["german"].lower()]
    if len(part) == 1:
        return part[0]
    if len(part) > 1:
        sys.exit("Mehrdeutig: " + ", ".join(w["german"] for w in part[:8]))
    return None


# ── markdown mirror ──────────────────────────────────────────────────────────
def card_line(w):
    head = f"{w['gender']} {w['german']}".strip()
    if w["plural"]:
        head += f", die {w['plural']}" if w["gender"] else f", {w['plural']}"
    if w["forms"]:
        head = f"{w['german']}, {w['forms']}"
    if w["prep"]:
        head = f"{w['german']} {w['prep']}"
    line = f"{head} :: {w['english']}"
    if w["example"]:
        line += f" — *{w['example']}*"
    marks = ""
    if w["mistakes"]:
        marks = f" `{'!' * min(w['mistakes'], 3)}`"
    return f"{line} #flashcard{marks}"


def topic_of(w):
    content = [t for t in w["tags"] if t not in LEVELS]
    return content[0] if content else "Allgemein"


def slug(name):
    table = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss", " ": "-"})
    return re.sub(r"[^\w-]", "", name.lower().translate(table)).strip("-") or "allgemein"


def write_markdown(words):
    groups = {}
    for w in words:
        groups.setdefault(topic_of(w), []).append(w)

    generated = set()
    for topic, cards in sorted(groups.items()):
        path = os.path.join(VOKABELN, f"{slug(topic)}.md")
        generated.add(os.path.basename(path))
        cards.sort(key=lambda w: (-w["mistakes"], -w["difficulty"], w["german"].lower()))
        hard = [w for w in cards if w["mistakes"] or w["difficulty"] >= 2]
        hard_ids = {w["id"] for w in hard}
        body = [
            "---",
            f"thema: {topic}",
            f"karten: {len(cards)}",
            f"generiert: {date.today().isoformat()}",
            "---",
            "",
            f"# {topic}",
            "",
            "> **Generierte Datei.** Quelle der Wahrheit ist `deck.json`.",
            "> Änderungen hier mit `deck.py import-md` einlesen, sonst gehen sie beim",
            "> nächsten Schreibvorgang verloren.",
            "",
        ]
        if hard:
            body += [f"## Problemkarten ({len(hard)})", "",
                     "> Hier habe ich echte Fehler gemacht. `!` = Anzahl.", ""]
            body += [card_line(w) for w in hard]
            body += ["", f"## Übrige ({len(cards) - len(hard)})", ""]
        body += [card_line(w) for w in cards if w["id"] not in hard_ids]
        body += [""]
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(body))
    return generated


# ── markdown -> deck (for hand-written cards) ────────────────────────────────
CARD_RE = re.compile(r"^(?P<head>.+?)\s*::\s*(?P<en>.+?)(?:\s+—\s*\*(?P<ex>.+?)\*)?\s*#flashcard")


def parse_head(head):
    head = head.strip()
    m = re.match(r"^(der|die|das)\s+(\S+)(?:,\s*(?:die\s+)?(.+))?$", head)
    if m:
        return {"gender": m.group(1), "german": m.group(2), "plural": (m.group(3) or "").strip()}
    m = re.match(r"^(\S+)\s+((?:über|auf|an|für|mit|von|zu|nach|in|um)\s*\(.+\))$", head)
    if m:
        return {"german": m.group(1), "prep": m.group(2)}
    if "," in head:
        first, rest = head.split(",", 1)
        return {"german": first.strip(), "forms": rest.strip()}
    return {"german": head}


def import_md():
    words = load()
    by_name = {w["german"].lower(): w for w in words}
    new = []
    for fn in sorted(os.listdir(VOKABELN)):
        if not fn.endswith(".md") or fn == "README.md":
            continue
        topic = None
        with open(os.path.join(VOKABELN, fn), encoding="utf-8") as f:
            for raw in f:
                if raw.startswith("thema:"):
                    topic = raw.split(":", 1)[1].strip()
                m = CARD_RE.match(raw.strip())
                if not m:
                    continue
                parts = parse_head(m.group("head"))
                if parts["german"].lower() in by_name:
                    continue
                card = normalise({
                    **parts,
                    "english": m.group("en").strip(),
                    "example": (m.group("ex") or "").strip(),
                    "tags": [topic or os.path.splitext(fn)[0]],
                })
                new.append(make_op("add", card["id"], data=card))
                by_name[card["german"].lower()] = card
    if new:
        words = append_ops(new)
    print(f"{len(new)} neue Karte(n) aus Markdown eingelesen · {len(words)} gesamt")


# ── commands ─────────────────────────────────────────────────────────────────
def cmd_add(a):
    words = load()
    if find(words, a.german):
        sys.exit(f"'{a.german}' ist schon im Deck. Nutze 'deck.py fail/pass' oder die App.")
    tags = [t.strip() for t in (a.tags or "").split(",") if t.strip()]
    card = normalise({
        "german": a.german, "gender": a.gender or "", "plural": a.plural or "",
        "english": a.en, "example": a.example or "", "tags": tags,
        "forms": a.forms or "", "prep": a.prep or "", "source": a.source or "",
    })
    words = append_ops([make_op("add", card["id"], data=card)])
    print(f"+ {card_line(card)}")
    print(f"  {len(words)} Karten im Deck")


def cmd_fail(a):
    """Ein echter Fehler im Unterricht — die Karte wird hochpriorisiert."""
    words = load()
    w = find(words, a.german)
    if not w:
        sys.exit(f"'{a.german}' nicht im Deck. Erst 'deck.py add'.")
    words = append_ops([make_op("fail", w["id"], kind=a.kind or "", tag=a.tag or "",
                                source=a.source or "", date=date.today().isoformat())])
    w = next(x for x in words if x["id"] == w["id"])
    kinds = ", ".join(w["mistakeKinds"]) or "—"
    print(f"✗ {w['gender']} {w['german']} · {w['mistakes']}. Fehler · Art: {kinds}")
    print("  → steht in der App jetzt vorn")


def cmd_pass(a):
    words = load()
    w = find(words, a.german)
    if not w:
        sys.exit(f"'{a.german}' nicht im Deck.")
    words = append_ops([make_op("review", w["id"], known=True, date=date.today().isoformat())])
    w = next(x for x in words if x["id"] == w["id"])
    print(f"✓ {w['german']} · difficulty {w['difficulty']}")


def priority(w):
    return (-w["mistakes"], -w["difficulty"], w["known"], w["lastSeen"] or "")


def cmd_hard(a):
    """Only cards with real evidence of difficulty.

    Deliberately excludes merely-unstudied cards: a fresh deck must return nothing,
    so /drill refuses instead of building a drill out of vocabulary the learner has
    never seen. Unstudied cards are `due`, not `hard`.
    """
    words = [w for w in load() if not a.tag or a.tag in w["tags"]]
    words = [w for w in words if w["mistakes"] or w["difficulty"] >= 2]
    words.sort(key=priority)
    show(words[: a.n], "Problemkarten")


def cmd_due(a):
    cutoff = (date.today() - timedelta(days=a.days)).isoformat()
    words = [w for w in load() if not w["lastSeen"] or w["lastSeen"] <= cutoff]
    words.sort(key=priority)
    show(words[: a.n], f"Fällig (nicht gesehen seit {a.days}+ Tagen)")


def show(words, title):
    if not words:
        print(f"{title}: keine.")
        return
    print(f"{title} — {len(words)}:\n")
    for w in words:
        flag = "!" * min(w["mistakes"], 3) or ("·" if w["known"] else " ")
        kinds = f"  [{', '.join(w['mistakeKinds'])}]" if w["mistakeKinds"] else ""
        head = f"{w['gender']} {w['german']}".strip()
        print(f"  {flag:<3} {head:<28} {w['english']:<24} d{w['difficulty']}{kinds}")


def cmd_stats(a):
    words = load()
    if not words:
        print("Deck ist leer. 'deck.py import-seed' oder 'deck.py add'.")
        return
    known = [w for w in words if w["known"]]
    problem = [w for w in words if w["mistakes"]]
    today = date.today().isoformat()
    print(f"Karten            {len(words)}")
    print(f"Gewusst           {len(known)}  ({round(100 * len(known) / len(words))} %)")
    print(f"Problemkarten     {len(problem)}  (echte Fehler im Unterricht)")
    print(f"Heute gesehen     {sum(1 for w in words if w['lastSeen'] == today)}")
    kinds = {}
    for w in problem:
        for k in w["mistakeKinds"]:
            kinds[k] = kinds.get(k, 0) + 1
    if kinds:
        print("\nFehlerarten:")
        for k, n in sorted(kinds.items(), key=lambda x: -x[1]):
            print(f"  {k:<16} {n}")
    tags = {}
    for w in words:
        for t in w["tags"]:
            d = tags.setdefault(t, [0, 0])
            d[0] += 1
            d[1] += 1 if w["known"] else 0
    print("\nNach Tag:")
    for t, (n, k) in sorted(tags.items()):
        print(f"  {t:<16} {k}/{n}")


def cmd_sync_md(a):
    words = load()
    save(words, sync_md=False)
    files = write_markdown(words)
    print(f"{len(words)} Karten → {len(files)} Datei(en) in 05-Vokabeln/")
    for f in sorted(files):
        print(f"  {f}")


def cmd_import_seed(a):
    seed_path = os.path.join(APP_DIR, "data", "seed.json")
    with open(seed_path, encoding="utf-8") as f:
        seed = json.load(f)
    words = load()
    have = {w["german"].lower() for w in words}
    added = [normalise(s) for s in seed if s["german"].lower() not in have]
    if added:
        words = append_ops([make_op("add", w["id"], data=w) for w in added])
    print(f"{len(added)} Karten aus seed.json übernommen · {len(words)} gesamt")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("add", help="Karte anlegen")
    a.add_argument("german")
    a.add_argument("--gender", choices=["der", "die", "das"])
    a.add_argument("--plural")
    a.add_argument("--en", required=True)
    a.add_argument("--example")
    a.add_argument("--tags", help="Komma-getrennt, z.B. B1,arbeit")
    a.add_argument("--forms", help="Verb: 'zog um, ist umgezogen'")
    a.add_argument("--prep", help="Verb mit Präposition: 'über (+Akk)'")
    a.add_argument("--source", help="Lektion, z.B. L-012")
    a.set_defaults(func=cmd_add)

    f = sub.add_parser("fail", help="Fehler im Unterricht protokollieren")
    f.add_argument("german")
    f.add_argument("--kind", choices=KINDS, help="Art des Fehlers")
    f.add_argument("--tag", help="Fehlerlog-Tag, z.B. '#genus'")
    f.add_argument("--source", help="Lektion, z.B. L-012")
    f.set_defaults(func=cmd_fail)

    g = sub.add_parser("pass", help="richtig gewusst")
    g.add_argument("german")
    g.set_defaults(func=cmd_pass)

    h = sub.add_parser("hard", help="Problemkarten für einen Drill")
    h.add_argument("-n", type=int, default=20)
    h.add_argument("--tag")
    h.set_defaults(func=cmd_hard)

    d = sub.add_parser("due", help="lange nicht gesehen")
    d.add_argument("-n", type=int, default=20)
    d.add_argument("--days", type=int, default=3)
    d.set_defaults(func=cmd_due)

    for name, fn, helptext in (
        ("stats", cmd_stats, "Überblick"),
        ("sync-md", cmd_sync_md, "deck.json + Markdown aus dem Log neu schreiben"),
        ("import-md", lambda a: import_md(), "handgeschriebene :: Karten einlesen"),
        ("import-seed", cmd_import_seed, "data/seed.json übernehmen"),
    ):
        s = sub.add_parser(name, help=helptext)
        s.set_defaults(func=fn)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
