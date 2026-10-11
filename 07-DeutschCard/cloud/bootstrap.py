#!/usr/bin/env python3
"""bootstrap.py — create this Mac's admin device on the relay, once.

Every /api call needs a device token, so the first one cannot come from the API.
This writes it straight into D1 with wrangler (only the SHA-256 goes there) and
saves the token in 05-Vokabeln/sync.json, where `deck.py sync` finds it. Further
devices come from `deck.py device add NAME`.

    python3 07-DeutschCard/cloud/bootstrap.py https://deutschcard.NAME.workers.dev
    python3 07-DeutschCard/cloud/bootstrap.py http://localhost:8787 --local   # wrangler dev

It does not sync. Run `deck.py sync` afterwards to upload the deck.
"""

import argparse
import hashlib
import os
import re
import secrets
import subprocess
import sys
from datetime import datetime, timezone

CLOUD = os.path.dirname(os.path.abspath(__file__))
# wrangler dev keeps its local D1 here, outside 07-DeutschCard/: inside the assets
# directory every database write would make `wrangler dev` reload itself.
LOCAL_STATE = os.path.expanduser("~/.cache/deutschcard-wrangler")
sys.path.insert(0, os.path.dirname(CLOUD))
import deck  # noqa: E402


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("url", help="relay address")
    p.add_argument("--name", default="mac", help="device name (default: mac)")
    p.add_argument("--local", action="store_true", help="the wrangler dev database, not the deployed one")
    p.add_argument("--persist-to", default=LOCAL_STATE, help="with --local: wrangler dev state dir")
    a = p.parse_args()

    url = deck.check_relay_url(a.url)
    if deck.read_conf():
        sys.exit(f"{deck.SYNC_CONF} existiert schon. Erst entfernen, wenn du wirklich neu anfangen willst.")
    if not os.path.exists(os.path.join(CLOUD, "wrangler.toml")):
        sys.exit("cloud/wrangler.toml fehlt — siehe cloud/README.md.")

    # Same rule as the worker. With it, and digest/now generated here, inlining the
    # values into the SQL below is safe.
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,31}", a.name):
        sys.exit("--name: 1–32 Zeichen, a-z 0-9 -")
    token = secrets.token_urlsafe(32)
    digest = hashlib.sha256(token.encode()).hexdigest()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    sql = (f"INSERT INTO devices (name, token_sha256, admin, created) "
           f"VALUES ('{a.name}', '{digest}', 1, '{now}')")
    cmd = ["npx", "--yes", "wrangler@4", "d1", "execute", "deutschcard", "--command", sql]
    cmd += ["--local", "--persist-to", a.persist_to] if a.local else ["--remote"]
    r = subprocess.run(cmd, cwd=CLOUD, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"wrangler fehlgeschlagen:\n{r.stdout}\n{r.stderr}")

    deck.write_conf({"url": url, "token": token})
    print(f"Admin-Gerät '{a.name}' angelegt, Token in {os.path.relpath(deck.SYNC_CONF)}.")
    print("Nächster Schritt: python3 07-DeutschCard/deck.py sync   (lädt das Deck hoch)")


if __name__ == "__main__":
    main()
