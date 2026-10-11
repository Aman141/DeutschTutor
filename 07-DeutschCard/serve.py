#!/usr/bin/env python3
"""serve.py — serves DeutschCard and syncs its op log with the vault.

Plain `python3 -m http.server` can only serve files, so the app's changes would
stay trapped in the browser. This adds an op endpoint that exchanges changes with
05-Vokabeln/ops.jsonl, the log deck.py writes too (see deck.py for the op format):

    GET  /api/ops?since=N  -> {"ops": [...], "seq": M}  ops after the first N
    POST /api/ops          <- {"ops": [...]}            append the ones not seen yet

The cursor is an op count: the log is append-only, so the first N never change.
Sending an op twice is harmless — duplicates (by id) are dropped. Nothing here can
overwrite or empty the deck, which is the point: the browser, the tutor's CLI and
later the phone can each work offline and merge when they meet.

Study results therefore land in the vault, where Frau Ritter can read them, and
vocabulary mistakes she logs with deck.py show up in the app on the next sync.

    python3 07-DeutschCard/serve.py [--port 8080] [--no-open]

Stdlib only, no dependencies — same as the app itself.
"""

import argparse
import json
import os
import socket
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import deck  # noqa: E402  (same directory)

APP_DIR = deck.APP_DIR
MAX_BODY = 8 * 1024 * 1024
WRITE_LOCK = threading.Lock()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=APP_DIR, **kw)

    # ── endpoints ────────────────────────────────────────────────────────────
    def do_GET(self):
        path, _, query = self.path.partition("?")
        if path == "/api/ops":
            params = parse_qs(query)
            try:
                since = int(params.get("since", ["0"])[0])
            except ValueError:
                return self.send_json({"error": "since must be an integer"}, 400)
            try:
                ops = deck.read_ops()
            except SystemExit as e:
                return self.send_json({"error": str(e)}, 500)
            # A cursor past the end means the log was replaced — start over.
            if since < 0 or since > len(ops):
                return self.send_json({"ops": ops, "seq": len(ops), "reset": True})
            return self.send_json({"ops": ops[since:], "seq": len(ops)})
        return super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/api/deck":
            # Pre-op-log app versions posted the whole deck; that is what lost data.
            return self.send_json({"error": "Veraltete App-Version — Seite neu laden"}, 410)
        if path != "/api/ops":
            return self.send_error(404, "Unknown endpoint")
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return self.send_json({"error": "Bad Content-Length"}, 400)
        if length <= 0 or length > MAX_BODY:
            return self.send_json({"error": "Empty or oversized body"}, 400)
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            return self.send_json({"error": f"Invalid JSON: {e}"}, 400)
        ops = body.get("ops") if isinstance(body, dict) else None
        if not isinstance(ops, list) or not all(deck.valid_op(o) for o in ops):
            return self.send_json({"error": "Expected {ops: [...]} with id, at, op, card"}, 400)
        with WRITE_LOCK:
            have = {o["id"] for o in deck.read_ops()}
            new = []
            for o in ops:
                if o["id"] not in have:
                    have.add(o["id"])
                    new.append(o)
            if new:
                deck.append_ops(new)
            seq = len(deck.read_ops())
        return self.send_json({"ok": True, "accepted": len(new), "seq": seq})

    # ── helpers ──────────────────────────────────────────────────────────────
    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
        self.wfile.write(body)

    def end_headers(self):
        if self.path.endswith((".js", ".css", ".html", "/")):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        msg = fmt % args
        if "/api/ops" in msg and "POST" in msg:
            print("  ↳ Änderungen gespeichert → 05-Vokabeln/ops.jsonl")
        elif " 4" in msg or " 5" in msg:
            print(f"  ! {msg}")


def free_port(start, tries=20):
    for port in range(start, start + tries):
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    sys.exit(f"Kein freier Port zwischen {start} und {start + tries}.")


def main():
    p = argparse.ArgumentParser(description="DeutschCard mit Vault-Sync starten")
    p.add_argument("--port", type=int, default=8080)
    p.add_argument("--no-open", action="store_true", help="Browser nicht öffnen")
    args = p.parse_args()

    words = deck.load()
    if not words:
        print("Deck ist leer — übernehme data/seed.json …")
        deck.cmd_import_seed(None)
        words = deck.load()

    port = free_port(args.port)
    url = f"http://localhost:{port}"
    problem = [w for w in words if w["mistakes"]]

    print(f"""
  DeutschCard   {url}
  ─────────────────────────────────────────────
  Deck          05-Vokabeln/ops.jsonl  (deck.json wird daraus erzeugt)
  Karten        {len(words)}
  Problemkarten {len(problem)}{'  <- stehen beim Lernen vorn' if problem else ''}

  Alles, was du in der App tust, landet im Log und damit im Vault.
  Beenden mit Strg-C.
""")
    if not args.no_open:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
    except KeyboardInterrupt:
        after = deck.load()
        known = sum(1 for w in after if w["known"])
        print(f"\n  Gestoppt. {known}/{len(after)} Karten als gewusst markiert.")
        print("  Frau Ritter liest den Stand beim nächsten /vokabeln oder /drill.\n")


if __name__ == "__main__":
    main()
