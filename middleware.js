import { next } from '@vercel/edge';

/* ============================================================
   middleware.js — the front door

   This runs on Vercel's servers BEFORE any file is sent. Someone
   without the password never receives the dashboard at all — not the
   HTML, not the scripts, not a single number. There is nothing on
   their machine to inspect.

   The password itself lives in Vercel → Settings → Environment
   Variables. It is never in this repo and never sent to a browser.

   Two doors, two secrets:
     /sales-access   the sales team, using TEAM_KEY
     everything else you, using OWNER_PASSWORD

   To switch the whole thing off: delete this file and redeploy.
   ============================================================ */

export const config = {
  /* Everything is behind the door except the logo, which the sign-in
     page itself needs to display. */
  matcher: ['/((?!logo\\.png).*)']
};

const COOKIE = 'ia_pass';
const ROLE_COOKIE = 'ia_role';      /* readable by the page, so it can show owner-only controls */
const THIRTY_DAYS = 60 * 60 * 24 * 30;

/* The cookie holds a hash, so a stolen cookie never reveals the
   password — and changing the password invalidates every old cookie. */
async function stamp(secret, scope) {
  const bytes = new TextEncoder().encode('ia-dash|' + scope + '|' + secret);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  const hit = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(name + '='));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

/* Constant-time compare, so timing never leaks how much was right. */
function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const isTeamDoor = url.pathname.replace(/\/+$/, '') === '/sales-access';

  /* Signing out just drops the cookies and shows the door again. */
  if (url.searchParams.has('signout')) {
    return new Response(null, {
      status: 303,
      headers: new Headers([
        ['location', isTeamDoor ? '/sales-access' : '/'],
        ['set-cookie', COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'],
        ['set-cookie', ROLE_COOKIE + '=; Path=/; Secure; SameSite=Lax; Max-Age=0']
      ])
    });
  }

  const ownerPassword = process.env.OWNER_PASSWORD;
  const teamKey = process.env.TEAM_KEY;

  /* Nothing configured yet — say so rather than quietly going public. */
  if (!ownerPassword) {
    return page(
      'Almost there',
      'Add an environment variable named <b>OWNER_PASSWORD</b> in your Vercel project settings, then redeploy. Until then this board stays closed.',
      null, 503
    );
  }

  /* Accepted secrets for this door. The owner password opens everything. */
  const accepted = isTeamDoor && teamKey ? [teamKey, ownerPassword] : [ownerPassword];

  /* Already signed in? */
  const cookie = readCookie(request, COOKIE);
  if (cookie) {
    for (const secret of accepted) {
      if (same(cookie, await stamp(secret, 'v1'))) return next();
    }
  }

  /* Someone submitting the form. */
  if (request.method === 'POST') {
    let entered = '';
    try {
      const body = await request.formData();
      entered = String(body.get('secret') || '').trim();
    } catch (err) {
      entered = '';
    }

    for (const secret of accepted) {
      if (same(entered, secret)) {
        const value = await stamp(secret, 'v1');
        const role = same(secret, ownerPassword) ? 'owner' : 'team';
        return new Response(null, {
          status: 303,
          headers: new Headers([
            ['location', url.pathname],
            ['set-cookie', COOKIE + '=' + value + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + THIRTY_DAYS],
            ['set-cookie', ROLE_COOKIE + '=' + role + '; Path=/; Secure; SameSite=Lax; Max-Age=' + THIRTY_DAYS]
          ])
        });
      }
    }

    return doorPage(isTeamDoor, true);
  }

  return doorPage(isTeamDoor, false);
}

function doorPage(isTeamDoor, wrong) {
  return isTeamDoor
    ? page(
        'Enter your secret key',
        'Ask whoever shared their Sales Team Board with you for their team secret key.',
        { placeholder: 'SECRET KEY', spaced: true, button: 'Go', wrong,
          wrongText: "That key doesn't match. Check it with whoever shared the board." })
    : page(
        'Sign in',
        'This board is private.',
        { placeholder: 'Password', spaced: false, button: 'Sign in', wrong,
          wrongText: "That password doesn't match." });
}

/* A self-contained page: no stylesheet, no script, nothing fetched. */
function page(title, sub, form, status) {
  const field = form
    ? `<form method="POST">
         <label class="sr" for="secret">${form.placeholder}</label>
         <input id="secret" name="secret" type="${form.spaced ? 'text' : 'password'}"
                placeholder="${form.placeholder}" autocomplete="${form.spaced ? 'off' : 'current-password'}"
                autofocus spellcheck="false" class="${form.spaced ? 'spaced' : ''}">
         <button type="submit">${form.button}</button>
       </form>
       ${form.wrong ? `<p class="err">${form.wrongText}</p>` : ''}`
    : '';

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Inevitable Acquisition</title>
<link rel="icon" href="/logo.png" type="image/png">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    padding: 28px 20px; background: #050506; color: #f0f1f3;
    font-family: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .box { width: 100%; max-width: 420px; text-align: center; }
  .brand {
    display: inline-flex; align-items: center; gap: 10px; margin-bottom: 34px;
    font-size: 13.5px; font-weight: 500; letter-spacing: .01em; opacity: .85;
  }
  .brand img { width: 24px; height: 24px; border-radius: 7px; display: block; background: #000; }
  h1 { margin: 0 0 10px; font-size: 26px; font-weight: 300; letter-spacing: -.015em; }
  p.sub { margin: 0 auto 28px; max-width: 36ch; font-size: 13.5px; line-height: 1.6; color: #6d727e; }
  form { display: flex; flex-direction: column; gap: 12px; }
  input {
    width: 100%; padding: 16px; border-radius: 11px; font: inherit; font-size: 15px;
    background: #0e0f12; color: #f0f1f3; border: 1px solid #1f2229; text-align: center;
  }
  input.spaced {
    font-family: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace;
    letter-spacing: .55em; text-indent: .55em; text-transform: uppercase; font-size: 18px;
  }
  input::placeholder { color: #3a3e47; }
  input:focus { outline: none; border-color: #5289c9; background: #15171b; }
  button {
    width: 100%; padding: 15px; border-radius: 11px; font: inherit; font-size: 14px; font-weight: 500;
    background: #2f5f9e; color: #fff; border: 1px solid #2f5f9e; cursor: pointer;
  }
  button:hover { background: #3b82f6; border-color: #3b82f6; }
  .err { margin: 16px 0 0; font-size: 12.5px; color: #f87171; }
  .note { margin: 24px 0 0; font-size: 12.5px; line-height: 1.7; color: #6d727e; }
  .note b { color: #a8adb8; font-weight: 500; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
</head><body>
  <div class="box">
    <span class="brand"><img src="/logo.png" alt="">Inevitable Acquisition</span>
    <h1>${title}</h1>
    <p class="sub">${sub}</p>
    ${field || `<p class="note">${sub ? '' : ''}</p>`}
  </div>
</body></html>`;

  return new Response(html, {
    status: status || 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  });
}
