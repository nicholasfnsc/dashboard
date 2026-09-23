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

  const readAccount = () => Promise.all([
    sb.from('profiles').select('is_owner, kind, email, full_name').eq('id', session.user.id).maybeSingle(),
    sb.from('memberships').select('board_id, role').eq('user_id', session.user.id),
    sb.from('admin_access').select('sections, all_offers').eq('user_id', session.user.id).maybeSingle()
  ]);

  let [profile, memberships, access] = await readAccount();

  /* A sign-in kept on a device can go stale. If the account can't be read,
     refresh the sign-in once and try again before deciding anything. */
  if (profile.error || memberships.error) {
    console.error('loadMe: could not read the account', profile.error || memberships.error);
    try { await sb.auth.refreshSession(); } catch (e) { /* tried */ }
    [profile, memberships, access] = await readAccount();
  }

  const p = profile.data || {};
  const meta = session.user.user_metadata || {};
  const rows = memberships.data || [];

  /* What an admin may use. Until access.sql has been run, admins keep
     what they always had: the sales boards for their offers. */
  let sections;
  let allOffers = false;
  if (p.is_owner === true) {
    sections = PORTAL_SECTION_KEYS.slice();
    allOffers = true;
  } else if (!access.error) {
    sections = (access.data && access.data.sections) || [];
    allOffers = !!(access.data && access.data.all_offers);
  } else {
    sections = rows.some((m) => m.role === 'admin') ? ['sales'] : [];
  }
  CACHE.me = {
    id: session.user.id,
    email: session.user.email,
    /* Name and role live on the account itself, so each person edits
       their own without being able to touch anything that grants access. */
    name: meta.full_name || p.full_name || '',
    title: meta.title || '',
    avatar: meta.avatar_url || '',
    clock: meta.clock || null,
    /* true when the account itself could not be read — never mistaken for "no access" */
    unreadable: !!(profile.error || memberships.error),
    isOwner: p.is_owner === true,
    kind: p.kind || 'person',
    memberships: rows,
    sections,
    allOffers,
    /* Only someone who arrived by invitation and has not yet chosen a
       password. Decided by the account, never by the link, so a person
       who is already signed in can never be shown this screen. */
    needsPassword: !!session.user.invited_at && meta.password_set !== true && p.is_owner !== true
  };
  return CACHE.me;
}

/* The parts of the portal, in the order the owner ticks them. */
/* Signal List is the owner's alone, so it is never offered to admins. */
const PORTAL_SECTION_KEYS = ['sales', 'metrics', 'funnel', 'content', 'playbooks'];
const PORTAL_SECTION_NAMES = {
  sales: 'Sales Team Boards',
  metrics: 'Metrics Tracking',
  funnel: 'Funnel Revenue Projections',
  playbooks: '$1M/Month Playbooks',
  content: 'Weekly Content Hub'
};

const canUse = (section) => !!CACHE.me && CACHE.me.kind === 'person' &&
  (CACHE.me.isOwner || CACHE.me.sections.indexOf(section) !== -1);

/* Role on an offer's sales board — the same rule the database uses. */
function roleOn(boardId) {
  if (!CACHE.me) return null;
  if (CACHE.me.isOwner) return 'owner';
  if (CACHE.me.memberships.some((m) => m.board_id === boardId && m.role === 'rep')) return 'rep';
  const offerAllowed = CACHE.me.allOffers ||
    CACHE.me.memberships.some((m) => m.board_id === boardId && m.role === 'admin');
  return offerAllowed && canUse('sales') ? 'admin' : null;
}

const canManage = () => CACHE.role === 'owner' || CACHE.role === 'admin';

/* Some things are shared by every offer: the Rep Hub template itself, its
   "All offers" values, and the Audio Transcriber's Loom and handoff form.
   An admin who only has some offers would be changing what the offers they
   cannot see show, so those stay with the owner and admins who have every
   offer. Rows marked "This offer only" are open to any admin of the offer. */
const canEditShared = () => CACHE.role === 'owner'
  || (CACHE.role === 'admin' && !!(CACHE.me && CACHE.me.allOffers));

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

/* Profile picture: cropped to a square and shrunk here, stored by the
   server, and its address kept on the account. */
function squareJpeg(file, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.getContext('2d').drawImage(img,
        (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a picture we can read.')); };
    img.src = url;
  });
}

async function setMyAvatar(file) {
  const image = await squareJpeg(file, 320);
  const { url } = await serverAction('/api/profile', { action: 'avatar', image });
  const { error } = await sb.auth.updateUser({ data: { avatar_url: url } });
  if (error) throw error;
  CACHE.me.avatar = url;
  return url;
}

