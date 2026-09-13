/* ============================================================
   db.js — where the rows live
   ------------------------------------------------------------
   Two modes, and the rest of the app cannot tell them apart:

     This browser only   nothing configured. Everything is saved
                         locally. Works immediately, no setup, but
                         each person sees only what they typed.

     Shared              config.js filled in. Everything lives in one
                         database, so what anyone logs, everyone sees,
                         and open boards refresh themselves.

   Reads stay synchronous for the rest of the app: rows are pulled
   into CACHE on load and kept current. Writes are async.

   No password or key is in this file. The front door is handled by
   middleware.js on Vercel's servers, before this ever runs.
   ============================================================ */

const CACHE = { calls: [], team: [], settings: {}, role: 'team' };

/* The middleware sets this after a correct password. It decides which
   controls are shown, not what the database will allow. */
function readRoleCookie() {
  const hit = (document.cookie || '').split(';')
    .map((c) => c.trim())
    .find((c) => c.indexOf('ia_role=') === 0);
  return hit ? hit.slice('ia_role='.length) : 'owner';
}

const isConfigured = () =>
  typeof SUPABASE_URL === 'string' &&
  SUPABASE_URL.indexOf('PASTE_') === -1 &&
  typeof SUPABASE_ANON_KEY === 'string' &&
  SUPABASE_ANON_KEY.indexOf('PASTE_') === -1;

const isShared = () => isConfigured();

let sb = null;
function client() {
  if (!sb) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return sb;
}

/* ---------- local mode ---------- */
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

/* ---------- load everything ---------- */
async function loadAll() {
  CACHE.role = readRoleCookie();

  if (!isShared()) {
    CACHE.calls = local.read('calls', []) || [];
    CACHE.team = local.read('team', []) || [];
    CACHE.settings = local.read('settings', {}) || {};
    return;
  }

  const db = client();
  const [calls, team, settings] = await Promise.all([
    db.from('calls').select('data, created_at').order('created_at', { ascending: true }),
    db.from('team').select('name, role, rate').order('created_at', { ascending: true }),
    db.from('settings').select('key, value')
  ]);

  if (calls.error) throw calls.error;

  CACHE.calls = (calls.data || []).map((r) => r.data);
  CACHE.team = team.data || [];
  CACHE.settings = {};
  (settings.data || []).forEach((r) => { CACHE.settings[r.key] = r.value; });
}

/* ---------- live updates ---------- */
function watchChanges(onChange) {
  if (!isShared()) return;

  let pending = null;
  const refresh = () => {
    clearTimeout(pending);                 // a burst of changes costs one reload
    pending = setTimeout(async () => {
      try { await loadAll(); onChange(); }
      catch (err) { console.error('Could not refresh the board', err); }
    }, 250);
  };

  client().channel('board')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team' }, refresh)
    .subscribe();
}

function signOut() {
  location.href = location.pathname + '?signout=1';
}

/* ---------- calls ---------- */
async function saveCall(record) {
  if (!isShared()) {
    const rows = CACHE.calls.slice();
    const at = rows.findIndex((r) => r.id === record.id);
    if (at === -1) rows.push(record); else rows[at] = record;
    local.write('calls', rows);
    CACHE.calls = rows;
    return;
  }

  const { error } = await client().from('calls').upsert({
    id: record.id,
    call_date: record.callDate,
    booked_date: record.bookedDate || record.callDate,
    outcome: record.outcome,
    funnel: record.funnel,
    closer: record.closer,
    setter: record.setter,
    data: record
  }, { onConflict: 'id' });
  if (error) throw error;
  await loadAll();
}

async function deleteCall(id) {
  if (!isShared()) {
    CACHE.calls = CACHE.calls.filter((r) => r.id !== id);
    local.write('calls', CACHE.calls);
    return;
  }
  const { error } = await client().from('calls').delete().eq('id', id);
  if (error) throw error;
  await loadAll();
}

/* Undo restores a row that may or may not still exist — upsert covers both. */
const restoreCall = (record) => saveCall(record);

/* ---------- roster ---------- */
async function addMember(person) {
  if (!isShared()) {
    CACHE.team = CACHE.team.concat(person);
    local.write('team', CACHE.team);
    return;
  }
  const { error } = await client().from('team').insert({
    name: person.name, role: person.role, rate: person.rate
  });
  if (error) throw error;
  await loadAll();
}

async function removeMember(person) {
  if (!isShared()) {
    CACHE.team = CACHE.team.filter((x) => !(x.name === person.name && x.role === person.role));
    local.write('team', CACHE.team);
    return;
  }
  const { error } = await client()
    .from('team').delete().eq('name', person.name).eq('role', person.role);
  if (error) throw error;
  await loadAll();
}

async function replaceTeam(people) {
  if (!isShared()) {
    CACHE.team = people.slice();
    local.write('team', CACHE.team);
    return;
  }
  const db = client();
  const { error: wipe } = await db.from('team').delete().neq('name', '');
  if (wipe) throw wipe;
  if (people.length) {
    const { error } = await db.from('team').insert(
      people.map((p) => ({ name: p.name, role: p.role, rate: p.rate }))
    );
    if (error) throw error;
  }
  await loadAll();
}

/* ---------- settings ---------- */
async function saveSetting(key, value) {
  CACHE.settings[key] = value;
  if (!isShared()) { local.write('settings', CACHE.settings); return; }
  const { error } = await client().from('settings').upsert({ key: key, value: value });
  if (error) throw error;
}
