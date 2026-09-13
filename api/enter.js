import { adminClient, body, send, pause } from './_supabase.js';

/* ============================================================
   api/enter.js — the team login page's Go button

   A rep types only the code, not which offer it belongs to. This
   finds the offer that code opens and returns the address of that
   offer's team account. The browser then signs in with that address
   and the code as its password — so Supabase does the real checking.

   Knowing the address is harmless without the code, and nobody gets
   the address without typing the right code first.
   ============================================================ */

export default async function handler(request, response) {
  if (request.method !== 'POST') return send(response, 405, { error: 'Use POST' });

  const code = String(body(request).code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9]{4,12}$/.test(code)) {
    await pause(800);
    return send(response, 404, { error: "That code doesn't match any team." });
  }

  try {
    const db = adminClient();
    const { data: row, error: lookupError } = await db
      .from('board_codes')
      .select('board_id, boards!inner(id, team_user_id, archived_at)')
      .eq('code', code)
      .maybeSingle();
    /* A lookup that failed is not the same as a code that does not exist. */
    if (lookupError) throw lookupError;

    const board = row && row.boards;
    if (!board || board.archived_at || !board.team_user_id) {
      await pause(1000);                               // guessing should cost something
      return send(response, 404, { error: "That code doesn't match any team." });
    }

    const { data: team } = await db
      .from('profiles').select('email').eq('id', board.team_user_id).maybeSingle();
    if (!team || !team.email) {
      return send(response, 500, { error: 'This team is not set up correctly. Tell the account owner.' });
    }

    return send(response, 200, { email: team.email, boardId: board.id });
  } catch (error) {
    console.error('enter', error);
    return send(response, 500, { error: 'The code could not be checked just now. Tell the account owner.' });
  }
}
