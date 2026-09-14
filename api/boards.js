import { adminClient, body, send, caller, newCode, makeTeamAccount, nameTeamAccount, assignSlugs } from './_supabase.js';

/* ============================================================
   api/boards.js — creating offers and changing their codes

   These need the secret key, because they make and replace sign-in
   accounts. Everything else about an offer — its name, its links,
   its roster, its calls — is edited directly under the database's
   own rules.

     create   owner          a new untitled offer with a fresh code
     rotate   owner, admin   a new code; the old one stops working
     archive  owner          hides an offer; its data stays forever
     names    owner, admin   names each team login after its offer, and
                             gives each offer its readable address
   ============================================================ */

async function uniqueCode(db) {
  for (let tries = 0; tries < 30; tries++) {
    const code = newCode();
    const { data } = await db.from('board_codes').select('board_id').eq('code', code).maybeSingle();
    if (!data) return code;
  }
  throw new Error('Could not find an unused code');
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return send(response, 405, { error: 'Use POST' });

  let who;
  try { who = await caller(request); } catch (e) { console.error('boards: caller threw', e); who = null; }
  if (!who) return send(response, 401, { error: 'Sign in first.' });
  if (who.kind !== 'person') {
    console.error('boards: signed in, but as', who.kind);
    return send(response, 403, { error: 'Team accounts cannot manage offers.' });
  }

  const input = body(request);
  const db = adminClient();

  try {
    /* ---------- a new offer ---------- */
    if (input.action === 'create') {
      if (!who.isOwner) return send(response, 403, { error: 'Only the owner can create offers.' });

      const { data: board, error } = await db.from('boards').insert({}).select('id, name').single();
      if (error) throw error;

      const code = await uniqueCode(db);
      const team = await makeTeamAccount(board.id, code, board.name);

      await db.from('boards').update({ team_user_id: team.userId }).eq('id', board.id);
      const { error: codeError } = await db.from('board_codes').insert({ board_id: board.id, code });
      if (codeError) throw codeError;

      const slug = (await assignSlugs(board.id))[board.id];
      return send(response, 200, { board: { id: board.id, name: board.name, slug }, code });
    }

    /* ---------- a new code for an existing offer ---------- */
    if (input.action === 'rotate') {
      const boardId = String(input.boardId || '');
      if (!who.manages(boardId)) return send(response, 403, { error: 'You do not manage this offer.' });

      const { data: board } = await db.from('boards').select('id, name, team_user_id').eq('id', boardId).maybeSingle();
      if (!board) return send(response, 404, { error: 'No such offer.' });

      /* A brand-new team account rather than a new password on the old
         one: signed-in reps are tied to the old account, so deleting it
         locks every one of them out at once. Calls are tied to the offer,
         not the account, so nothing logged is touched. */
      const code = await uniqueCode(db);
      const team = await makeTeamAccount(board.id, code, board.name);

      await db.from('boards').update({ team_user_id: team.userId }).eq('id', board.id);
      await db.from('board_codes').upsert({ board_id: board.id, code, rotated_at: new Date().toISOString() });
      if (board.team_user_id) await db.auth.admin.deleteUser(board.team_user_id);

      return send(response, 200, { code });
    }

    /* ---------- hide an offer, keep everything in it ---------- */
    if (input.action === 'archive') {
      if (!who.isOwner) return send(response, 403, { error: 'Only the owner can archive offers.' });
      const boardId = String(input.boardId || '');
      await db.from('boards').update({ archived_at: new Date().toISOString() }).eq('id', boardId);
      return send(response, 200, { ok: true });
    }

    /* ---------- keep team logins named after their offers ---------- */
    if (input.action === 'names') {
      let query = db.from('boards').select('id, name, team_user_id').is('archived_at', null);
      if (input.boardId) query = query.eq('id', String(input.boardId));
      const { data: boards, error } = await query;
      if (error) throw error;

      let named = 0;
      for (const b of boards || []) {
        if (!who.manages(b.id) || !b.team_user_id) continue;
        await nameTeamAccount(b.team_user_id, b.name);
        named++;
      }

      /* ...and give each offer a readable address that follows its name. */
      let slug = null;
      if (input.boardId && who.manages(String(input.boardId))) {
        slug = (await assignSlugs(String(input.boardId)))[String(input.boardId)];
      } else if (!input.boardId && who.isOwner) {
        await assignSlugs();
      }
      return send(response, 200, { named, slug });
    }

    return send(response, 400, { error: 'Unknown action.' });
  } catch (error) {
    console.error('boards', error);
    return send(response, 500, { error: 'That did not work: ' + (error.message || 'unknown error') });
  }
}
