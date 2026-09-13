/* ============================================================
   boot.js — who gets which screen
   ------------------------------------------------------------
     /                  signed out → sign in with email
                        owner or admin → Main Hub
                        a team code → straight to their board
     /sales-team        the team code page
     /board/<id>        that offer's board, if you may see it

   The one rule: an account gets the hub and the offers it is
   allowed; a code gets one board and nothing else.
   ============================================================ */

(function () {
  const VIEWS = ['viewLoading', 'viewSignIn', 'viewCode', 'viewWelcome'];

  function show(id) {
    VIEWS.forEach((v) => $('#' + v).classList.toggle('hidden', v !== id));
    const inApp = !id;
    $('#topStrip').classList.toggle('hidden', !inApp);
    if (!inApp) {
      $('#hubShell').classList.add('hidden');
      $('#boardShell').classList.add('hidden');
    }
  }

  function fail(boxId, message) {
    const box = $('#' + boxId);
    box.textContent = message;
    box.classList.remove('hidden');
  }

  const path = location.pathname.replace(/\/+$/, '') || '/';
  const boardMatch = path.match(/^\/board\/([0-9a-f-]{36})$/i);
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
    location.href = '/board/' + result.boardId;
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
      a.href = '/board/' + b.id;
      a.dataset.board = b.id;
      a.textContent = b.name;
      if (b.id === CACHE.boardId) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
  }

  /* ---------- screens ---------- */
  async function openHub() {
    await loadHub();
    show(null);
    $('#hubShell').classList.remove('hidden');
    $('#toHub').classList.add('hidden');
    $('#undoBtn').classList.add('hidden');
    document.title = 'Main Hub · Inevitable Acquisition';
    initHub();
    initProfile();
    watchChanges(renderHub);
  }

  async function openBoard(boardId) {
    await loadBoard(boardId);
    if (!CACHE.board || !CACHE.role) {
      /* Not theirs, or gone. Send them somewhere they belong. */
      if (CACHE.me.kind === 'team') { await signOut(); return; }
      location.replace('/');
      return;
    }

    if (CACHE.role !== 'rep') await loadBoards();

    show(null);
    $('#boardShell').classList.remove('hidden');
    $('#toHub').classList.toggle('hidden', CACHE.role === 'rep');
    $('#teamTabBtn').classList.toggle('hidden', !canManage());

    initApp();
    initPostCallForm();
    initDataTab();
    initTeamTab();
    initOnboarding();
    paintOfferTabs();
    initProfile();

    const wanted = params.get('tab');
    if (wanted && document.querySelector('.tab[data-tab="' + wanted + '"]:not(.hidden)')) showTab(wanted);

    watchChanges(() => {
      fillTeamSelects();
      render();
      renderDataTab();
      renderRoster();
      renderOnboarding();
      paintBoardName();
      paintProfile();
    });
  }

  async function start() {
    show('viewLoading');

    const me = await loadMe().catch(() => null);

    if (path === '/sales-team') {
      if (me && me.kind === 'team' && me.memberships[0]) {
        location.replace('/board/' + me.memberships[0].board_id);
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
      if (me.kind === 'team') {
        const home = me.memberships[0] && me.memberships[0].board_id;
        if (!home) { await signOut(); return; }
        if (!boardMatch || boardMatch[1] !== home) { location.replace('/board/' + home); return; }
        await openBoard(home);
        return;
      }

      if (boardMatch) {
        await openBoard(boardMatch[1]);
        return;
      }

      if (path !== '/') { location.replace('/'); return; }
      await openHub();
    } catch (err) {
      console.error(err);
      show(null);
      notify("Couldn't load — check your connection and refresh.");
    }
  }

  start();
})();
