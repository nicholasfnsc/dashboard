/* ============================================================
   db.js — where the rows live
   ------------------------------------------------------------
   Which board you are looking at comes from the address:

     /                  the hub — every board, plus the totals
     /sales-team/ABCD   that board alone

   Every read and every write carries that board's key, so one
   offer's numbers can never appear on another's.
   ============================================================ */

const CACHE = {
  calls: [], team: [], settings: {},
  role: 'owner', shared: false,
  boardKey: '', board: null,
  boards: [], allCalls: [], allTeam: []
};

function readRoleCookie() {
  const hit = (document.cookie || '').split(';')
    .map((c) => c.trim())
    .find((c) => c.indexOf('ia_role=') === 0);
  return hit ? hit.slice('ia_role='.length) : 'owner';
}

/* The address bar still reads /sales-team/ABCD after the server serves
   the app, so it is the honest source for which board this is. */
function boardKeyFromUrl() {
  const hit = location.pathname.match(/^\/sales-team\/([A-Za-z0-9]{1,12})\/?$/);
  return hit ? hit[1].toUpperCase() : '';
}

const isShared = () => CACHE.shared;
const isHub = () => !CACHE.boardKey;

/* ---------- this browser only, when no database is connected ---------- */
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

const localKey = (name) => name + (CACHE.boardKey ? ':' + CACHE.boardKey : '');

function loadLocal() {
  CACHE.calls = local.read(localKey('calls'), []) || [];
  CACHE.team = local.read(localKey('team'), []) || [];
  CACHE.settings = local.read(localKey('settings'), {}) || {};
  CACHE.boards = local.read('boards', []) || [];
}

/* ---------- talking to the server ---------- */
async function ask(payload, query) {
  const url = '/api/board' + (query || '');
  const options = payload
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }
    : { method: 'GET' };

  const response = await fetch(url, options);
  const type = response.headers.get('content-type') || '';
  if (type.indexOf('application/json') === -1) throw new Error('Not signed in');

  const body = await response.json();
  if (!response.ok) throw new Error(body.error || ('Board API returned ' + response.status));
  return body;
}

function absorb(board) {
  CACHE.shared = board.connected === true;
  if (!CACHE.shared) { loadLocal(); return; }

  if (board.boards) CACHE.boards = board.boards;
  if (board.allCalls) CACHE.allCalls = board.allCalls;
  if (board.allTeam) CACHE.allTeam = board.allTeam;

  if (board.board) CACHE.board = board.board;
  CACHE.calls = board.calls || [];
  CACHE.team = board.team || [];
  CACHE.settings = board.settings || {};
}

async function loadAll() {
  CACHE.role = readRoleCookie();
  CACHE.boardKey = boardKeyFromUrl();

  try {
    absorb(await ask(null, CACHE.boardKey ? '?key=' + encodeURIComponent(CACHE.boardKey) : ''));
  } catch (err) {
    console.error('Falling back to this browser only', err);
    CACHE.shared = false;
    loadLocal();
  }
}

/* One path for every change: the server when connected, otherwise here. */
async function change(payload, localUpdate) {
  if (!CACHE.shared) { localUpdate(); return; }
  absorb(await ask(Object.assign({ boardKey: CACHE.boardKey }, payload)));
}

/* ---------- keeping up with everyone else ---------- */
function watchChanges(onChange) {
  let busy = false;

  async function poll() {
    if (!CACHE.shared || busy || document.hidden) return;
    busy = true;
    try {
      const before = JSON.stringify([CACHE.calls.length, CACHE.team.length, CACHE.boards.length]);
      absorb(await ask(null, CACHE.boardKey ? '?key=' + encodeURIComponent(CACHE.boardKey) : ''));
      if (JSON.stringify([CACHE.calls.length, CACHE.team.length, CACHE.boards.length]) !== before) onChange();
    } catch (err) {
      /* a blip; the next tick catches up */
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

/* ---------- boards ---------- */
async function createBoard(name) {
  if (!CACHE.shared) {
    const key = Math.random().toString(36).slice(2, 6).toUpperCase();
    CACHE.boards = CACHE.boards.concat({ key: key, name: name });
    local.write('boards', CACHE.boards);
    return;
  }
  absorb(await ask({ action: 'createBoard', name: name }));
}

async function renameBoard(key, name) {
  if (!CACHE.shared) {
    CACHE.boards = CACHE.boards.map((b) => (b.key === key ? Object.assign({}, b, { name: name }) : b));
    local.write('boards', CACHE.boards);
    return;
  }
  absorb(await ask({ action: 'renameBoard', boardKey: key, name: name }));
}

async function deleteBoard(key) {
  if (!CACHE.shared) {
    CACHE.boards = CACHE.boards.filter((b) => b.key !== key);
    local.write('boards', CACHE.boards);
    return;
  }
  absorb(await ask({ action: 'deleteBoard', boardKey: key }));
}

/* ---------- calls ---------- */
async function saveCall(record) {
  await change({ action: 'saveCall', record: record }, () => {
    const rows = CACHE.calls.slice();
    const at = rows.findIndex((r) => r.id === record.id);
    if (at === -1) rows.push(record); else rows[at] = record;
    CACHE.calls = rows;
    local.write(localKey('calls'), rows);
  });
}

async function deleteCall(id) {
  await change({ action: 'deleteCall', id: id }, () => {
    CACHE.calls = CACHE.calls.filter((r) => r.id !== id);
    local.write(localKey('calls'), CACHE.calls);
  });
}

const restoreCall = (record) => saveCall(record);

/* ---------- roster ---------- */
async function addMember(person) {
  await change({ action: 'addMember', person: person }, () => {
    CACHE.team = CACHE.team.concat(person);
    local.write(localKey('team'), CACHE.team);
  });
}

async function removeMember(person) {
  await change({ action: 'removeMember', person: person }, () => {
    CACHE.team = CACHE.team.filter((x) => !(x.name === person.name && x.role === person.role));
    local.write(localKey('team'), CACHE.team);
  });
}

async function replaceTeam(people) {
  await change({ action: 'replaceTeam', people: people }, () => {
    CACHE.team = people.slice();
    local.write(localKey('team'), CACHE.team);
  });
}

/* ---------- settings ---------- */
async function saveSetting(key, value) {
  CACHE.settings[key] = value;
  await change({ action: 'saveSetting', key: key, value: value }, () => {
    local.write(localKey('settings'), CACHE.settings);
  });
}
