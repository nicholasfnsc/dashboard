import { createPool } from '@vercel/postgres';
import { createHash, timingSafeEqual } from 'crypto';

/* ============================================================
   api/_lib.js — shared server pieces
   Files under api/ starting with an underscore are not routes.
   ============================================================ */

export function findConnection() {
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

export const CONNECTION = findConnection();

let pool = null;
export function db() {
  if (!pool) pool = createPool({ connectionString: CONNECTION });
  return pool;
}

/* The same stamp the front door issues. A cookie holds a hash of a secret
   this server knows, so it cannot be forged by editing cookies in a
   browser — which a plain-text role cookie absolutely can. */
export function stamp(secret, scope) {
  return createHash('sha256').update('ia-dash|' + scope + '|' + secret).digest('hex');
}

export function cookieFrom(request, name) {
  const header = request.headers.cookie || '';
  const hit = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(name + '='));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : '';
}

export function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !a) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export const asksAsOwner = (request) =>
  !!process.env.OWNER_PASSWORD &&
  same(cookieFrom(request, 'ia_pass'), stamp(process.env.OWNER_PASSWORD, 'v1'));

/* Either you signed in as the owner, or you typed this board's key. */
export const mayUseBoard = (request, boardKey) =>
  asksAsOwner(request) || same(cookieFrom(request, 'ia_board'), stamp(boardKey, 'board'));

export async function boardExists(key) {
  if (!key) return false;
  const { rows } = await db().sql`SELECT 1 FROM boards WHERE key = ${key}`;
  return rows.length > 0;
}

export const pause = (ms) => new Promise((done) => setTimeout(done, ms));

/* ------------------------------------------------------------
   Tables. Safe to run repeatedly, and it brings older installs
   forward rather than making anyone start again.
   ------------------------------------------------------------ */
let ready = false;

export async function ensureTables() {
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

  await client.sql`ALTER TABLE calls    ADD COLUMN IF NOT EXISTS board_key TEXT`;
  await client.sql`ALTER TABLE team     ADD COLUMN IF NOT EXISTS board_key TEXT NOT NULL DEFAULT ''`;
  await client.sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS board_key TEXT NOT NULL DEFAULT ''`;
  await client.sql`CREATE INDEX IF NOT EXISTS calls_board_idx ON calls (board_key)`;

  /* A table created before boards existed keeps its old primary key, and
     then every ON CONFLICT (board_key, ...) fails against it. Widen it. */
  await widenKey('team', '(board_key, name, role)');
  await widenKey('settings', '(board_key, key)');

  ready = true;
}

async function widenKey(table, columns) {
  const client = db();
  try {
    const { rows } = await client.query(
      `SELECT pg_get_constraintdef(c.oid) AS def
         FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = $1 AND c.contype = 'p'`, [table]);

    if (rows.length && rows[0].def.indexOf('board_key') !== -1) return;   // already right

    await client.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_pkey`);
    await client.query(`ALTER TABLE ${table} ADD PRIMARY KEY ${columns}`);
  } catch (error) {
    console.error('could not widen primary key on ' + table, error);
  }
}
