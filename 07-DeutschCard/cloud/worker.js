// DeutschCard cloud relay — the same op protocol as serve.py, reachable when the
// Mac is off. It stores and hands out ops; it never computes or edits the deck.
//
//   GET    /api/ops?since=N   {ops, seq, more}  ops with seq > N, oldest first
//   POST   /api/ops           {ops: [...]}      insert the ones whose id is new
//   GET    /api/devices                         list devices        (admin)
//   POST   /api/devices       {name}            new device + token  (admin)
//   DELETE /api/devices/NAME                    revoke a device     (admin)
//
// Every /api request needs `Authorization: Bearer <device token>`. Everything else
// is the static app, served from the assets directory (07-DeutschCard/).

const MAX_BODY = 1 << 20;
const PAGE = 2000;          // ops per GET; clients keep pulling while `more`
const INSERT_CHUNK = 200;   // ops per INSERT, well under D1's statement size limit

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

// Same check as validOp() in ops.js and valid_op() in deck.py — keep all three
// identical, or a client will push ops the relay refuses forever.
const PRINTABLE = /^[\x21-\x7e]+$/;
function validOp(o) {
  return o !== null && typeof o === 'object' && !Array.isArray(o) &&
    typeof o.id === 'string' && o.id.length <= 64 && PRINTABLE.test(o.id) &&
    typeof o.at === 'string' && o.at.length <= 40 && PRINTABLE.test(o.at) &&
    typeof o.card === 'string' && o.card.length <= 64 && PRINTABLE.test(o.card) &&
    typeof o.op === 'string';
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function authenticate(request, env, ctx) {
  const m = (request.headers.get('Authorization') || '').match(/^Bearer\s+(\S+)$/);
  if (!m) return null;
  const hash = await sha256(m[1]);
  const device = await env.DB.prepare('SELECT name, admin FROM devices WHERE token_sha256 = ?')
    .bind(hash).first();
  if (device) {
    ctx.waitUntil(env.DB.prepare('UPDATE devices SET last_seen = ? WHERE name = ?')
      .bind(new Date().toISOString(), device.name).run());
  }
  return device;
}

async function maxSeq(env) {
  return (await env.DB.prepare('SELECT COALESCE(MAX(seq), 0) AS s FROM ops').first()).s;
}

async function getOps(url, env) {
  let since = Number.parseInt(url.searchParams.get('since') || '0', 10);
  if (!Number.isFinite(since)) return json({ error: 'since must be an integer' }, 400);
  let reset = false;
  if (since < 0 || since > await maxSeq(env)) { since = 0; reset = true; }  // log was replaced
  const { results } = await env.DB.prepare(
    'SELECT seq, body FROM ops WHERE seq > ? ORDER BY seq LIMIT ?').bind(since, PAGE).all();
  // epoch = id of the first op: a client whose stored epoch differs knows the
  // database was replaced, even if it is already longer than its cursor.
  const first = await env.DB.prepare('SELECT id FROM ops ORDER BY seq LIMIT 1').first();
  const out = {
    ops: results.map(r => JSON.parse(r.body)),
    seq: results.length ? results[results.length - 1].seq : since,
    more: results.length === PAGE,
    epoch: first ? first.id : null,
  };
  if (reset) out.reset = true;
  return json(out);
}

async function postOps(request, env, device) {
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_BODY) return json({ error: 'Empty or oversized body' }, 413);
  const text = await request.text();
  if (!text || text.length > MAX_BODY) return json({ error: 'Empty or oversized body' }, 400);
  let body;
  try { body = JSON.parse(text); } catch (e) { return json({ error: 'Invalid JSON' }, 400); }
  if (!body || !Array.isArray(body.ops)) return json({ error: 'Expected {ops: [...]}' }, 400);
  // Invalid ops are dropped, not refused: refusing the batch would make the
  // client retry the same chunk forever and stall its whole outbox.
  const ops = body.ops.filter(validOp);
  const rejected = body.ops.length - ops.length;
  // One statement per chunk: json_each unpacks the array inside SQLite, so a push
  // of hundreds of ops is a handful of queries, not hundreds.
  const now = new Date().toISOString();
  const stmts = [];
  for (let i = 0; i < ops.length; i += INSERT_CHUNK) {
    stmts.push(env.DB.prepare(
      `INSERT OR IGNORE INTO ops (id, body, device, received)
       SELECT json_extract(value, '$.id'), value, ?1, ?2 FROM json_each(?3)`
    ).bind(device.name, now, JSON.stringify(ops.slice(i, i + INSERT_CHUNK))));
  }
  const results = stmts.length ? await env.DB.batch(stmts) : [];
  const accepted = results.reduce((n, r) => n + (r.meta.changes || 0), 0);
  return json({ ok: true, accepted, rejected, seq: await maxSeq(env) });
}

async function devices(request, env, url) {
  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT name, admin, created, last_seen FROM devices ORDER BY created').all();
    return json({ devices: results });
  }
  if (request.method === 'POST' && url.pathname === '/api/devices') {
    let name;
    try { name = String((await request.json()).name || '').trim(); } catch { name = ''; }
    if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(name)) {
      return json({ error: 'name: 1–32 chars, a-z 0-9 -' }, 400);
    }
    const token = newToken();
    try {
      await env.DB.prepare('INSERT INTO devices (name, token_sha256, admin, created) VALUES (?, ?, 0, ?)')
        .bind(name, await sha256(token), new Date().toISOString()).run();
    } catch (e) {
      return json({ error: `Gerät '${name}' existiert schon` }, 409);
    }
    return json({ name, token });
  }
  if (request.method === 'DELETE') {
    const name = decodeURIComponent(url.pathname.slice('/api/devices/'.length));
    const row = await env.DB.prepare('SELECT admin FROM devices WHERE name = ?').bind(name).first();
    if (!row) return json({ error: `Kein Gerät '${name}'` }, 404);
    if (row.admin) return json({ error: 'Admin-Geräte lassen sich hier nicht entfernen' }, 409);
    await env.DB.prepare('DELETE FROM devices WHERE name = ?').bind(name).run();
    return json({ ok: true });
  }
  return json({ error: 'Method not allowed' }, 405);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      const device = await authenticate(request, env, ctx);
      if (!device) return json({ error: 'Nicht angemeldet — Einrichtungslink erneut öffnen' }, 401);
      if (url.pathname === '/api/ops') {
        if (request.method === 'GET') return await getOps(url, env);
        if (request.method === 'POST') return await postOps(request, env, device);
        return json({ error: 'Method not allowed' }, 405);
      }
      if (url.pathname === '/api/devices' || url.pathname.startsWith('/api/devices/')) {
        if (!device.admin) return json({ error: 'Nur Admin-Geräte' }, 403);
        return await devices(request, env, url);
      }
      return json({ error: 'Not found' }, 404);
    } catch (e) {
      console.error(e);                     // details in `wrangler tail`, not in the response
      return json({ error: 'Interner Fehler' }, 500);
    }
  },
};
