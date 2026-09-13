import { next, rewrite } from '@vercel/edge';

/* ============================================================
   middleware.js — the front door

   Runs on Vercel's servers before any file is sent, so someone
   without a way in never receives the board at all.

   Three kinds of address:
     /                    your hub. OWNER_PASSWORD.
     /sales-team          key entry for a sales team.
     /sales-team/ABCD     that board, once the key has been entered.

   Your password opens everything. A board key opens that board and
   nothing else — not the hub, not another offer.

   OWNER_PASSWORD lives in Vercel's settings. Board keys live in the
   database, so a new board costs a click rather than a deploy.

   To take the door off entirely: delete this file and redeploy.
   ============================================================ */

/* Deliberately no matcher. This runs on every request and decides in one
   visible place what is let through — a matcher pattern that quietly fails
   to exclude the endpoint the front door depends on is worse than a line
   of code you can read. */

const PASS_COOKIE = 'ia_pass';
const ROLE_COOKIE = 'ia_role';    /* readable by the page, so it can show owner-only controls */
const BOARD_COOKIE = 'ia_board';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

/* Cookies hold a hash, so a stolen cookie never reveals the secret —
   and changing a secret invalidates every cookie issued under it. */
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

/* Board keys are checked against the database, since boards are made
   without a deploy. The endpoint answers only true or false. */
async function keyIsReal(request, key) {
  const check = new URL('/api/board?verify=' + encodeURIComponent(key), request.url);
  const answer = await fetch(check.toString(), { headers: { 'x-ia-check': '1' } });
  if (!answer.ok) throw new Error('Key check failed with ' + answer.status);
  const body = await answer.json();
  if (body && body.connected === false) throw new Error('No database connected');
  return !!(body && body.valid === true);
}

async function submitted(request) {
  try {
    const body = await request.formData();
    return String(body.get('secret') || '').trim();
  } catch (err) {
    return '';
  }
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  /* The API guards itself: it recomputes the same stamps this file issues
     and refuses anything it cannot verify. It must stay reachable, since
     checking a key is how anyone gets in at all. The logo is needed by the
     sign-in page before there is any session. */
  if (path === '/logo.png' || path.startsWith('/api/')) return next();

  const teamMatch = path.match(/^\/sales-team(?:\/([A-Za-z0-9]{1,12}))?$/);
  const isTeamDoor = !!teamMatch;
  const pathKey = teamMatch && teamMatch[1] ? teamMatch[1].toUpperCase() : '';

  if (url.searchParams.has('signout')) {
    return new Response(null, {
      status: 303,
      headers: new Headers([
        ['location', isTeamDoor ? '/sales-team' : '/'],
        ['set-cookie', PASS_COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'],
        ['set-cookie', ROLE_COOKIE + '=; Path=/; Secure; SameSite=Lax; Max-Age=0'],
        ['set-cookie', BOARD_COOKIE + '=; Path=/; Secure; SameSite=Lax; Max-Age=0']
      ])
    });
  }

  const ownerPassword = process.env.OWNER_PASSWORD;
  if (!ownerPassword) {
    return page('Almost there',
      'Add an environment variable named <b>OWNER_PASSWORD</b> in your Vercel project settings, then redeploy. Until then this board stays closed.',
      null, 503);
  }

  const ownerStamp = await stamp(ownerPassword, 'v1');
  const signedInAsOwner = same(readCookie(request, PASS_COOKIE) || '', ownerStamp);

  /* ---------- the hub, and anything that is not a team door ---------- */
  if (!isTeamDoor) {
    if (signedInAsOwner) return next();

    if (request.method === 'POST') {
      if (same(await submitted(request), ownerPassword)) {
        return new Response(null, {
          status: 303,
          headers: new Headers([
            ['location', path],
            ['set-cookie', PASS_COOKIE + '=' + ownerStamp + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + THIRTY_DAYS],
            ['set-cookie', ROLE_COOKIE + '=owner; Path=/; Secure; SameSite=Lax; Max-Age=' + THIRTY_DAYS]
          ])
        });
      }
      await new Promise((done) => setTimeout(done, 1000));   // guessing should cost something
      return ownerPage(true);
    }

    return ownerPage(false);
  }

  /* ---------- a sales team's door ---------- */
  /* From the hub you walk into any board without typing its key. */
  if (signedInAsOwner && pathKey) return rewrite(new URL('/', request.url));

  const boardCookie = readCookie(request, BOARD_COOKIE) || '';
  if (pathKey && same(boardCookie, await stamp(pathKey, 'board'))) {
    return rewrite(new URL('/', request.url));
  }

  if (request.method === 'POST') {
    const entered = (await submitted(request)).toUpperCase();

    let valid = false;
    try {
      valid = entered ? await keyIsReal(request, entered) : false;
    } catch (err) {
      return page('Not ready yet',
        'The board could not be checked just now. If this keeps happening, the database may not be connected — '
        + 'open the hub and confirm the board exists.', null, 503);
    }

    if (valid) {
      return new Response(null, {
        status: 303,
        headers: new Headers([
          ['location', '/sales-team/' + entered],
          ['set-cookie', BOARD_COOKIE + '=' + (await stamp(entered, 'board')) + '; Path=/; Secure; SameSite=Lax; Max-Age=' + THIRTY_DAYS],
          ['set-cookie', ROLE_COOKIE + '=team; Path=/; Secure; SameSite=Lax; Max-Age=' + THIRTY_DAYS]
        ])
      });
    }
    await new Promise((done) => setTimeout(done, 1000));
    return teamPage(true);
  }

  return teamPage(false);
}

const ownerPage = (wrong) => page('Sign in', 'This board is private.', {
  placeholder: 'Password', spaced: false, button: 'Sign in', wrong,
  wrongText: "That password doesn't match."
});

const teamPage = (wrong) => page('Enter your secret key',
  'Ask whoever shared their Sales Team Board with you for their team secret key.', {
    placeholder: 'SECRET KEY', spaced: true, button: 'Go', wrong,
    wrongText: "That key doesn't match. Check it with whoever shared the board."
  });

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
    letter-spacing: .55em; text-indent: .55em; font-size: 18px;
  }
  input::placeholder { color: #3a3e47; }
  input:focus { outline: none; border-color: #5289c9; background: #15171b; }
  button {
    width: 100%; padding: 15px; border-radius: 11px; font: inherit; font-size: 14px; font-weight: 500;
    background: #2f5f9e; color: #fff; border: 1px solid #2f5f9e; cursor: pointer;
  }
  button:hover { background: #3b82f6; border-color: #3b82f6; }
  .err { margin: 16px 0 0; font-size: 12.5px; color: #f87171; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
</head><body>
  <div class="box">
    <span class="brand"><img src="/logo.png" alt="">Inevitable Acquisition</span>
    <h1>${title}</h1>
    <p class="sub">${sub}</p>
    ${field}
  </div>
</body></html>`;

  return new Response(html, {
    status: status || 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  });
}
