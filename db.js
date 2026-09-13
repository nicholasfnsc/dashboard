/* ============================================================
   db.js — where the rows live
   ------------------------------------------------------------
   The page asks /api/board for everything and posts changes back.
   That API runs on Vercel's servers, so every device is reading and
   writing the same rows — which is what makes one team see one set
   of numbers.

   If no database is connected yet, the API says so and everything
   falls back to this browser alone. The board still works; it just
   isn't shared until you connect one (Vercel → Storage).

   Reads stay synchronous for the rest of the app: rows sit in CACHE
   and are refreshed after every change, on a timer, and whenever you
   come back to the tab.
   ============================================================ */

const CACHE = { calls: [], team: [], settings: {}, role: 'owner', shared: false };

/* The middleware sets this after a correct password. It decides which
   controls are shown, not what the server will allow. */
function readRoleCookie() {
  const hit = (document.cookie || '').split(';')
    .map((c) => c.trim())
    .find((c) => c.indexOf('ia_role=') === 0);
  return hit ? hit.slice('ia_role='.length) : 'owner';
}

const isShared = () => CACHE.shared;

/* ---------- this browser only, when nothing is connected ---------- */
const local = {
  read(key, fallback) {
    try {
      const raw = localStorage.getItem('ia-dash:' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  },
  write(key, value) {
    try { localStorage.setItem('ia-dash:' + key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }
};

function loadLocal() {
  CACHE.calls = local.read('calls', []) || [];
  CACHE.team = local.read('team', []) || [];
  CACHE.settings = local.read('settings', {}) || {};
}

/* ---------- talking to the server ---------- */
async function ask(payload) {
  const options = payload
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }
    : { method: 'GET' };

  const response = await fetch('/api/board', options);
  if (!response.ok) throw new Error('Board API returned ' + response.status);

  const type = response.headers.get('content-type') || '';
  if (type.indexOf('application/json') === -1) throw new Error('Not signed in');

  return response.json();
}

function absorb(board) {
  CACHE.shared = board.connected === true;
  if (!CACHE.shared) { loadLocal(); return; }
  CACHE.calls = board.calls || [];
  CACHE.team = board.team || [];
  CACHE.settings = board.settings || {};
}

async function loadAll() {
  CACHE.role = readRoleCookie();
  try {
    absorb(await ask(null));
  } catch (err) {
    console.error('Falling back to this browser only', err);
    CACHE.shared = false;
    loadLocal();
  }
}

/* One path for every change: try the server, fall back to local. */
async function change(payload, localUpdate) {
  if (!CACHE.shared) { localUpdate(); return; }
  absorb(await ask(payload));
}

/* ---------- keeping up with everyone else ---------- */
/* No live socket to maintain: a quiet check every 15 seconds, plus one
   the moment you come back to the tab, is enough for a sales board and
   is far less to go wrong. */
function watchChanges(onChange) {
  let busy = false;

  async function poll() {
    if (!CACHE.shared || busy || document.hidden) return;
    busy = true;
    try {
      const before = JSON.stringify([CACHE.calls.length, CACHE.team.length]);
      absorb(await ask(null));
      if (JSON.stringify([CACHE.calls.length, CACHE.team.length]) !== before) onChange();
    } catch (err) {
      /* a blip; the next tick will catch up */
    } finally {
      busy = false;
    }
  }

  setInterval(poll, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
}

function signOut() {
  location.href = location.pathname + '?signout=1';
}

/* ---------- calls ---------- */
async function saveCall(record) {
  await change({ action: 'saveCall', record: record }, () => {
    const rows = CACHE.calls.slice();
    const at = rows.findIndex((r) => r.id === record.id);
    if (at === -1) rows.push(record); else rows[at] = record;
    CACHE.calls = rows;
    local.write('calls', rows);
  });
}

async function deleteCall(id) {
  await change({ action: 'deleteCall', id: id }, () => {
    CACHE.calls = CACHE.calls.filter((r) => r.id !== id);
    local.write('calls', CACHE.calls);
  });
}

/* Undo restores a row that may or may not still exist — save covers both. */
const restoreCall = (record) => saveCall(record);

/* ---------- roster ---------- */
async function addMember(person) {
  await change({ action: 'addMember', person: person }, () => {
    CACHE.team = CACHE.team.concat(person);
    local.write('team', CACHE.team);
  });
}

async function removeMember(person) {
  await change({ action: 'removeMember', person: person }, () => {
    CACHE.team = CACHE.team.filter((x) => !(x.name === person.name && x.role === person.role));
    local.write('team', CACHE.team);
  });
}

async function replaceTeam(people) {
  await change({ action: 'replaceTeam', people: people }, () => {
    CACHE.team = people.slice();
    local.write('team', CACHE.team);
  });
}

/* ---------- settings ---------- */
async function saveSetting(key, value) {
  CACHE.settings[key] = value;
  await change({ action: 'saveSetting', key: key, value: value }, () => {
    local.write('settings', CACHE.settings);
  });
}
