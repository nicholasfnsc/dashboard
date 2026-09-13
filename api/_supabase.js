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
  if (!token) return null;

  const db = adminClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data || !data.user) return null;

  const [profile, memberships] = await Promise.all([
    db.from('profiles').select('is_owner, kind, email, full_name').eq('id', data.user.id).maybeSingle(),
    db.from('memberships').select('board_id, role').eq('user_id', data.user.id)
  ]);

  const p = profile.data || {};
  const rows = memberships.data || [];
  return {
    id: data.user.id,
    email: data.user.email,
    isOwner: p.is_owner === true,
    kind: p.kind || 'person',
    manages: (boardId) => p.is_owner === true ||
      rows.some((m) => m.board_id === boardId && m.role === 'admin')
  };
}

/* Makes a fresh team account for an offer, with the code as its
   password, and gives it that one offer. */
export async function makeTeamAccount(boardId, code) {
  const db = adminClient();
  const { data, error } = await db.auth.admin.createUser({
    email: teamEmailFor(boardId),
    password: code,
    email_confirm: true
  });
  if (error) throw error;

  const userId = data.user.id;
  await db.from('profiles').upsert({ id: userId, email: data.user.email, kind: 'team' });
  const { error: memberError } = await db.from('memberships')
    .upsert({ user_id: userId, board_id: boardId, role: 'rep' });
  if (memberError) throw memberError;

  return { userId, email: data.user.email };
}
