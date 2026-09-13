/* ============================================================
   boot.js — start-up
   ------------------------------------------------------------
   Access is settled before this file runs: middleware.js checks the
   password or the board key on Vercel's servers, and anyone without
   one never receives this page.

   What the address says decides what is shown:
     /                  your hub, listing every board
     /sales-team/ABCD   that board's dashboard
   ============================================================ */

(function () {
  async function start() {
    try {
      await loadAll();
    } catch (err) {
      console.error(err);
      notify("Couldn't load the board. Check your connection and refresh.");
    }

    const onHub = isHub();
    $('#hubShell').classList.toggle('hidden', !onHub);
    $('#boardShell').classList.toggle('hidden', onHub);

    if (onHub) {
      initHub();
      watchChanges(renderHub);
      return;
    }

    /* A board the key no longer opens — say so rather than showing zeros. */
    if (CACHE.shared && !CACHE.board) {
      $('#boardShell').innerHTML =
        '<p class="data-empty">This board no longer exists. Ask whoever shared it for a current link.</p>';
      $('#boardShell').classList.remove('hidden');
      return;
    }

    paintBoardBar();
    initApp();
    initPostCallForm();
    initDataTab();
    initTeamTab();

    watchChanges(() => {
      fillTeamSelects();
      render();
      renderDataTab();
      renderRoster();
    });
  }

  /* Which offer you are looking at, and the way back for whoever has one. */
  function paintBoardBar() {
    const bar = $('#boardBar');
    if (!bar) return;
    bar.textContent = '';

    const name = el('span', 'board-name', '');
    name.textContent = (CACHE.board && CACHE.board.name) || 'Board';
    bar.appendChild(name);

    if (CACHE.boardKey) {
      const key = el('span', 'board-key');
      key.textContent = CACHE.boardKey;
      bar.appendChild(key);
    }

    const back = el('button', 'link-btn', CACHE.role === 'owner' ? '← All boards' : '← Enter a different key');
    back.type = 'button';
    back.addEventListener('click', () => {
      location.href = CACHE.role === 'owner' ? '/' : '/sales-team?signout=1';
    });
    bar.appendChild(back);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
