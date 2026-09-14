import { adminClient, body, send, caller, SECTIONS } from './_supabase.js';

/* ============================================================
   api/people.js — your admins
   Owner only.

     list       every admin, their sections and their offers
     invite     email an invitation, with chosen sections and offers
     access     change an admin's sections and offers
     remove     take away an admin's account entirely

   Sections are the parts of the portal they can open. Offers are
   which offers they see inside the sections that are per offer —
   every offer, or a chosen few.

   Removing an admin never touches a call. Calls belong to offers.
   ============================================================ */

const cleanSections = (list) => (Array.isArray(list) ? list : []).filter((s) => SECTIONS.indexOf(s) !== -1);

export default async function handler(request, response) {
  if (request.method !== 'POST') return send(response, 405, { error: 'Use POST' });

  let who;
  try { who = await caller(request); } catch (e) { who = null; }
  if (!who || !who.isOwner) return send(response, 403, { error: 'Only the owner manages admins.' });

  const input = body(request);
  const db = adminClient();

  const setAccess = async (userId, sections, allOffers, boardIds) => {
    const { error: accessError } = await db.from('admin_access').upsert({
      user_id: userId,
      sections: cleanSections(sections),
      all_offers: allOffers === true,
      updated_at: new Date().toISOString()
    });
    if (accessError) {
      if (/admin_access/.test(accessError.message || '')) {
        throw new Error('Run supabase/access.sql in Supabase first.');
      }
      throw accessError;
    }

    await db.from('memberships').delete().eq('user_id', userId).eq('role', 'admin');
    const rows = (allOffers === true ? [] : boardIds || []).map((b) => ({ user_id: userId, board_id: b, role: 'admin' }));
    if (rows.length) {
      const { error } = await db.from('memberships').insert(rows);
      if (error) throw error;
    }
  };

  try {
    if (input.action === 'list') {
      const [{ data: people }, { data: offers }, access, { data: accounts }] = await Promise.all([
        db.from('profiles').select('id, email, full_name, created_at')
          .eq('kind', 'person').eq('is_owner', false).order('created_at'),
        db.from('memberships').select('user_id, board_id').eq('role', 'admin'),
        db.from('admin_access').select('user_id, sections, all_offers'),
        db.auth.admin.listUsers({ page: 1, perPage: 1000 })
      ]);
      const ready = !access.error;

      /* Admins edit their own name, role and picture, which live on their account. */
      const meta = {};
      ((accounts && accounts.users) || []).forEach((u) => {
        meta[u.id] = { md: u.user_metadata || {}, joined: !!u.last_sign_in_at };
      });
      const admins = (people || []).map((p) => {
        const m = meta[p.id] || { md: {}, joined: false };
        const row = ready ? (access.data || []).find((a) => a.user_id === p.id) : null;
        const boardIds = (offers || []).filter((a) => a.user_id === p.id).map((a) => a.board_id);
        return {
          id: p.id, email: p.email,
          name: m.md.full_name || p.full_name || '',
          title: m.md.title || '',
          avatar: m.md.avatar_url || '',
          joined: m.joined,
          sections: row ? row.sections || [] : (ready ? [] : ['sales']),
          allOffers: row ? row.all_offers === true : false,
          boardIds
        };
      });
      return send(response, 200, { admins, ready });
    }

    if (input.action === 'invite') {
      const email = String(input.email || '').trim().toLowerCase();
      const name = String(input.name || '').trim();
      const title = String(input.title || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(response, 400, { error: 'That email does not look right.' });
      if (!cleanSections(input.sections).length) return send(response, 400, { error: 'Tick at least one section they can use.' });
      const { error: notReady } = await db.from('admin_access').select('user_id').limit(1);
      if (notReady) return send(response, 409, { error: 'Run supabase/access.sql in Supabase first.' });

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
      await setAccess(data.user.id, input.sections, input.allOffers, input.boardIds);
      return send(response, 200, { ok: true });
    }

    if (input.action === 'access') {
      const userId = String(input.userId || '');
      if (userId === who.id) return send(response, 400, { error: 'The owner always has everything.' });
      await setAccess(userId, input.sections, input.allOffers, input.boardIds);
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
