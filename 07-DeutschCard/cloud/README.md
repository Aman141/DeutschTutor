# DeutschCard relay (Cloudflare)

`serve.py` only works while the Mac is on. The relay is the same thing in the
cloud: a Cloudflare Worker that serves the app and stores the op log in a D1
database, so the phone can study and sync when the Mac is off. It runs on the free
plan.

```
 phone (installed web app) ─┐                         ┌─ deck.py (Mac)
 browser anywhere ──────────┼─ https://deutschcard.…  ─┤   auto-syncs around every
                            │   Worker + D1 (ops)      │   command, or `deck.py sync`
                            └──────────────────────────┘
```

The relay stores ops and hands them out. It never computes the deck: every device
replays the log itself (`ops.js`, `deck.py`). The protocol is `serve.py`'s, plus
a device token:

| Endpoint | |
|---|---|
| `GET /api/ops?since=N` | `{ops, seq, more}`: ops with seq > N; keep pulling while `more` |
| `POST /api/ops` | `{ops: [...]}`: inserts the ops whose id is new |
| `GET / POST /api/devices`, `DELETE /api/devices/NAME` | device management (admin token only) |

Every `/api` request needs `Authorization: Bearer <token>`. The database stores
only each token's SHA-256. The app's files are public, but they contain no data.

## Set up (once)

From `07-DeutschCard/cloud/`, logged in with `npx wrangler@4 login`:

```bash
npx wrangler@4 d1 create deutschcard            # prints a database_id
cp wrangler.example.toml wrangler.toml          # paste the id in; the file is gitignored
npx wrangler@4 d1 execute deutschcard --remote --file schema.sql
npx wrangler@4 deploy                           # prints https://deutschcard.<you>.workers.dev
```

Then, from the vault root:

```bash
python3 07-DeutschCard/cloud/bootstrap.py https://deutschcard.<you>.workers.dev
python3 07-DeutschCard/deck.py sync             # uploads the deck
python3 07-DeutschCard/deck.py device add phone # prints the phone's setup link
```

`bootstrap.py` creates the Mac as the admin device and saves its token in
`05-Vokabeln/sync.json` (gitignored, mode 600). Open the setup link on the phone
once. The token is in the part after `#`, which browsers never send to a server.
The app stores it and removes it from the address bar.

## Day to day

- `deck.py` syncs by itself: it pulls before every command and pushes after
  `add`, `fail` and `pass`. Offline it prints one line and carries on. Set
  `DEUTSCHCARD_OFFLINE=1` to skip syncing.
- `deck.py device list` shows when each device last synced. `deck.py device revoke
  phone` disables a lost phone's token. Changes it had not sent yet are lost; its
  local copy keeps them until it gets a new link.
- After changing the app or the worker: `npx wrangler@4 deploy` from this directory.

## Local testing

`wrangler dev` keeps its local database inside the directory it serves unless
told otherwise, and then reloads itself on every write. Keep that state outside
the app folder:

```bash
S=~/.cache/deutschcard-wrangler
npx wrangler@4 d1 execute deutschcard --local --persist-to $S --file schema.sql
npx wrangler@4 dev --local --port 8787 --persist-to $S
```

Then, from the root of a **scratch copy** of the vault:

```bash
python3 07-DeutschCard/cloud/bootstrap.py http://localhost:8787 --local
```

`bootstrap.py` writes `05-Vokabeln/sync.json` next to the `deck.py` it runs
with. Do this in a copy of the vault, or move your real `sync.json` aside first.
