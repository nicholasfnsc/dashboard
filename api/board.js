import { createPool } from '@vercel/postgres';

/* ============================================================
   api/board.js — the shared store

   One hub, many boards. A board is one offer with one sales team,
   one key, and its own walled-off data: every call, every roster
   entry and every setting carries the key of the board it belongs
   to, and nothing is ever read without scoping to one.

   Runs on Vercel's servers. The connection string stays here and
   never reaches a browser.
   ============================================================ */

function findConnection() {
  const known = [
    'POSTGRES_URL', 'DATABASE_URL', 'STORAGE_URL',
    'POSTGRES_PRISMA_URL', 'POSTGRES_URL_NON_POOLING'
  ];
  for (const name of known) {
    if (process.env[name]) return process.env[name];
  }
  const looksRight = (v) => typeof v === 'string' && /^postgres(ql)?:\/\//.test(v);
  const names = Object.keys(process.env).filter((n) => looksRight(process.env[n]));
  const pooled = names.find((n) => !/UNPOOLED|NON_POOLING/i.test(n));
  return process.env[pooled || names[0]] || '';
}

const CONNECTION = findConnection();

/* No I, O, 0 or 1 — they get misheard and mistyped when a key is read
   out over a call. */
const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const KEY_LENGTH = 4;

function newKey() {
  let key = '';
  for (let i = 0; i < KEY_LENGTH; i++) {
    key += KEY_ALPHABET[Math.floor(Math.random() * KEY_ALPHABET.length)];
  }
  return key;
}

let pool = null;
let ready = false;

function db() {
  if (!pool) pool = createPool({ connectionString: CONNECTION });
  return pool;
}

