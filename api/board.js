import { createPool } from '@vercel/postgres';
import { createHash, timingSafeEqual } from 'crypto';

/* ============================================================
   api/board.js — the shared store

   One board. Every device reads and writes through here, which is
   what makes the whole team see one set of numbers.

   Runs on Vercel's servers. The connection string stays here and
   never reaches a browser. Only someone who signed in with the
   password can use it — the same check the front door makes, made
   again here so the endpoint stands on its own.
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

let pool = null;
let ready = false;

function db() {
  if (!pool) pool = createPool({ connectionString: CONNECTION });
  return pool;
}

/* ---------- is this person signed in? ---------- */
function signedIn(request) {
  const password = process.env.OWNER_PASSWORD;
  if (!password) return true;                 // no door configured, nothing to check against

  const header = request.headers.cookie || '';
  const hit = header.split(';').map((c) => c.trim()).find((c) => c.startsWith('ia_pass='));
  const got = hit ? decodeURIComponent(hit.slice('ia_pass='.length)) : '';
  const want = createHash('sha256').update('ia-dash|v1|' + password).digest('hex');

  if (!got || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/* ---------- tables ---------- */
async function ensureTables() {
  if (ready) return;
  const client = db();

  await client.sql`
    CREATE TABLE IF NOT EXISTS calls (
      id         TEXT PRIMARY KEY,
      call_date  DATE,
      outcome    TEXT,
      data       JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await client.sql`
    CREATE TABLE IF NOT EXISTS team (
      name       TEXT NOT NULL,
      role       TEXT NOT NULL,
      rate       NUMERIC NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await client.sql`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value JSONB
    )`;

  /* An earlier version added a board_key column and put it in the primary
     key. There is one board now, so put the key back the way this code
     expects rather than leaving inserts to fail against the old shape. */
  await settle('ALTER TABLE team DROP CONSTRAINT IF EXISTS team_pkey');
  await settle('ALTER TABLE team ADD PRIMARY KEY (name, role)');
  await settle('ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey');
  await settle('ALTER TABLE settings ADD PRIMARY KEY (key)');

  ready = true;
}

/* Runs a statement that may already have been applied. */
async function settle(statement) {
  try {
    await db().query(statement);
  } catch (error) {
    /* already in the desired state */
  }
}

async function readBoard() {
  const client = db();
  const [calls, team, settings] = await Promise.all([
    client.sql`SELECT data FROM calls ORDER BY updated_at ASC`,
    client.sql`SELECT name, role, rate FROM team ORDER BY created_at ASC`,
    client.sql`SELECT key, value FROM settings`
  ]);

  const bag = {};
  settings.rows.forEach((r) => { bag[r.key] = r.value; });

  return {
    calls: calls.rows.map((r) => r.data),
    team: team.rows.map((r) => ({ name: r.name, role: r.role, rate: Number(r.rate) })),
    settings: bag
  };
}

export default async function handler(request, response) {
  /* No database connected yet — say so plainly so the page can fall back
     to saving locally instead of appearing broken. */
  if (!CONNECTION) {
    response.status(200).json({ connected: false });
    return;
  }

  if (!signedIn(request)) {
    response.status(403).json({ error: 'Not allowed' });
    return;
  }

  try {
    await ensureTables();

    if (request.method === 'GET') {
      response.status(200).json(Object.assign({ connected: true }, await readBoard()));
      return;
    }

    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : (request.body || {});
    const client = db();

    switch (body.action) {
      case 'saveCall': {
        const r = body.record;
        await client.sql`
          INSERT INTO calls (id, call_date, outcome, data, updated_at)
          VALUES (${r.id}, ${r.callDate}, ${r.outcome}, ${JSON.stringify(r)}::jsonb, now())
          ON CONFLICT (id) DO UPDATE
            SET call_date  = EXCLUDED.call_date,
                outcome    = EXCLUDED.outcome,
                data       = EXCLUDED.data,
                updated_at = now()`;
        break;
      }

      case 'deleteCall':
        await client.sql`DELETE FROM calls WHERE id = ${body.id}`;
        break;

      case 'addMember':
        await client.sql`
          INSERT INTO team (name, role, rate)
          VALUES (${body.person.name}, ${body.person.role}, ${body.person.rate})
          ON CONFLICT (name, role) DO NOTHING`;
        break;

      case 'removeMember':
        await client.sql`
          DELETE FROM team WHERE name = ${body.person.name} AND role = ${body.person.role}`;
        break;

      case 'replaceTeam': {
        await client.sql`DELETE FROM team`;
        for (const p of body.people || []) {
          await client.sql`
            INSERT INTO team (name, role, rate) VALUES (${p.name}, ${p.role}, ${p.rate})
            ON CONFLICT (name, role) DO NOTHING`;
        }
        break;
      }

      case 'saveSetting':
        await client.sql`
          INSERT INTO settings (key, value)
          VALUES (${body.key}, ${JSON.stringify(body.value)}::jsonb)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
        break;

      default:
        response.status(400).json({ error: 'Unknown action' });
        return;
    }

    response.status(200).json(Object.assign({ connected: true }, await readBoard()));
  } catch (error) {
    console.error('board api', error);
    response.status(500).json({ error: 'Database error', detail: String(error && error.message) });
  }
}
