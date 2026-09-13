/* ============================================================
   config.js — optional shared storage

   Leave this alone and the board works right now, saving everything
   in your own browser.

   Fill it in when you want your team's calls to reach your dashboard:
   Supabase → Project Settings → API gives you both values.
   See README.md → "Sharing data with the team".

   These two are safe to publish. Nothing secret belongs in this file,
   or in any other file in this repo — the password and the team key
   live in Vercel's settings and are checked before this page is ever
   sent to anyone.
   ============================================================ */

const SUPABASE_URL = 'PASTE_YOUR_PROJECT_URL_HERE';
const SUPABASE_ANON_KEY = 'PASTE_YOUR_ANON_PUBLIC_KEY_HERE';

/* Visiting this path shows the team key screen instead of yours.
   vercel.json rewrites it to the app. */
const TEAM_ACCESS_PATH = '/sales-access';