async function ensureTables() {
  if (ready) return;
  const client = db();

  await client.sql`
    CREATE TABLE IF NOT EXISTS boards (
      key        TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await client.sql`
    CREATE TABLE IF NOT EXISTS calls (
      id         TEXT PRIMARY KEY,
      board_key  TEXT,
      call_date  DATE,
      outcome    TEXT,
      data       JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await client.sql`
    CREATE TABLE IF NOT EXISTS team (
      board_key  TEXT NOT NULL DEFAULT '',
      name       TEXT NOT NULL,
      role       TEXT NOT NULL,
      rate       NUMERIC NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (board_key, name, role)
    )`;
  await client.sql`
    CREATE TABLE IF NOT EXISTS settings (
      board_key TEXT NOT NULL DEFAULT '',
      key       TEXT NOT NULL,
      value     JSONB,
      PRIMARY KEY (board_key, key)
    )`;

  /* Boards arrived after the first version, so bring older installs
     forward rather than making anyone start again. */
  await client.sql`ALTER TABLE calls    ADD COLUMN IF NOT EXISTS board_key TEXT`;
  await client.sql`ALTER TABLE team     ADD COLUMN IF NOT EXISTS board_key TEXT NOT NULL DEFAULT ''`;
  await client.sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS board_key TEXT NOT NULL DEFAULT ''`;
  await client.sql`CREATE INDEX IF NOT EXISTS calls_board_idx ON calls (board_key)`;

  ready = true;
}

/* Anything logged before boards existed belongs to the first board made. */
async function adoptOrphans(boardKey) {
  const client = db();
  await client.sql`UPDATE calls    SET board_key = ${boardKey} WHERE board_key IS NULL OR board_key = ''`;
  await client.sql`UPDATE team     SET board_key = ${boardKey} WHERE board_key = ''`;
  await client.sql`UPDATE settings SET board_key = ${boardKey} WHERE board_key = ''`;
}

async function listBoards() {
  const { rows } = await db().sql`SELECT key, name, created_at FROM boards ORDER BY created_at ASC`;
  return rows.map((r) => ({ key: r.key, name: r.name, createdAt: r.created_at }));
}

async function boardExists(key) {
  if (!key) return false;
  const { rows } = await db().sql`SELECT 1 FROM boards WHERE key = ${key}`;
  return rows.length > 0;
}

/* One board's world. */
async function readBoard(boardKey) {
  const client = db();
  const [calls, team, settings] = await Promise.all([
    client.sql`SELECT data FROM calls WHERE board_key = ${boardKey} ORDER BY updated_at ASC`,
    client.sql`SELECT name, role, rate FROM team WHERE board_key = ${boardKey} ORDER BY created_at ASC`,
    client.sql`SELECT key, value FROM settings WHERE board_key = ${boardKey}`
  ]);

  const bag = {};
  settings.rows.forEach((r) => { bag[r.key] = r.value; });

  return {
    calls: calls.rows.map((r) => r.data),
    team: team.rows.map((r) => ({ name: r.name, role: r.role, rate: Number(r.rate) })),
    settings: bag
  };
}

/* Everything, for the hub. Calls carry their board so the page can
   total them per board using the same code a single board uses. */
async function readEverything() {
  const client = db();
  const [calls, team] = await Promise.all([
    client.sql`SELECT board_key, data FROM calls ORDER BY updated_at ASC`,
    client.sql`SELECT board_key, name, role, rate FROM team ORDER BY created_at ASC`
  ]);
  return {
    allCalls: calls.rows.map((r) => ({ boardKey: r.board_key, record: r.data })),
    allTeam: team.rows.map((r) => ({ boardKey: r.board_key, name: r.name, role: r.role, rate: Number(r.rate) }))
  };
}

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

export default async function handler(request, response) {
  if (!CONNECTION) {
    response.status(200).json({ connected: false });
    return;
  }

  try {
    await ensureTables();

    const isOwner = (request.headers['x-ia-role'] || '') === 'owner' ||
      /(?:^|;\s*)ia_role=owner(?:;|$)/.test(request.headers.cookie || '');

    /* ---------- checking a key, used by the front door ---------- */
    if (request.method === 'GET' && request.query.verify) {
      const ok = await boardExists(String(request.query.verify).trim().toUpperCase());
      if (!ok) await pause(1000);              // guessing should cost something
      response.status(200).json({ connected: true, valid: ok });
      return;
    }

    /* ---------- reading ---------- */
    if (request.method === 'GET') {
      const boardKey = (request.query.key || '').toString().trim().toUpperCase();

      if (!boardKey) {
        if (!isOwner) { response.status(403).json({ error: 'Not allowed' }); return; }
        const [boards, everything] = await Promise.all([listBoards(), readEverything()]);
        response.status(200).json(Object.assign({ connected: true, boards: boards }, everything));
        return;
      }

      if (!(await boardExists(boardKey))) {
        response.status(404).json({ connected: true, error: 'No such board' });
        return;
      }

      const board = (await listBoards()).find((b) => b.key === boardKey);
      const data = await readBoard(boardKey);
      response.status(200).json(Object.assign({ connected: true, board: board }, data));
      return;
    }

    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : (request.body || {});
    const client = db();
    const boardKey = (body.boardKey || '').toString().trim().toUpperCase();

    /* ---------- boards: the owner's alone ---------- */
    if (body.action === 'createBoard' || body.action === 'renameBoard' || body.action === 'deleteBoard') {
      if (!isOwner) { response.status(403).json({ error: 'Not allowed' }); return; }

      if (body.action === 'createBoard') {
        const name = String(body.name || '').trim() || 'Untitled board';
        let key = newKey();
        for (let tries = 0; tries < 40 && await boardExists(key); tries++) key = newKey();
        await client.sql`INSERT INTO boards (key, name) VALUES (${key}, ${name})`;

        const { rows } = await client.sql`SELECT count(*)::int AS n FROM boards`;
        if (rows[0].n === 1) await adoptOrphans(key);   // first board takes any older rows
      }

      if (body.action === 'renameBoard') {
        await client.sql`UPDATE boards SET name = ${String(body.name || '').trim()} WHERE key = ${boardKey}`;
      }

      if (body.action === 'deleteBoard') {
        await client.sql`DELETE FROM calls    WHERE board_key = ${boardKey}`;
        await client.sql`DELETE FROM team     WHERE board_key = ${boardKey}`;
        await client.sql`DELETE FROM settings WHERE board_key = ${boardKey}`;
        await client.sql`DELETE FROM boards   WHERE key = ${boardKey}`;
      }

      const [boards, everything] = await Promise.all([listBoards(), readEverything()]);
      response.status(200).json(Object.assign({ connected: true, boards: boards }, everything));
      return;
    }

    /* ---------- everything else happens inside one board ---------- */
    if (!boardKey || !(await boardExists(boardKey))) {
      response.status(404).json({ error: 'No such board' });
      return;
    }

    switch (body.action) {
      case 'saveCall': {
        const r = body.record;
        await client.sql`
          INSERT INTO calls (id, board_key, call_date, outcome, data, updated_at)
          VALUES (${r.id}, ${boardKey}, ${r.callDate}, ${r.outcome}, ${JSON.stringify(r)}::jsonb, now())
          ON CONFLICT (id) DO UPDATE
            SET call_date  = EXCLUDED.call_date,
                outcome    = EXCLUDED.outcome,
                data       = EXCLUDED.data,
                updated_at = now()
          WHERE calls.board_key = ${boardKey}`;
        break;
      }

      case 'deleteCall':
        await client.sql`DELETE FROM calls WHERE id = ${body.id} AND board_key = ${boardKey}`;
        break;

      case 'addMember':
        await client.sql`
          INSERT INTO team (board_key, name, role, rate)
          VALUES (${boardKey}, ${body.person.name}, ${body.person.role}, ${body.person.rate})
          ON CONFLICT (board_key, name, role) DO NOTHING`;
        break;

      case 'removeMember':
        await client.sql`
          DELETE FROM team
          WHERE board_key = ${boardKey} AND name = ${body.person.name} AND role = ${body.person.role}`;
        break;

      case 'replaceTeam': {
        await client.sql`DELETE FROM team WHERE board_key = ${boardKey}`;
        for (const p of body.people || []) {
          await client.sql`
            INSERT INTO team (board_key, name, role, rate)
            VALUES (${boardKey}, ${p.name}, ${p.role}, ${p.rate})
            ON CONFLICT (board_key, name, role) DO NOTHING`;
        }
        break;
      }

      case 'saveSetting':
        await client.sql`
          INSERT INTO settings (board_key, key, value)
          VALUES (${boardKey}, ${body.key}, ${JSON.stringify(body.value)}::jsonb)
          ON CONFLICT (board_key, key) DO UPDATE SET value = EXCLUDED.value`;
        break;

      default:
        response.status(400).json({ error: 'Unknown action' });
        return;
    }

    const board = (await listBoards()).find((b) => b.key === boardKey);
    const data = await readBoard(boardKey);
    response.status(200).json(Object.assign({ connected: true, board: board }, data));
  } catch (error) {
    console.error('board api', error);
    response.status(500).json({ error: 'Database error', detail: String(error && error.message) });
  }
}
