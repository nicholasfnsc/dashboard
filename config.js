/* ============================================================
   config.js — where the database lives

   Both values are public by design and safe in this repo. On their
   own they open nothing: every table refuses anyone who is not
   signed in, and each person sees only the offers they belong to.

   The secret key is NOT here and never will be. It lives only in
   Vercel's settings, where the server functions in api/ read it.
   ============================================================ */

const SUPABASE_URL = 'https://dqbrbsuyukfhrodiwsnt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Y2N1f1L_Pu4siI8FTdpsOw_8L1f_nib';

const PORTAL_ORIGIN = 'https://portal.inevitableacq.com';
const TEAM_LOGIN_PATH = '/sales-team';
