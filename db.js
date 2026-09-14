/* ============================================================
   db.js — talking to Supabase
   ------------------------------------------------------------
   Everything the portal reads and writes goes through here. The
   database decides what each person may see: this file just asks,
   and whatever comes back is already limited to their offers.

   Reads stay synchronous for the rest of the app: rows sit in CACHE
   and are refreshed after every change, every 15 seconds, and when
   you come back to the tab.
   ============================================================ */

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const CACHE = {
  me: null,            // { id, email, name, isOwner, kind, memberships }
  boards: [],          // offers this person can reach
  boardId: '',
  board: null,         // { id, name, directory }
  role: null,          // on this offer: 'owner' | 'admin' | 'rep'
  code: '',            // this offer's code — managers only
  calls: [],
  team: [],            // active closers and setters on this offer
  allCalls: [],        // hub only: { boardId, record }
  rosterCounts: {}     // hub only: boardId -> active people
};

/* Supabase hands back at most 1,000 rows per request, so large tables
   are read a page at a time. */
async function readAll(build) {
  const size = 1000;
  let from = 0;
  let rows = [];
  for (;;) {
    const { data, error } = await build().range(from, from + size - 1);
    if (error) throw error;
    rows = rows.concat(data || []);
    if (!data || data.length < size) return rows;
    from += size;
  }
}

/* ---------- who is signed in ---------- */
async function currentSession() {
  const { data } = await sb.auth.getSession();
  return data ? data.session : null;
}

async function loadMe() {
  const session = await currentSession();
  if (!session) { CACHE.me = null; return null; }

  const [profile, memberships] = await Promise.all([
    sb.from('profiles').select('is_owner, kind, email, full_name').eq('id', session.user.id).maybeSingle(),
    sb.from('memberships').select('board_id, role').eq('user_id', session.user.id)
  ]);

  const p = profile.data || {};
  const meta = session.user.user_metadata || {};
  CACHE.me = {
    id: session.user.id,
    email: session.user.email,
    /* Name and role live on the account itself, so each person edits
       their own without being able to touch anything that grants access. */
    name: meta.full_name || p.full_name || '',
    title: meta.title || '',
    isOwner: p.is_owner === true,
    kind: p.kind || 'person',
    memberships: memberships.data || [],
    /* Only someone who arrived by invitation and has not yet chosen a
       password. Decided by the account, never by the link, so a person
       who is already signed in can never be shown this screen. */
    needsPassword: !!session.user.invited_at && meta.password_set !== true && p.is_owner !== true
  };
  return CACHE.me;
}

function roleOn(boardId) {
  if (!CACHE.me) return null;
  if (CACHE.me.isOwner) return 'owner';
  const hit = CACHE.me.memberships.find((m) => m.board_id === boardId);
  return hit ? hit.role : null;
}

const canManage = () => CACHE.role === 'owner' || CACHE.role === 'admin';

async function signInWithEmail(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

async function signInWithCode(code) {
  const answer = await fetch('/api/enter', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code })
  });
  const found = await answer.json().catch(() => ({}));
  if (!answer.ok) return { error: found.error || "That code doesn't match any team." };

  const { error } = await sb.auth.signInWithPassword({ email: found.email, password: code.trim().toUpperCase() });
  if (error) return { error: "That code doesn't match any team." };
  return { boardId: found.boardId };
}

async function setMyPassword(password) {
  const { error } = await sb.auth.updateUser({ password, data: { password_set: true } });
  if (!error) return null;

  /* Supabase refuses to "change" a password to the one it already is.
     That only happens when it was already saved — so it is done. */
  if (/different from the old password/i.test(error.message || '')) {
    const { error: flagError } = await sb.auth.updateUser({ data: { password_set: true } });
    return flagError ? flagError.message : null;
  }
  return error.message;
}

async function updateMyProfile(name, title) {
  const { error } = await sb.auth.updateUser({ data: { full_name: name, display_name: name, title } });
  if (error) return error.message;
  CACHE.me.name = name;
  CACHE.me.title = title;
  return null;
}

async function signOut() {
  const wasTeam = CACHE.me && CACHE.me.kind === 'team';
  if (wasTeam && CACHE.boardId) {
    try { localStorage.removeItem('ia-who:' + CACHE.boardId); } catch (e) { /* private window */ }
  }
  await sb.auth.signOut();
  location.href = wasTeam ? TEAM_LOGIN_PATH : '/';
}

/* ---------- server actions that need the secret key ---------- */
async function serverAction(path, payload) {
  const session = await currentSession();
  const answer = await fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + (session ? session.access_token : '')
    },
    body: JSON.stringify(payload)
  });
  const result = await answer.json().catch(() => ({}));
  if (!answer.ok) throw new Error(result.error || 'That did not work.');
  return result;
}

