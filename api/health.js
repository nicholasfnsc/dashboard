import { CONNECTION, db, ensureTables, asksAsOwner } from './_lib.js';

/* ============================================================
   api/health.js — what the server can actually see

   Owner only. Open sales.inevitableacq.com/api/health while signed
   in and it says whether a database is connected, whether the
   tables are there, and which board keys exist — so a key that is
   refused can be checked against the keys that are real, rather
   than guessed at.
   ============================================================ */

export default async function handler(request, response) {
  if (!asksAsOwner(request)) {
    response.status(403).json({ error: 'Sign in as the owner first.' });
    return;
  }

  const report = {
    ownerPasswordSet: !!process.env.OWNER_PASSWORD,
    databaseConnected: !!CONNECTION,
    /* The name only — never the connection string itself. */
    connectionVariable: Object.keys(process.env).find(
      (n) => process.env[n] === CONNECTION && CONNECTION) || null,
    tables: null,
    boards: null,
    callCount: null,
    error: null
  };

  if (!CONNECTION) {
    report.error = 'No database is connected. Vercel > Storage > Create Database, then connect it to this project and redeploy.';
    response.status(200).json(report);
    return;
  }

  try {
    await ensureTables();
    report.tables = 'ready';

    const client = db();
    const boards = await client.sql`SELECT key, name FROM boards ORDER BY created_at ASC`;
    const calls = await client.sql`SELECT count(*)::int AS n FROM calls`;

    report.boards = boards.rows.map((r) => ({ key: r.key, name: r.name }));
    report.callCount = calls.rows[0].n;
  } catch (error) {
    report.error = String(error && error.message);
  }

  response.status(200).json(report);
}
