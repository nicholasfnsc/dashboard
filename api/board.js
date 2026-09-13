import { createPool } from '@vercel/postgres';

/* ============================================================
   api/board.js — the shared store

   Runs on Vercel's servers, not in anyone's browser. Every device
   reads and writes through here, which is what makes one team see
   one set of numbers.

   The database connection string lives in Vercel's environment and
   never leaves the server. Only someone already past the password
   can reach this, because middleware.js guards /api too.

   Nothing here needs setting up by hand: the tables are created on
   first use. Connect a database in Vercel → Storage and it works.
   ============================================================ */

/* Vercel names the connection variable after whatever prefix you chose
   when connecting the database, so rather than insisting on one name we
   take the usual ones first and otherwise find the Postgres URL sitting
   in the environment. Pooled connections are preferred: serverless opens
   and closes a lot of them. */
function findConnection() {
  const known = [
    'POSTGRES_URL', 'DATABASE_URL', 'STORAGE_URL',
    'POSTGRES_PRISMA_URL', 'POSTGRES_URL_NON_POOLING'
  ];
  for (const name of known) {
    if (process.env[name]) return process.env[name];
  }

  const looksRight = (value) => typeof value === 'string' && /^postgres(ql)?:\/\//.test(value);
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

/* Idempotent, so it costs nothing after the first call. */
async function ensureTables() {
  if (ready) return;
  const client = db();
  await client.sql`
    CREATE TABLE IF NOT EXISTS calls (
      id          TEXT PRIMARY KEY,
      call_date   DATE,
      outcome     TEXT,
      data        JSONB NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await client.sql`
    CREATE TABLE IF NOT EXISTS team (
      name       TEXT NOT NULL,
      role       TEXT NOT NULL,
      rate       NUMERIC NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (name, role)
    )`;
  await client.sql`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value JSONB
    )`;
  ready = true;
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
  /* No database connected yet — say so plainly so the page can fall
     back to saving locally instead of appearing broken. */
  if (!CONNECTION) {
    response.status(200).json({ connected: false });
    return;
  }

  try {
    await ensureTables();

    if (request.method === 'GET') {
      const board = await readBoard();
      response.status(200).json(Object.assign({ connected: true }, board));
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
            SET call_date = EXCLUDED.call_date,
                outcome   = EXCLUDED.outcome,
                data      = EXCLUDED.data,
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

    const board = await readBoard();
    response.status(200).json(Object.assign({ connected: true }, board));
  } catch (error) {
    console.error('board api', error);
    response.status(500).json({ error: 'Database error', detail: String(error && error.message) });
  }
}