/* ---------- offers ---------- */
async function loadBoards() {
  const { data, error } = await sb.from('boards')
    .select('id, name, directory, created_at')
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  CACHE.boards = data || [];
}

async function loadHub() {
  await loadBoards();
  const [calls, roster] = await Promise.all([
    readAll(() => sb.from('calls').select('board_id, data').order('created_at', { ascending: true })),
    readAll(() => sb.from('roster').select('board_id').eq('active', true))
  ]);
  CACHE.allCalls = calls.map((r) => ({ boardId: r.board_id, record: r.data }));
  CACHE.rosterCounts = {};
  roster.forEach((r) => { CACHE.rosterCounts[r.board_id] = (CACHE.rosterCounts[r.board_id] || 0) + 1; });
}

async function loadBoard(boardId) {
  CACHE.boardId = boardId;
  CACHE.role = roleOn(boardId);

  const [board, roster, calls] = await Promise.all([
    sb.from('boards').select('id, name, directory').eq('id', boardId).maybeSingle(),
    sb.from('roster').select('name, role, rate, active').eq('board_id', boardId).order('created_at'),
    readAll(() => sb.from('calls').select('data').eq('board_id', boardId).order('created_at', { ascending: true })),
    loadRepHub()
  ]);
  if (board.error) throw board.error;

  CACHE.board = board.data;
  CACHE.team = (roster.data || []).filter((p) => p.active)
    .map((p) => ({ name: p.name, role: p.role, rate: Number(p.rate) }));
  CACHE.calls = calls.map((r) => r.data);

  CACHE.code = '';
  if (canManage()) {
    const { data } = await sb.from('board_codes').select('code').eq('board_id', boardId).maybeSingle();
    CACHE.code = data ? data.code : '';
  }
}

async function createBoard() {
  const result = await serverAction('/api/boards', { action: 'create' });
  await loadMe();
  return result;
}

async function rotateCode(boardId) {
  const result = await serverAction('/api/boards', { action: 'rotate', boardId });
  if (boardId === CACHE.boardId) CACHE.code = result.code;
  return result.code;
}

async function archiveBoard(boardId) {
  return serverAction('/api/boards', { action: 'archive', boardId });
}

async function renameBoard(name) {
  const { error } = await sb.from('boards').update({ name }).eq('id', CACHE.boardId);
  if (error) throw error;
  CACHE.board.name = name;
  const listed = CACHE.boards.find((b) => b.id === CACHE.boardId);
  if (listed) listed.name = name;

  /* The team login in Supabase takes the new name, and the offer's address
     follows it. Not critical, so a failure here never undoes the rename. */
  try {
    await serverAction('/api/boards', { action: 'names', boardId: CACHE.boardId });
    await refreshBoardDirectory();
  } catch (err) {
    console.error(err);
  }
}

/* ---------- offer addresses ----------
   /sales-dashboard/<slug>. The server picks the slug so no two offers
   share one; old slugs keep opening the same offer after a rename. */
const SALES_PATH = '/sales-dashboard';

function slugify(name) {
  return String(name || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60).replace(/-+$/, '') || 'offer';
}

function boardPath(board) {
  if (!board) return SALES_PATH;
  const slug = (board.directory && board.directory.slug) || board.id;
  return SALES_PATH + '/' + slug;
}

function findBoardBySlug(slug) {
  const s = String(slug || '').toLowerCase();
  const has = (b, key) => b.directory && (key === 'slug' ? b.directory.slug === s
    : Array.isArray(b.directory.oldSlugs) && b.directory.oldSlugs.indexOf(s) !== -1);
  return CACHE.boards.find((b) => b.id === s)
    || CACHE.boards.find((b) => has(b, 'slug'))
    || CACHE.boards.find((b) => has(b, 'old'))
    || CACHE.boards.find((b) => slugify(b.name) === s)
    || null;
}

async function refreshBoardDirectory() {
  const { data, error } = await sb.from('boards').select('directory').eq('id', CACHE.boardId).maybeSingle();
  if (error || !data) return;
  CACHE.board.directory = data.directory || {};
  const listed = CACHE.boards.find((b) => b.id === CACHE.boardId);
  if (listed) listed.directory = CACHE.board.directory;
}

/* ---------- Rep Hub ---------- */
/* The shared template. Until the one-time setup is run, the built-in
   template still shows — it just cannot be saved yet. */
async function loadRepHub() {
  const { data, error } = await sb.from('rep_hub').select('content').eq('id', 1).maybeSingle();
  const saved = !error && data && data.content && Array.isArray(data.content.sections) ? data.content : null;
  CACHE.repHubReady = !error;
  CACHE.repHub = saved || JSON.parse(JSON.stringify(DEFAULT_REP_HUB));
}

