-- DeutschCard relay. Apply with:
--   npx wrangler@4 d1 execute deutschcard --remote --file schema.sql

-- The op log. `seq` is the cursor clients pull after; `id` makes pushes idempotent.
-- `seq` can have gaps (an ignored duplicate still uses a number) — clients only
-- ever ask for `seq > N`, so gaps are harmless.
CREATE TABLE IF NOT EXISTS ops (
  seq      INTEGER PRIMARY KEY AUTOINCREMENT,
  id       TEXT NOT NULL UNIQUE,
  body     TEXT NOT NULL,          -- the op as JSON, exactly as the client sent it
  device   TEXT NOT NULL,          -- authenticated device that pushed it first
  received TEXT NOT NULL
);

-- One row per device. Only the SHA-256 of a token is stored, never the token.
CREATE TABLE IF NOT EXISTS devices (
  name         TEXT PRIMARY KEY,
  token_sha256 TEXT NOT NULL UNIQUE,
  admin        INTEGER NOT NULL DEFAULT 0,   -- may add and revoke devices
  created      TEXT NOT NULL,
  last_seen    TEXT
);
