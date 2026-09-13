/* ============================================================
   boot.js — start-up and sign-in
   ------------------------------------------------------------
   The board stays hidden until Supabase confirms a session. Which
   sign-in shows depends on the path: /sales-access asks the team for
   the key, anything else asks the owner for an email and password.

   Both hand what was typed to Supabase, which checks it against a
   hash on its own server. Neither the password nor the key is stored
   in this code, sent to this code, or knowable from this page.
   ============================================================ */

(function () {
  const gate = $('#gate');
  const ownerForm = $('#ownerForm');
  const teamForm = $('#teamForm');
  const errorBox = $('#gateError');
  const busy = $('#gateBusy');

  const isTeamEntrance =
    location.pathname.replace(/\/+$/, '') === TEAM_ACCESS_PATH.replace(/\/+$/, '');

  function fail(message) {
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
    busy.classList.add('hidden');
  }

  function working(on) {
    busy.classList.toggle('hidden', !on);
    if (on) errorBox.classList.add('hidden');
    gate.querySelectorAll('button, input').forEach((n) => { n.disabled = on; });
  }

  /* ---------- once a session exists ---------- */
  let started = false;
  async function enter() {
    try {
      await loadAll();
    } catch (err) {
      console.error(err);
      fail('Signed in, but the board could not load. Check that the database setup ran.');
      return;
    }

    gate.classList.add('hidden');
    document.documentElement.classList.remove('pre-locked');

    if (!started) {
      started = true;
      initApp();
      initPostCallForm();
      initDataTab();
      initTeamTab();

      /* Anyone else logging a call refreshes this board on its own. */
      watchChanges(() => {
        fillTeamSelects();
        render();
        renderDataTab();
        renderRoster();
      });
    }
  }

  function showSignIn() {
    document.documentElement.classList.remove('pre-locked');
    gate.classList.remove('hidden');
    (isTeamEntrance ? teamForm : ownerForm).classList.remove('hidden');
    const first = isTeamEntrance ? $('#gateKey') : $('#ownerEmail');
    if (first) first.focus();
  }

  /* ---------- wiring ---------- */
  ownerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = ($('#ownerEmail').value || '').trim();
    const password = $('#ownerPassword').value || '';
    if (!email || !password) { fail('Enter your email and password.'); return; }

    working(true);
    const problem = await signInOwner(email, password);
    working(false);
    if (problem) { fail('That email and password do not match.'); return; }
    await enter();
  });

  teamForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = ($('#gateKey').value || '').trim();
    if (!key) { fail('Enter the secret key.'); return; }

    working(true);
    const problem = await signInTeam(key);
    working(false);
    if (problem) { fail("That key doesn't match. Check it with whoever shared the board."); return; }
    await enter();
  });

  gate.querySelectorAll('input').forEach((n) => {
    n.addEventListener('input', () => errorBox.classList.add('hidden'));
  });

  /* ---------- go ---------- */
  (async function start() {
    if (!isConfigured()) {
      showSignIn();
      fail('This board is not connected to its database yet. Fill in config.js — see README.md.');
      return;
    }

    let session = null;
    try {
      session = await currentSession();
    } catch (err) {
      console.error(err);
    }

    if (session) await enter();
    else showSignIn();
  })();
})();