async function removeMyAvatar() {
  await serverAction('/api/profile', { action: 'remove' });
  const { error } = await sb.auth.updateUser({ data: { avatar_url: '' } });
  if (error) throw error;
  CACHE.me.avatar = '';
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

async function renameBoard(name, quiet) {
  const was = CACHE.board.name;
  if (!quiet && was !== name) {
    pushUndo({ kind: 'renameBoard', label: 'Renamed the offer to ' + name, name: was });
  }
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
  SHARED_HISTORY.reset();
}

/* Rep Hub rows, the handoff form, the Loom and the playbooks all live in
   the same shared settings, so one history covers the lot. An offer's own
   values live on the offer, and travel with it. */
const SHARED_HISTORY = makeHistory(
  () => ({
    hub: CACHE.repHub,
    offer: (CACHE.board && CACHE.board.directory && CACHE.board.directory.repHub) || null
  }),
  (was) => {
    CACHE.repHub = was.hub;
    if (was.offer && CACHE.board) {
      CACHE.board.directory = Object.assign({}, CACHE.board.directory, { repHub: was.offer });
    }
    saveSharedBack(was);
  }
);

/* Putting a step back writes it where it came from. */
async function saveSharedBack(was) {
  try {
    await sb.from('rep_hub').upsert({ id: 1, content: was.hub, updated_at: new Date().toISOString() });
    if (was.offer && CACHE.boardId) {
      const { data } = await sb.from('boards').select('directory').eq('id', CACHE.boardId).maybeSingle();
      const directory = Object.assign({}, (data && data.directory) || {}, { repHub: was.offer });
      await sb.from('boards').update({ directory }).eq('id', CACHE.boardId);
      CACHE.board.directory = directory;
    }
    notify('Undone.');
  } catch (err) {
    console.error(err);
    notify("Couldn't undo that — check your connection.");
  }
  if (typeof renderRepHub === 'function' && document.getElementById('repHubContent')) renderRepHub();
  if (typeof renderPlaybooks === 'function') renderPlaybooks();
  if (typeof renderTranscriberGuide === 'function' && document.getElementById('transcriberGuide')) { renderTranscriberGuide(); renderHandoff(); }
}

registerUndo({
  label: 'rep hub, handoffs and playbooks',
  when: () => shellShown('playbookShell') ||
    (shellShown('boardShell') && !!document.querySelector('[data-panel="rephub"]:not(.hidden), [data-panel="transcriber"]:not(.hidden)')),
  undo: () => SHARED_HISTORY.undo(),
  redo: () => SHARED_HISTORY.redo()
});

async function saveRepHubTemplate() {
  SHARED_HISTORY.remember();
  const { error } = await sb.from('rep_hub')
    .upsert({ id: 1, content: CACHE.repHub, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/* "This offer only" values live on the offer itself. The offer is read
   fresh first, so a change someone else just made — another value, or
   the offer's address — is kept rather than written over. */
async function saveOfferHubValue(itemId, value) {
  SHARED_HISTORY.remember();
  const { data, error: readError } = await sb.from('boards').select('directory').eq('id', CACHE.boardId).maybeSingle();
  if (readError) throw readError;
  const directory = Object.assign({}, (data && data.directory) || CACHE.board.directory || {});
  directory.repHub = Object.assign({}, directory.repHub || {});
  if (value == null) delete directory.repHub[itemId]; else directory.repHub[itemId] = value;

  const { error } = await sb.from('boards').update({ directory }).eq('id', CACHE.boardId);
  if (error) throw error;
  CACHE.board.directory = directory;
}

/* ---------- Metrics Tracking ----------
   Per offer and funnel: the metric list (config) and the typed-in
   numbers. Sales numbers are read from the calls, never stored twice. */
async function loadMetrics(boardId) {
  const [board, calls, settings, entries] = await Promise.all([
    sb.from('boards').select('id, name, directory').eq('id', boardId).maybeSingle(),
    readAll(() => sb.from('calls').select('data').eq('board_id', boardId).order('created_at', { ascending: true })),
    sb.from('metric_settings').select('funnel, config').eq('board_id', boardId),
    readAll(() => sb.from('metric_entries').select('funnel, metric_id, day, value').eq('board_id', boardId).order('day'))
      .catch((err) => ({ error: err }))
  ]);
  if (board.error) throw board.error;

  const ready = !settings.error && !entries.error;
  const configs = {};
  (settings.data || []).forEach((row) => { configs[row.funnel] = upgradeMetricConfig(row.config); });

  const values = { vsl: new Map(), webinar: new Map() };
  (Array.isArray(entries) ? entries : []).forEach((row) => {
    if (values[row.funnel]) values[row.funnel].set(row.metric_id + '|' + row.day, Number(row.value));
  });

  CACHE.boardId = boardId;
  CACHE.board = board.data;
  CACHE.calls = calls.map((r) => r.data);
  CACHE.metrics = { ready, configs, values };
  METRICS_HISTORY.reset();
}

function metricConfig(funnel) {
  const saved = CACHE.metrics.configs[funnel];
  return saved && Array.isArray(saved.groups) ? saved : templateFor(funnel);
}

/* Change an offer's metric list. The saved copy is read fresh first, so
   two people editing at once never undo each other's changes. */
/* A metrics board is its metric lists plus every figure typed into them,
   so one history covers renaming a metric, moving one, and a number typed
   into a day. */
const METRICS_HISTORY = makeHistory(
  () => ({
    /* the lists as they are in use, not only the ones saved so far */
    configs: CACHE.metrics
      ? ['vsl', 'webinar'].reduce((out, funnel) => {
        out[funnel] = metricConfig(funnel);
        return out;
      }, {})
      : null,
    values: CACHE.metrics
      ? Object.keys(CACHE.metrics.values).reduce((out, funnel) => {
        out[funnel] = [...CACHE.metrics.values[funnel].entries()];
        return out;
      }, {})
      : null
  }),
  (was) => { writeMetricsBack(was).catch((err) => console.error(err)); }
);

/* Putting a step back writes the lists and every figure that moved. */
async function writeMetricsBack(was) {
  METRICS_HISTORY.quiet = true;
  try {
    for (const funnel of Object.keys(was.configs || {})) {
      if (JSON.stringify(CACHE.metrics.configs[funnel]) === JSON.stringify(was.configs[funnel])) continue;
      const { error } = await sb.from('metric_settings').upsert({
        board_id: CACHE.boardId, funnel, config: was.configs[funnel], updated_at: new Date().toISOString()
      });
      if (error) throw error;
      CACHE.metrics.configs[funnel] = was.configs[funnel];
    }

    for (const funnel of Object.keys(was.values || {})) {
      const wanted = new Map(was.values[funnel]);
      const now = CACHE.metrics.values[funnel];

      for (const [key, value] of wanted) {
        if (now.get(key) === value) continue;
        const [metricId, day] = key.split('|');
        await saveMetricEntry(funnel, metricId, day, value);
      }
      for (const key of [...now.keys()]) {
        if (wanted.has(key)) continue;
        const [metricId, day] = key.split('|');
        await saveMetricEntry(funnel, metricId, day, null);
      }
    }
    notify('Undone.');
  } catch (err) {
    console.error(err);
    notify("Couldn't undo that — check your connection.");
  } finally {
    METRICS_HISTORY.quiet = false;
  }
  if (typeof renderMetrics === 'function') renderMetrics();
}

registerUndo({
  label: 'metrics tracking',
  when: () => shellShown('metricsShell'),
  undo: () => METRICS_HISTORY.undo(),
  redo: () => METRICS_HISTORY.redo()
});

async function updateMetricConfig(funnel, change) {
  const { data, error: readError } = await sb.from('metric_settings')
    .select('config').eq('board_id', CACHE.boardId).eq('funnel', funnel).maybeSingle();
  if (readError) throw readError;
  const config = data && data.config && Array.isArray(data.config.groups) ? upgradeMetricConfig(data.config) : templateFor(funnel);
  change(config);
  const { error } = await sb.from('metric_settings').upsert({
    board_id: CACHE.boardId, funnel, config, updated_at: new Date().toISOString()
  });
  if (error) throw error;
  CACHE.metrics.configs[funnel] = config;
  if (!METRICS_HISTORY.quiet) METRICS_HISTORY.remember();
  return config;
}

/* One typed-in number. An empty box removes it. */
async function saveMetricEntry(funnel, metricId, day, value) {
  const key = metricId + '|' + day;
  if (value == null) {
    const { error } = await sb.from('metric_entries').delete()
      .eq('board_id', CACHE.boardId).eq('funnel', funnel).eq('metric_id', metricId).eq('day', day);
    if (error) throw error;
    CACHE.metrics.values[funnel].delete(key);
    if (!METRICS_HISTORY.quiet) METRICS_HISTORY.remember();
    return;
  }
  const { error } = await sb.from('metric_entries').upsert({
    board_id: CACHE.boardId, funnel, metric_id: metricId, day, value,
    updated_by: currentLogger(), updated_at: new Date().toISOString()
  });
  if (error) throw error;
  CACHE.metrics.values[funnel].set(key, value);
  if (!METRICS_HISTORY.quiet) METRICS_HISTORY.remember();
}

/* A cheap fingerprint of everything on a metrics board, to notice
   changes made by someone else. */
async function metricsSignature() {
  const b = CACHE.boardId;
  const latest = (table, col) => sb.from(table).select(col).eq('board_id', b).order(col, { ascending: false }).limit(1);
  const count = (table) => sb.from(table).select('board_id', { count: 'exact', head: true }).eq('board_id', b);
  const [c1, c2, e1, e2, s1] = await Promise.all([
    latest('calls', 'updated_at'), count('calls'), latest('metric_entries', 'updated_at'), count('metric_entries'), latest('metric_settings', 'updated_at')
  ]);
  const top = (r) => (r.data && r.data[0] ? r.data[0].updated_at : '');
  return [top(c1), c2.count, top(e1), e2.count, top(s1)].join('|');
}

/* ---------- Signal List ----------
   The owner's own. The database only ever returns the signed-in
   person's days and defaults. */
async function loadSignalTemplate() {
  const { data, error } = await sb.from('signal_settings').select('template').eq('user_id', CACHE.me.id).maybeSingle();
  return { ready: !error, template: data ? data.template : null };
}

async function saveSignalTemplate(template) {
  const { error } = await sb.from('signal_settings').upsert({
    user_id: CACHE.me.id, template, updated_at: new Date().toISOString()
  });
  if (error) throw error;
}

async function loadSignalDay(day) {
  const { data, error } = await sb.from('signal_days').select('content, updated_at').eq('user_id', CACHE.me.id).eq('day', day).maybeSingle();
  if (error) throw error;
  return data;
}

/* The most recent day before this one that has anything in it. */
async function loadSignalDayBefore(day) {
  const { data, error } = await sb.from('signal_days').select('day, content')
    .eq('user_id', CACHE.me.id).lt('day', day).order('day', { ascending: false }).limit(1);
  if (error) throw error;
  return data && data[0] ? data[0] : null;
}

async function loadSignalWeek(from, to) {
  const { data, error } = await sb.from('signal_days').select('day, content')
    .eq('user_id', CACHE.me.id).gte('day', from).lte('day', to);
  if (error) throw error;
  return data || [];
}

async function saveSignalDay(day, content) {
  const { error } = await sb.from('signal_days').upsert({
    user_id: CACHE.me.id, day, content, updated_at: new Date().toISOString()
  });
  if (error) throw error;
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
/* access: { sections: [...], allOffers: true|false, boardIds: [...] } */
const inviteAdmin = (name, email, title, access) => serverAction('/api/people', Object.assign({ action: 'invite', name, email, title }, access));
const setAdminAccess = (userId, access) => serverAction('/api/people', Object.assign({ action: 'access', userId }, access));
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

/* ---------- Accounting ----------
   Invoices and the details printed on them. Owner only, enforced by
   the database as well as by the page. An invoice is never deleted:
   one that should not stand is marked void and keeps its number. */
async function loadInvoices() {
  const { data, error } = await sb.from('invoices')
    .select('id, number, status, client, period, issue_date, due_date, paid_date, currency, sections, pay_link, notes, updated_at')
    .order('number', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createInvoice(row) {
  const { data, error } = await sb.from('invoices').insert(row).select().single();
  if (error) throw error;
  return data;
}

async function saveInvoice(id, patch) {
  const { data, error } = await sb.from('invoices')
    .update(Object.assign({}, patch, { updated_at: new Date().toISOString() }))
    .eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function loadInvoiceSettings() {
  const { data, error } = await sb.from('invoice_settings').select('content').eq('id', 1).maybeSingle();
  if (error) throw error;
  return (data && data.content) || null;
}

async function saveInvoiceSettings(content) {
  const { error } = await sb.from('invoice_settings')
    .upsert({ id: 1, content, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/* An invoice you no longer want. The page asks first, and keeps the row
   so Ctrl+Z can put it back with its own number. */
async function deleteInvoice(id) {
  const { error } = await sb.from('invoices').delete().eq('id', id);
  if (error) throw error;
}

async function restoreInvoice(row) {
  const { data, error } = await sb.from('invoices').insert(row).select().single();
  if (error) throw error;
  return data;
}

/* ---------- Daily Huddles ----------
   One page per offer: the meeting, the accountability check, the
   marketing debrief day by day, the bottleneck spot-checks, the
   pipeline and who is due to close. Everyone on the board reads it;
   whoever runs the board writes it. */
async function loadHuddle(boardId) {
  const { data, error } = await sb.from('huddles').select('content').eq('board_id', boardId).maybeSingle();
  if (error) throw error;
  return (data && data.content) || null;
}

async function saveHuddle(boardId, content) {
  const { error } = await sb.from('huddles').upsert({
    board_id: boardId, content, updated_at: new Date().toISOString(), updated_by: currentLogger()
  });
  if (error) throw error;
}
