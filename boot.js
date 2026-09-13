/* ============================================================
   boot.js — start-up
   ------------------------------------------------------------
   Access is settled before this file ever runs: middleware.js checks
   the password on Vercel's servers, and a visitor without it never
   receives this page at all. So there is no sign-in screen here —
   by the time anything below executes, the person is already in.
   ============================================================ */

(function () {
  async function start() {
    try {
      await loadAll();
    } catch (err) {
      console.error(err);
      notify("Couldn't load the board. Check your connection and refresh.");
    }

    initApp();
    initPostCallForm();
    initDataTab();
    initTeamTab();

    /* In shared mode, anyone else logging a call refreshes this board. */
    watchChanges(() => {
      fillTeamSelects();
      render();
      renderDataTab();
      renderRoster();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
