/* ============================================================
   db.js — shared storage and sign-in
   ------------------------------------------------------------
   Everything the board shows lives in one Supabase database, so what
   any team member logs is what everyone sees.

   Reads stay synchronous for the rest of the app: rows are pulled
   once at sign-in into CACHE, and a realtime subscription refreshes
   CACHE whenever anybody changes anything. Writes are async and
   re-render when they land.

   No password or key is stored here. Sign-in sends what the person
   typed to Supabase, which checks it against a hash on their server
   and answers yes or no. Nothing secret ever reaches this file.
   ============================================================ */

const CACHE = { calls: [], team: [], settings: {}, role: 'team', email: '' };

let sb = null;
function client() {
  if (!sb) {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('Supabase library did not load');
    }
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return sb;
}

const isConfigured = () =>
  typeof SUPABASE_URL === 'string' &&
  SUPABASE_URL.indexOf('PASTE_') === -1 &&
  SUPABASE_ANON_KEY.indexOf('PASTE_') === -1;

/* ---------- sign in ---------- */
async function signInOwner(email, password) {
  const { error } = await client().auth.signInWithPassword({ email: email, password: password });
  return error ? error.message : null;
}

/* The team types a key; the key is the shared account's password, so
   Supabase does the checking. */
async function signInTeam(key) {
  const { error } = await client().auth.signInWithPassword({
    email: TEAM_ACCOUNT_EMAIL,
    password: key
  });
  return error ? error.message : null;
}

async function signOut() {
  await client().auth.signOut();
  location.reload();
}

async function currentSession() {
  const { data } = await client().auth.getSession();
  return data ? data.session : null;
}

/* ---------- load everything ---------- */
async function loadAll() {
  const db = client();

  const [calls, team, settings, profile] = await Promise.all([
    db.from('calls').select('data, created_at').order('created_at', { ascending: true }),
    db.from('team').select('name, role, rate').order('created_at', { ascending: true }),
    db.from('settings').select('key, value'),
    db.from('profiles').select('role').maybeSingle()
  ]);

  if (calls.error) throw calls.error;

  CACHE.calls = (calls.data || []).map((r) => r.data);
  CACHE.team = team.data || [];
  CACHE.settings = {};
  (settings.data || []).forEach((r) => { CACHE.settings[r.key] = r.value; });
  CACHE.role = profile.data && profile.data.role ? profile.data.role : 'team';

  const session = await currentSession();
  CACHE.email = session && session.user ? session.user.email : '';
}

/* ---------- live updates ---------- */
/* Someone else logging a call should show up here without a refresh. */
function watchChanges(onChange) {
  const db = client();
  db.channel('board')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team' }, refresh)
    .subscribe();

  let pending = null;
  function refresh() {
    clearTimeout(pending);                 // a burst of changes costs one reload
    pending = setTimeout(async () => {
      try {
        await loadAll();
        onChange();
      } catch (err) {
        console.error('Could not refresh the board', err);
      }
    }, 250);
  }
}

/* ---------- calls ---------- */
function callRow(record, userId) {
  return {
    id: record.id,
    call_date: record.callDate,
    booked_date: record.bookedDate || record.callDate,
    outcome: record.outcome,
    funnel: record.funnel,
    closer: record.closer,
    setter: record.setter,
    data: record,
    logged_by: userId || null
  };
}

async function saveCall(record) {
  const session = await currentSession();
  const userId = session && session.user ? session.user.id : null;
  const { error } = await client()
    .from('calls')
    .upsert(callRow(record, userId), { onConflict: 'id' });
  if (error) throw error;
  await loadAll();
}

async function deleteCall(id) {
  const { error } = await client().from('calls').delete().eq('id', id);
  if (error) throw error;
  await loadAll();
}

/* Undo restores a row that may or may not still exist — upsert covers both. */
async function restoreCall(record) {
  return saveCall(record);
}

/* ---------- roster ---------- */
async function addMember(person) {
  const { error } = await client().from('team').insert({
    name: person.name, role: person.role, rate: person.rate
  });
  if (error) throw error;
  await loadAll();
}

async function removeMember(person) {
  const { error } = await client()
    .from('team').delete().eq('name', person.name).eq('role', person.role);
  if (error) throw error;
  await loadAll();
}

async function replaceTeam(people) {
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
  const { error } = await client().from('settings').upsert({ key: key, value: value });
  if (error) throw error;
  CACHE.settings[key] = value;
}