async function saveRepHubTemplate() {
  const { error } = await sb.from('rep_hub')
    .upsert({ id: 1, content: CACHE.repHub, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/* "This offer only" values live on the offer itself. The offer is read
   fresh first, so a change someone else just made — another value, or
   the offer's address — is kept rather than written over. */
async function saveOfferHubValue(itemId, value) {
  const { data, error: readError } = await sb.from('boards').select('directory').eq('id', CACHE.boardId).maybeSingle();
  if (readError) throw readError;
  const directory = Object.assign({}, (data && data.directory) || CACHE.board.directory || {});
  directory.repHub = Object.assign({}, directory.repHub || {});
  directory.repHub[itemId] = value;

  const { error } = await sb.from('boards').update({ directory }).eq('id', CACHE.boardId);
  if (error) throw error;
  CACHE.board.directory = directory;
}

/* ---------- calls ---------- */
async function saveCall(record) {
  const { error } = await sb.from('calls').upsert({
    id: record.id,
    board_id: CACHE.boardId,
    call_date: record.callDate || null,
    outcome: record.outcome,
    logged_by: record.loggedBy || null,
    data: record
  }, { onConflict: 'id' });
  if (error) throw error;

  const rows = CACHE.calls.slice();
  const at = rows.findIndex((r) => r.id === record.id);
  if (at === -1) rows.push(record); else rows[at] = record;
  CACHE.calls = rows;
}

async function deleteCall(id) {
  const { error } = await sb.from('calls').delete().eq('id', id).eq('board_id', CACHE.boardId);
  if (error) throw error;
  CACHE.calls = CACHE.calls.filter((r) => r.id !== id);
}

const restoreCall = (record) => saveCall(record);

/* ---------- roster ---------- */
async function reloadRoster() {
  const { data, error } = await sb.from('roster')
    .select('name, role, rate, active').eq('board_id', CACHE.boardId).order('created_at');
  if (error) throw error;
  CACHE.team = (data || []).filter((p) => p.active)
    .map((p) => ({ name: p.name, role: p.role, rate: Number(p.rate) }));
}

async function addMember(person) {
  const { error } = await sb.from('roster').upsert({
    board_id: CACHE.boardId, name: person.name, role: person.role, rate: person.rate, active: true
  }, { onConflict: 'board_id,name,role' });
  if (error) throw error;
  await reloadRoster();
}

/* Switched off, never deleted — their history still adds up. */
async function removeMember(person) {
  const { error } = await sb.from('roster').update({ active: false })
    .eq('board_id', CACHE.boardId).eq('name', person.name).eq('role', person.role);
  if (error) throw error;
  await reloadRoster();
}

/* A person's commission in one role, as a fraction (0.1 = 10%). */
async function setMemberRate(person, rate) {
  const { error } = await sb.from('roster').update({ rate })
    .eq('board_id', CACHE.boardId).eq('name', person.name).eq('role', person.role);
  if (error) throw error;
  await reloadRoster();
}

async function replaceTeam(people) {
  const keep = new Set(people.map((p) => p.role + '|' + p.name));
  for (const p of CACHE.team) {
    if (!keep.has(p.role + '|' + p.name)) await removeMember(p);
  }
  for (const p of people) await addMember(p);
}

/* ---------- admins (owner) ---------- */
const listAdmins = () => serverAction('/api/people', { action: 'list' });
const inviteAdmin = (name, email, title, boardIds) => serverAction('/api/people', { action: 'invite', name, email, title, boardIds });
const setAdminAccess = (userId, boardIds) => serverAction('/api/people', { action: 'access', userId, boardIds });
const removeAdmin = (userId) => serverAction('/api/people', { action: 'remove', userId });

/* ---------- keeping up with everyone else ---------- */
function watchChanges(onChange) {
  let busy = false;
  let last = '';

  async function signature() {
    const query = sb.from('calls').select('id, updated_at').order('updated_at', { ascending: false }).limit(1);
    const scoped = CACHE.boardId ? query.eq('board_id', CACHE.boardId) : query;
    const [{ data: latest }, { count }] = await Promise.all([
      scoped,
      (CACHE.boardId
        ? sb.from('calls').select('id', { count: 'exact', head: true }).eq('board_id', CACHE.boardId)
        : sb.from('calls').select('id', { count: 'exact', head: true }))
    ]);
    return String(count) + '|' + (latest && latest[0] ? latest[0].updated_at : '');
  }

  async function poll() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const now = await signature();
      if (last && now !== last) {
        if (CACHE.boardId) await loadBoard(CACHE.boardId); else await loadHub();
        onChange();
      }
      last = now;
    } catch (err) {
      /* a blip; the next tick catches up */
    } finally {
      busy = false;
    }
  }

  poll();
  setInterval(poll, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
}
