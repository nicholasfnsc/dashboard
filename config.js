/* ============================================================
   config.js — connection settings

   Paste the two values from your Supabase project here:
     Supabase dashboard → Project Settings → API

   These two are SAFE to publish. The anon key is designed to sit in
   the browser; it grants nothing on its own, because every table is
   locked behind Row Level Security and requires a signed-in session.

   Nothing secret belongs in this file, or in any other file in this
   repo. Passwords and the team key live inside Supabase, hashed, and
   are checked on their server — never here.
   ============================================================ */

const SUPABASE_URL = 'PASTE_YOUR_PROJECT_URL_HERE';
const SUPABASE_ANON_KEY = 'PASTE_YOUR_ANON_PUBLIC_KEY_HERE';

/* The shared sales account. Its password is the team secret key, so the
   key is verified by Supabase rather than by anything in this code.
   The address itself is not a secret — the key is. */
const TEAM_ACCOUNT_EMAIL = 'team@inevitableacq.com';

/* Visiting this path shows the team key screen instead of your own
   sign-in. vercel.json rewrites it to the app. */
const TEAM_ACCESS_PATH = '/sales-access';
