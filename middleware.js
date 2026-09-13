import { next } from '@vercel/edge';

/* ============================================================
   middleware.js — the front door

   One password, one door. Vercel checks it on its servers before a
   single file is sent, so anyone without it never receives the
   dashboard at all — not the HTML, not the scripts, not a number.

   The password lives in Vercel → Settings → Environment Variables
   as OWNER_PASSWORD. It is never in this repo and never reaches a
   browser. Share it with whoever should see the board.

   To take the door off entirely and make the site public: delete
   this file and redeploy.
   ============================================================ */

const COOKIE = 'ia_pass';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

/* The cookie holds a hash, so a stolen cookie never reveals the
   password — and changing the password invalidates every old cookie. */
async function stamp(secret) {
  const bytes = new TextEncoder().encode('ia-dash|v1|' + secret);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  const hit = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(name + '='));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : '';
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
  const path = url.pathname.replace(/\/+$/, '') || '/';

  /* The API guards itself and the sign-in page needs the logo. */
  if (path === '/logo.png' || path.startsWith('/api/')) return next();

  if (url.searchParams.has('signout')) {
    return new Response(null, {
      status: 303,
      headers: {
        location: '/',
        'set-cookie': COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
      }
    });
  }

  const password = process.env.OWNER_PASSWORD;
  if (!password) {
    return page('Almost there',
      'Add an environment variable named <b>OWNER_PASSWORD</b> in your Vercel project settings, then redeploy. Until then this board stays closed.',
      false, 503);
  }

  const good = await stamp(password);
  if (same(readCookie(request, COOKIE), good)) return next();

  if (request.method === 'POST') {
    let entered = '';
    try {
      entered = String((await request.formData()).get('secret') || '').trim();
    } catch (err) {
      entered = '';
    }

    if (same(entered, password)) {
      return new Response(null, {
        status: 303,
        headers: {
          location: path,
          'set-cookie': COOKIE + '=' + good + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + THIRTY_DAYS
        }
      });
    }

    await new Promise((done) => setTimeout(done, 1000));   // guessing should cost something
    return page('Sign in', 'This board is private.', true);
  }

  return page('Sign in', 'This board is private.', false);
}

/* A self-contained page: no stylesheet, no script, nothing fetched. */
function page(title, sub, wrong, status) {
  const form = status ? '' : `<form method="POST">
         <label class="sr" for="secret">Password</label>
         <input id="secret" name="secret" type="password" placeholder="Password"
                autocomplete="current-password" autofocus spellcheck="false">
         <button type="submit">Sign in</button>
       </form>
       ${wrong ? '<p class="err">That password doesn\'t match.</p>' : ''}`;

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
    ${form}
  </div>
</body></html>`;

  return new Response(html, {
    status: status || 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  });
}
