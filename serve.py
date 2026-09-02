#!/usr/bin/env python3
"""serve.py — serves DeutschCard and syncs its deck to the vault.

Plain `python3 -m http.server` can only serve files, so the app's data would stay
trapped in the browser's localStorage. This adds two endpoints that let the app
read and write 05-Vokabeln/deck.json, which makes the link bidirectional:

    GET  /api/deck   -> the deck on disk (the vault's copy wins on load)
    POST /api/deck   -> save the deck + regenerate the Markdown mirror

Study results therefore land in the vault, where Frau Ritter can read them, and
vocabulary mistakes she logs with deck.py show up in the app on next load.

    python3 07-Karten/serve.py [--port 8080] [--no-open]

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
        if self.path.split("?")[0] == "/api/deck":
            try:
                words = deck.load()
            except SystemExit as e:
                return self.send_json({"error": str(e)}, 500)
            return self.send_json(words)
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] != "/api/deck":
            return self.send_error(404, "Unknown endpoint")
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return self.send_json({"error": "Bad Content-Length"}, 400)
        if length <= 0 or length > MAX_BODY:
            return self.send_json({"error": "Empty or oversized body"}, 400)
        try:
            words = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            return self.send_json({"error": f"Invalid JSON: {e}"}, 400)
        if not isinstance(words, list):
            return self.send_json({"error": "Expected a JSON array of cards"}, 400)
        if not all(isinstance(w, dict) and w.get("german") for w in words):
            return self.send_json({"error": "Every card needs a 'german' field"}, 400)
        # Refuse to blow the deck away: a bug in the browser must not empty the vault.
        if deck.load() and not words:
            return self.send_json({"error": "Refused: would delete all cards"}, 409)
        with WRITE_LOCK:
            deck.save([deck.normalise(w) for w in words])
        return self.send_json({"ok": True, "count": len(words)})

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
        if "/api/deck" in msg and "POST" in msg:
            print("  ↳ Deck gespeichert → 05-Vokabeln/deck.json")
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
  Deck          05-Vokabeln/deck.json
  Karten        {len(words)}
  Problemkarten {len(problem)}{'  <- stehen beim Lernen vorn' if problem else ''}

  Alles, was du in der App tust, landet in deck.json und damit im Vault.
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
