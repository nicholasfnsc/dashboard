import { adminClient, body, send, caller } from './_supabase.js';

/* ============================================================
   api/people.js — your admins
   Owner only.

     list       every admin and the offers each can reach
     invite     email an invitation, with chosen offers
     access     change which offers an admin can reach
     remove     take away an admin's account entirely

   Removing an admin never touches a call. Calls belong to offers.
   ============================================================ */

export default async function handler(request, response) {
  if (request.method !== 'POST') return send(response, 405, { error: 'Use POST' });

  let who;
  try { who = await caller(request); } catch (e) { who = null; }
  if (!who || !who.isOwner) return send(response, 403, { error: 'Only the owner manages admins.' });

  const input = body(request);
  const db = adminClient();

  const setAccess = async (userId, boardIds) => {
    await db.from('memberships').delete().eq('user_id', userId).eq('role', 'admin');
    const rows = (boardIds || []).map((b) => ({ user_id: userId, board_id: b, role: 'admin' }));
    if (rows.length) {
      const { error } = await db.from('memberships').insert(rows);
      if (error) throw error;
    }
  };

  try {
    if (input.action === 'list') {
      const [{ data: people }, { data: access }, { data: accounts }] = await Promise.all([
        db.from('profiles').select('id, email, full_name, created_at')
          .eq('kind', 'person').eq('is_owner', false).order('created_at'),
        db.from('memberships').select('user_id, board_id').eq('role', 'admin'),
        db.auth.admin.listUsers({ page: 1, perPage: 1000 })
      ]);
      /* Admins edit their own name and role, which live on their account. */
      const meta = {};
      ((accounts && accounts.users) || []).forEach((u) => {
        meta[u.id] = { md: u.user_metadata || {}, joined: !!u.last_sign_in_at };
      });
      const admins = (people || []).map((p) => {
        const m = meta[p.id] || { md: {}, joined: false };
        return {
          id: p.id, email: p.email,
          name: m.md.full_name || p.full_name || '',
          title: m.md.title || '',
          joined: m.joined,
          boardIds: (access || []).filter((a) => a.user_id === p.id).map((a) => a.board_id)
        };
      });
      return send(response, 200, { admins });
    }

    if (input.action === 'invite') {
      const email = String(input.email || '').trim().toLowerCase();
      const name = String(input.name || '').trim();
      const title = String(input.title || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(response, 400, { error: 'That email does not look right.' });

      const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
        redirectTo: 'https://portal.inevitableacq.com/?welcome=1',
        data: { full_name: name, display_name: name, title }
      });
      if (error) {
        const taken = /already/i.test(error.message || '');
        return send(response, taken ? 409 : 500, {
          error: taken ? 'Someone with that email already has an account.' : error.message
        });
      }

      await db.from('profiles').upsert({ id: data.user.id, email, full_name: name || null, kind: 'person' });
      await setAccess(data.user.id, input.boardIds);
      return send(response, 200, { ok: true });
    }

    if (input.action === 'access') {
      await setAccess(String(input.userId || ''), input.boardIds);
      return send(response, 200, { ok: true });
    }

    if (input.action === 'remove') {
      const userId = String(input.userId || '');
      if (userId === who.id) return send(response, 400, { error: 'You cannot remove yourself.' });
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) throw error;
      return send(response, 200, { ok: true });
    }

    return send(response, 400, { error: 'Unknown action.' });
  } catch (error) {
    console.error('people', error);
    return send(response, 500, { error: 'That did not work: ' + (error.message || 'unknown error') });
  }
}
