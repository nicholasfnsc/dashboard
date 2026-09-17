/* ============================================================
   boot.js — who gets which screen
   ------------------------------------------------------------
     /                          the portal: every section of the company
     /sales-dashboard           every sales team board you can reach
     /sales-dashboard/<offer>   that offer's board, if you may see it
     /metrics/<offer>           Metrics Tracking for that offer
     /projections               Funnel Revenue Projections (a calculator, no offer data)
     /signal-list               the owner's Signal List, one page per day
     /team-access               invite admins and choose what they can use (owner)
     /sales-team                the team code page
     /board/<id>                old links — forwarded to the new address

   The one rule: an account gets the portal and the offers it is
   allowed; a code gets one board and nothing else.
   ============================================================ */

(function () {
  const VIEWS = ['viewLoading', 'viewSignIn', 'viewCode', 'viewWelcome'];
  const SHELLS = ['portalShell', 'hubShell', 'boardShell', 'accessShell', 'metricsShell', 'projectionsShell', 'signalShell'];

  function show(id) {
    VIEWS.forEach((v) => $('#' + v).classList.toggle('hidden', v !== id));
    const inApp = !id;
    $('#topStrip').classList.toggle('hidden', !inApp);
    if (!inApp) SHELLS.forEach((s) => $('#' + s).classList.add('hidden'));
  }

  function openShell(id) {
    show(null);
    SHELLS.forEach((s) => $('#' + s).classList.toggle('hidden', s !== id));
  }

  /* The link back up, top left: portal ← sales boards ← an offer. */
  function crumb(label, href) {
    const a = $('#toHub');
    a.classList.toggle('hidden', !label);
    if (!label) return;
    a.textContent = '← ' + label;
    a.href = href;
  }

  function fail(boxId, message) {
    const box = $('#' + boxId);
    box.textContent = message;
    box.classList.remove('hidden');
  }

  const path = location.pathname.replace(/\/+$/, '') || '/';
  const legacyBoard = path.match(/^\/board\/([0-9a-f-]{36})$/i);
  const salesBoard = path.match(/^\/sales-dashboard\/([^/]+)$/i);
  const metricsBoard = path.match(/^\/metrics(?:\/([^/]+))?$/i);
  const projectionsBoard = path.match(/^\/projections(?:\/([^/]+))?$/i);
  const params = new URLSearchParams(location.search);

  /* ---------- the forms ---------- */
  $('#signInForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#signInEmail').value.trim();
    const password = $('#signInPassword').value;
    if (!email || !password) return fail('signInError', 'Enter your email and password.');

    const button = e.submitter || $('#signInForm button');
    button.disabled = true;
    const problem = await signInWithEmail(email, password);
    button.disabled = false;
    if (problem) return fail('signInError', "That email and password don't match.");
    start();
  });

  $('#codeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('#codeInput').value.trim();
    if (!code) return fail('codeError', 'Enter the code you were given.');

    const button = $('#codeForm button');
    button.disabled = true;
    const result = await signInWithCode(code);
    button.disabled = false;
    if (result.error) return fail('codeError', result.error);
    /* A fresh code entry is a fresh person: forget whoever was picked on
       this device before, so "Who's logging in?" is always asked. */
    try { localStorage.removeItem('ia-who:' + result.boardId); } catch (err) { /* private window */ }
    location.href = SALES_PATH;                   // forwarded to their own board
  });

  $('#codeInput').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
    $('#codeError').classList.add('hidden');
  });

  $('#welcomeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = $('#welcomePassword').value;
    if (password.length < 8) return fail('welcomeError', 'Use at least 8 characters.');
    const problem = await setMyPassword(password);
    if (problem) return fail('welcomeError', problem);
    location.replace('/');
  });

  $('#signOutBtn').addEventListener('click', signOut);

  /* ---------- the offer tabs, for owners and admins ---------- */
  function paintOfferTabs() {
    const nav = $('#offerTabs');
    const reachable = CACHE.boards;
    const visible = CACHE.role !== 'rep' && reachable.length > 0;
    nav.classList.toggle('hidden', !visible);
    if (!visible) return;

    nav.textContent = '';
    reachable.forEach((b) => {
      const a = el('a', 'offer-tab');
      a.href = boardPath(b);
      a.dataset.board = b.id;
      a.textContent = b.name;
      if (b.id === CACHE.boardId) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
  }

  /* After a rename the address follows the name, without a reload. */
  window.syncBoardAddress = function () {
    const listed = CACHE.boards.find((b) => b.id === CACHE.boardId);
    if (listed) listed.directory = CACHE.board.directory;
    const wanted = boardPath(CACHE.board);
    if (location.pathname !== wanted) history.replaceState(null, '', wanted + location.search + location.hash);
    paintOfferTabs();
  };

  /* ---------- screens ---------- */
  async function openPortal() {
    await loadHub();
    openShell('portalShell');
    crumb(null);
    $('#undoBtn').classList.add('hidden');
    document.title = 'Portal · Inevitable Acquisition';
    initPortal();
    initProfile();
  }

  async function openMetrics(boardId) {
    await loadMetrics(boardId);
    if (!CACHE.board) { location.replace('/'); return; }
    CACHE.role = null;
    openShell('metricsShell');
    crumb('Portal', '/');
    $('#undoBtn').classList.add('hidden');
    initMetrics();
    initProfile();
  }

  async function openSignal() {
    openShell('signalShell');
    crumb('Portal', '/');
    $('#undoBtn').classList.add('hidden');
    initProfile();
    await initSignal();
  }

  function openProjections() {
    openShell('projectionsShell');
    crumb('Portal', '/');
    $('#undoBtn').classList.add('hidden');
    initProjections();
    initProfile();
  }

  async function openAccess() {
    await loadBoards();
    openShell('accessShell');
    crumb('Portal', '/');
    $('#undoBtn').classList.add('hidden');
    document.title = 'Team & Access · Inevitable Acquisition';
    initAccess();
    initProfile();
  }

  async function openHub() {
    await loadHub();
    openShell('hubShell');
    crumb('Portal', '/');
    $('#undoBtn').classList.add('hidden');
    document.title = 'Sales Team Boards · Inevitable Acquisition';
    initHub();
    initProfile();
    watchChanges(renderHub);
  }

  async function openBoard(boardId) {
    await loadBoard(boardId);
    if (!CACHE.board || !CACHE.role) {
      /* Not theirs, or gone. Send them somewhere they belong. */
      if (CACHE.me.kind === 'team') { await signOut(); return; }
      location.replace(SALES_PATH);
      return;
    }

    /* Always show the offer's current address, whichever one was typed. */
    const wanted = boardPath(CACHE.board);
    if (location.pathname !== wanted) history.replaceState(null, '', wanted + location.search + location.hash);

    openShell('boardShell');
    crumb(CACHE.role === 'rep' ? null : 'Sales boards', SALES_PATH);
    $('#teamTabBtn').classList.toggle('hidden', !canManage());

    initApp();
    initPostCallForm();
    initDataTab();
    initTeamTab();
    initRepHub();
    initTranscriber();
    paintOfferTabs();
    initProfile();

    const wantedTab = params.get('tab');
    if (wantedTab && document.querySelector('.tab[data-tab="' + wantedTab + '"]:not(.hidden)')) showTab(wantedTab);

    watchChanges(() => {
      fillTeamSelects();
      render();
      renderDataTab();
      renderRoster();
      paintBoardName();
      paintProfile();
      if (!hubEditing) renderRepHub();       // never pull the page out from under someone typing
    });
  }

  async function start() {
    show('viewLoading');

    const me = await loadMe().catch(() => null);

    if (path === '/sales-team') {
      if (me && me.kind === 'team' && me.memberships[0]) {
        location.replace(SALES_PATH);
        return;
      }
      show('viewCode');
      $('#codeInput').focus();
      return;
    }

    if (!me) {
      show('viewSignIn');
      $('#signInEmail').focus();
      return;
    }

    if (me.kind === 'person' && me.needsPassword) {
      show('viewWelcome');
      $('#welcomePassword').focus();
      return;
    }

    try {
      await loadBoards();

      /* A code opens one board, whatever address it came in on. */
      if (me.kind === 'team') {
        const home = me.memberships[0] && me.memberships[0].board_id;
        if (!home) { await signOut(); return; }
        await openBoard(home);
        return;
      }

      if (legacyBoard) {
        const board = CACHE.boards.find((b) => b.id === legacyBoard[1].toLowerCase());
        location.replace(board ? boardPath(board) + location.search : SALES_PATH);
        return;
      }

      if (salesBoard) {
        const board = findBoardBySlug(decodeURIComponent(salesBoard[1]));
        if (!board) { location.replace(SALES_PATH); return; }
        await openBoard(board.id);
        return;
      }

      if (metricsBoard) {
        if (!canUse('metrics')) { location.replace('/'); return; }
        const board = metricsBoard[1] ? findBoardBySlug(decodeURIComponent(metricsBoard[1])) : CACHE.boards[0];
        if (!board) {
          location.replace(metricsBoard[1] && CACHE.boards.length ? METRICS_PATH : '/');
          return;
        }
        await openMetrics(board.id);
        return;
      }

      if (path === SIGNAL_PATH) {
        if (!me.isOwner) { location.replace('/'); return; }
        await openSignal();
        return;
      }

      if (projectionsBoard) {
        if (!canUse('funnel')) { location.replace('/'); return; }
        if (projectionsBoard[1]) { location.replace(PROJECTIONS_PATH + location.search); return; }
        openProjections();
        return;
      }

      if (path === ACCESS_PATH) {
        if (!me.isOwner) { location.replace('/'); return; }
        await openAccess();
        return;
      }

      if (path === SALES_PATH) {
        if (!canUse('sales')) { location.replace('/'); return; }
        await openHub();
        return;
      }
      if (path !== '/') { location.replace('/'); return; }
      await openPortal();
    } catch (err) {
      console.error(err);
      show(null);
      notify("Couldn't load — check your connection and refresh.");
    }
  }

  start();
})();
