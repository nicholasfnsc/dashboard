import { createClient } from '@supabase/supabase-js';

/* ============================================================
   api/_supabase.js — shared server pieces
   Files in api/ starting with an underscore are not web addresses.

   The secret key is read from Vercel's settings here and nowhere
   else. It never reaches a browser.
   ============================================================ */

export const SUPABASE_URL = 'https://dqbrbsuyukfhrodiwsnt.supabase.co';

let admin = null;
export function adminClient() {
  if (!admin) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in Vercel');
    admin = createClient(SUPABASE_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return admin;
}

/* No I, O, 0 or 1 — they get misheard when a code is read out on a call. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

/* A team account needs an email to exist. It never receives mail —
   it is confirmed on creation — so any address on your domain works.
   Each rotation makes a new account, so the address carries a random
   tail to keep it unique. It deliberately does not contain the code. */
export const teamEmailFor = (boardId) =>
  'team-' + boardId.slice(0, 8) + '-' + Math.random().toString(36).slice(2, 8) + '@teams.inevitableacq.com';

export const pause = (ms) => new Promise((done) => setTimeout(done, ms));

export function body(request) {
  if (!request.body) return {};
  if (typeof request.body === 'string') {
    try { return JSON.parse(request.body); } catch (e) { return {}; }
  }
  return request.body;
}

export function send(response, status, payload) {
  response.status(status).json(payload);
}

/* Who is asking? The browser sends its Supabase session; we ask
   Supabase to vouch for it rather than trusting anything it claims. */
export async function caller(request) {
  const header = request.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    console.error('caller: no bearer token on the request');
    return null;
  }

  const db = adminClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data || !data.user) {
    console.error('caller: Supabase rejected the session:', error && (error.status + ' ' + error.message));
    return null;
  }

  const [profile, memberships, access] = await Promise.all([
    db.from('profiles').select('is_owner, kind, email, full_name').eq('id', data.user.id).maybeSingle(),
    db.from('memberships').select('board_id, role').eq('user_id', data.user.id),
    db.from('admin_access').select('sections, all_offers').eq('user_id', data.user.id).maybeSingle()
  ]);

  const p = profile.data || {};
  const rows = memberships.data || [];
  const isOwner = p.is_owner === true;
  const { sections, allOffers } = accessFrom(access, rows);
  const offerAllowed = (boardId) => allOffers || rows.some((m) => m.board_id === boardId && m.role === 'admin');
  return {
    id: data.user.id,
    email: data.user.email,
    isOwner,
    kind: p.kind || 'person',
    /* The same rule as the database's can_manage_board(). */
    manages: (boardId) => isOwner || (sections.indexOf('sales') !== -1 && offerAllowed(boardId))
  };
}

/* An admin's sections and offers. Until access.sql has been run the
   table is missing, and admins keep what they always had: the sales
   boards for the offers they were given. */
export function accessFrom(access, memberships) {
  if (access && !access.error) {
    const row = access.data || {};
    return { sections: row.sections || [], allOffers: row.all_offers === true };
  }
  const isAdmin = (memberships || []).some((m) => m.role === 'admin');
  return { sections: isAdmin ? ['sales'] : [], allOffers: false };
}

export const SECTIONS = ['sales', 'metrics', 'funnel', 'content'];

/* What the login is called in Supabase → Authentication → Users, so the
   team logins say which offer they open instead of being blank. */
export const teamDisplayName = (boardName) => {
  const name = String(boardName || '').trim();
  return name && name !== 'Untitled offer' ? name + "'s board" : 'Untitled offer';
};

const teamMetadata = (boardName) => {
  const label = teamDisplayName(boardName);
  return { display_name: label, full_name: label, name: label, team_login: true };
};

/* ---------- readable offer addresses ----------
   portal.inevitableacq.com/sales-dashboard/<slug>. The slug follows the
   offer's name and is stored on the offer, along with every slug it has
   had, so a link sent before a rename still opens the same board.
   Addresses only point at an offer — every call is tied to the offer's
   id, so changing one never touches data. */
export function slugify(name) {
  return String(name || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60).replace(/-+$/, '') || 'offer';
}

/* Gives every offer (or just `onlyId`) a slug no other offer uses.
   Reads the directory fresh and changes only the slug fields, so
   nothing else stored on the offer is ever overwritten. */
export async function assignSlugs(onlyId) {
  const db = adminClient();
  const { data: boards, error } = await db.from('boards')
    .select('id, name, directory, created_at').order('created_at', { ascending: true });
  if (error) throw error;

  const current = new Map();                      // slug -> board id
  boards.forEach((b) => {
    const slug = b.directory && b.directory.slug;
    if (slug && !current.has(slug)) current.set(slug, b.id);
  });

  const result = {};
  for (const b of boards) {
    const directory = b.directory || {};
    const base = slugify(b.name);
    const mine = directory.slug;
    const fits = (s) => !current.has(s) || current.get(s) === b.id;

    let wanted = base;
    if (mine && (mine === base || new RegExp('^' + base + '-\\d+$').test(mine)) && fits(mine)) wanted = mine;
    for (let n = 2; !fits(wanted); n++) wanted = base + '-' + n;
    result[b.id] = wanted;

    if (wanted === mine || (onlyId && b.id !== onlyId)) continue;

    const old = Array.isArray(directory.oldSlugs) ? directory.oldSlugs.slice() : [];
    if (mine && old.indexOf(mine) === -1) old.push(mine);
    const fresh = Object.assign({}, directory, { slug: wanted, oldSlugs: old.filter((s) => s !== wanted) });
    const { error: saveError } = await db.from('boards').update({ directory: fresh }).eq('id', b.id);
    if (saveError) throw saveError;
    if (mine) current.delete(mine);
    current.set(wanted, b.id);
  }
  return result;
}

/* Keeps an offer's team login named after the offer. */
export async function nameTeamAccount(userId, boardName) {
  if (!userId) return;
  const { error } = await adminClient().auth.admin.updateUserById(userId, { user_metadata: teamMetadata(boardName) });
  if (error) throw error;
}

/* Makes a fresh team account for an offer, with the code as its
   password, and gives it that one offer. */
export async function makeTeamAccount(boardId, code, boardName) {
  const db = adminClient();
  const { data, error } = await db.auth.admin.createUser({
    email: teamEmailFor(boardId),
    password: code,
    email_confirm: true,
    user_metadata: teamMetadata(boardName)
  });
  if (error) throw error;

  const userId = data.user.id;
  await db.from('profiles').upsert({ id: userId, email: data.user.email, kind: 'team' });
  const { error: memberError } = await db.from('memberships')
    .upsert({ user_id: userId, board_id: boardId, role: 'rep' });
  if (memberError) throw memberError;

  return { userId, email: data.user.email };
}
