/* ============================================================
   hub.js — the main hub
   ------------------------------------------------------------
   Only you ever see this. One card per offer, with that board's
   own figures, plus the totals across everything at the top.

   Each card's numbers come from the same computeMetrics() the
   board itself uses, so a board's card and a board's dashboard can
   never disagree.
   ============================================================ */

function boardRows(key) {
  return CACHE.allCalls.filter((r) => r.boardKey === key).map((r) => r.record);
}

function hubRange() {
  return rangeFor($('#hubRange') ? $('#hubRange').value : 'ytd');
}

function renderHub() {
  const host = $('#hubBoards');
  if (!host) return;
  host.textContent = '';

  const range = hubRange();
  const boards = CACHE.boards || [];

  /* ---------- the totals across every offer ---------- */
  const everything = computeMetrics(CACHE.allCalls.map((r) => r.record), range);
  const totals = [
    { label: 'Cash Collected', value: money(everything.totalCash) },
    { label: 'Deals', value: int(everything.deals) },
    { label: 'Live Calls', value: int(everything.liveCalls) },
    { label: 'Close Rate', value: pct(safeDiv(everything.deals, everything.liveCalls)) }
  ];

  const summary = $('#hubTotals');
  summary.textContent = '';
  totals.forEach((t) => {
    const cell = el('div', 'hub-total');
    cell.appendChild(el('div', 'hub-total-label', t.label));
    cell.appendChild(el('div', 'hub-total-value', t.value));
    summary.appendChild(cell);
  });

  $('#hubCount').textContent = boards.length
    ? boards.length + (boards.length === 1 ? ' board' : ' boards')
    : '';

  if (!boards.length) {
    host.appendChild(el('p', 'hub-empty',
      'No boards yet. Create one for your first offer — you will get a key to send its sales team.'));
    return;
  }

  boards.forEach((b) => {
    const rows = boardRows(b.key);
    const m = computeMetrics(rows, range);
    const people = CACHE.allTeam.filter((p) => p.boardKey === b.key).length;

    const card = el('article', 'hub-card');

    const head = el('div', 'hub-card-head');
    const name = document.createElement('h3');
    name.textContent = b.name;                        // owner-entered — never as markup
    head.appendChild(name);

    const keyTag = el('span', 'hub-key');
    keyTag.textContent = b.key;
    head.appendChild(keyTag);
    card.appendChild(head);

    const stats = el('div', 'hub-stats');
    [
      ['Cash', money(m.totalCash)],
      ['Deals', int(m.deals)],
      ['Calls', int(m.liveCalls)],
      ['Close rate', pct(safeDiv(m.deals, m.liveCalls))]
    ].forEach((pair) => {
      const s = el('div', 'hub-stat');
      s.appendChild(el('div', 'hub-stat-label', pair[0]));
      s.appendChild(el('div', 'hub-stat-value', pair[1]));
      stats.appendChild(s);
    });
    card.appendChild(stats);

    card.appendChild(el('p', 'hub-meta',
      people + (people === 1 ? ' person on the team' : ' people on the team')));

    const actions = el('div', 'hub-actions');

    const open = el('button', 'btn-primary hub-open', 'Open board');
    open.type = 'button';
    open.addEventListener('click', () => { location.href = '/sales-team/' + b.key; });
    actions.appendChild(open);

    const copy = el('button', 'link-btn', 'Copy team link');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      const link = location.origin + '/sales-team/' + b.key;
      try { await navigator.clipboard.writeText(link); } catch (e) { /* clipboard blocked */ }
      copy.textContent = 'Copied';
      setTimeout(() => { copy.textContent = 'Copy team link'; }, 1600);
    });
    actions.appendChild(copy);

    const rename = el('button', 'link-btn', 'Rename');
    rename.type = 'button';
    rename.addEventListener('click', async () => {
      const next = window.prompt('Name for this board', b.name);
      if (next === null) return;
      const clean = next.trim();
      if (!clean || clean === b.name) return;
      try { await renameBoard(b.key, clean); } catch (err) {
        console.error(err); notify("Couldn't rename that board."); return;
      }
      renderHub();
      notify('Renamed to ' + clean + '.');
    });
    actions.appendChild(rename);

    const rekey = el('button', 'link-btn', 'Change key');
    rekey.type = 'button';
    rekey.addEventListener('click', async () => {
      const next = window.prompt(
        'New key for "' + b.name + '".\n\n3 to 12 letters or digits. Anyone using the old key '
        + 'is locked out straight away, so send the new one to whoever should still have it.', b.key);
      if (next === null) return;
      const wanted = next.trim().toUpperCase();
      if (!wanted || wanted === b.key) return;
      if (!/^[A-Z0-9]{3,12}$/.test(wanted)) { notify('A key must be 3 to 12 letters or digits.'); return; }
      try { await changeBoardKey(b.key, wanted); } catch (err) {
        console.error(err); notify(err.message || "Couldn't change that key."); return;
      }
      renderHub();
      notify('Key for ' + b.name + ' is now ' + wanted + '.');
    });
    actions.appendChild(rekey);

    const remove = el('button', 'link-btn danger', 'Delete');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      const warning = 'Delete "' + b.name + '"?\n\nThis removes the board and every call logged on it — '
        + rows.length + (rows.length === 1 ? ' call' : ' calls')
        + '. It cannot be undone, and its key stops working for everyone.';
      if (!window.confirm(warning)) return;
      if (window.prompt('Type the board key ' + b.key + ' to confirm.') !== b.key) return;
      try { await deleteBoard(b.key); } catch (err) {
        console.error(err); notify("Couldn't delete that board."); return;
      }
      renderHub();
      notify('Deleted ' + b.name + '.');
    });
    actions.appendChild(remove);

    card.appendChild(actions);
    host.appendChild(card);
  });
}

function initHub() {
  const form = $('#newBoardForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#newBoardName');
    const keyInput = $('#newBoardKey');
    const name = (input.value || '').trim();
    const wanted = (keyInput.value || '').trim().toUpperCase();
    if (!name) { input.focus(); return; }

    if (wanted && !/^[A-Z0-9]{3,12}$/.test(wanted)) {
      notify('A key must be 3 to 12 letters or digits.');
      keyInput.focus();
      return;
    }

    try {
      await createBoard(name, wanted);
    } catch (err) {
      console.error(err);
      notify(err.message || "Couldn't create that board — check your connection and try again.");
      return;
    }

    input.value = '';
    keyInput.value = '';
    renderHub();

    const made = (CACHE.boards || []).find((b) => b.name === name);
    notify(made ? 'Created ' + name + '. Its key is ' + made.key + '.' : 'Board created.');
  });

  $('#hubRange').addEventListener('change', renderHub);
  renderHub();
}
