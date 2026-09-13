/* ============================================================
   hub.js — the Main Hub
   ------------------------------------------------------------
   Owner and admins land here. Each sees the offers they can reach —
   the owner every one, an admin only those they were given. The
   database decides that; this page shows whatever comes back.

   Card figures come from the same computeMetrics() each board uses,
   so a card and its board can never disagree.
   ============================================================ */

let hubAdmins = [];

function boardRows(boardId) {
  return CACHE.allCalls.filter((r) => r.boardId === boardId).map((r) => r.record);
}

function hubRange() {
  return rangeFor($('#hubRange').value);
}

function renderHub() {
  const range = hubRange();
  const boards = CACHE.boards;

  /* ---------- totals across everything this person can see ---------- */
  const everything = computeMetrics(CACHE.allCalls.map((r) => r.record), range);
  const totals = $('#hubTotals');
  totals.textContent = '';
  [
    ['Cash collected', money(everything.totalCash)],
    ['Deals', int(everything.deals)],
    ['Live calls', int(everything.liveCalls)],
    ['Close rate', pct(safeDiv(everything.deals, everything.liveCalls))]
  ].forEach((pair) => {
    const cell = el('div', 'hub-total');
    cell.appendChild(el('div', 'hub-total-label', pair[0]));
    cell.appendChild(el('div', 'hub-total-value', pair[1]));
    totals.appendChild(cell);
  });

  /* ---------- one card per offer ---------- */
  const host = $('#hubBoards');
  host.textContent = '';

  if (!boards.length) {
    host.appendChild(el('p', 'hub-empty', CACHE.me.isOwner
      ? 'No offers yet. Click “New offer” to create your first sales team board.'
      : 'You have not been given any offers yet. Ask the owner for access.'));
  }

  boards.forEach((b) => {
    const m = computeMetrics(boardRows(b.id), range);
    const people = CACHE.rosterCounts[b.id] || 0;

    const card = el('article', 'hub-card');

    const head = el('div', 'hub-card-head');
    const title = document.createElement('h3');
    title.textContent = b.name;                   // typed by a person — never as markup
    head.appendChild(title);
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

    card.appendChild(el('p', 'hub-meta', people + (people === 1 ? ' person on the team' : ' people on the team')));

    const actions = el('div', 'hub-actions');
    const open = el('a', 'btn-primary hub-open', 'Open board');
    open.href = '/board/' + b.id;
    actions.appendChild(open);
    card.appendChild(actions);

    host.appendChild(card);
  });

  paintInviteBoards();
}

/* ---------- admins (owner only) ---------- */
function boardCheckboxes(host, chosenIds, idPrefix, onChange) {
  host.textContent = '';
  CACHE.boards.forEach((b) => {
    const label = document.createElement('label');
    label.className = 'check';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = idPrefix + b.id;
    box.value = b.id;
    box.checked = chosenIds.indexOf(b.id) !== -1;
    if (onChange) box.addEventListener('change', onChange);
    label.appendChild(box);
    label.appendChild(document.createTextNode(' ' + b.name));
    host.appendChild(label);
  });
  if (!CACHE.boards.length) host.appendChild(el('span', 'axis-note', 'Create an offer first.'));
}

const checkedIn = (host) =>
  Array.prototype.map.call(host.querySelectorAll('input:checked'), (b) => b.value);

function paintInviteBoards() {
  const host = $('#inviteBoards');
  if (host && !host.dataset.touched) boardCheckboxes(host, [], 'invite-', () => { host.dataset.touched = '1'; });
}

function renderAdmins() {
  const host = $('#adminList');
  host.textContent = '';

  if (!hubAdmins.length) {
    host.appendChild(el('p', 'roster-empty', 'No admins yet.'));
    return;
  }

  hubAdmins.forEach((a) => {
    const rowEl = el('div', 'admin-row');

    const who = el('div', 'admin-who');
    const name = el('span', 'admin-name');
    name.textContent = a.name || a.email;
    who.appendChild(name);

    const detail = el('span', 'admin-email');
    detail.textContent = [a.title, a.name ? a.email : ''].filter(Boolean).join(' · ');
    if (detail.textContent) who.appendChild(detail);

    if (!a.joined) who.appendChild(el('span', 'admin-pending', 'Invite not accepted yet'));
    rowEl.appendChild(who);

    const boards = el('div', 'check-row');
    boardCheckboxes(boards, a.boardIds, 'admin-' + a.id + '-', async () => {
      const ids = checkedIn(boards);
      try {
        await setAdminAccess(a.id, ids);
        a.boardIds = ids;
        notify('Access updated for ' + (a.name || a.email) + '.');
      } catch (err) {
        console.error(err);
        notify(err.message);
      }
    });
    rowEl.appendChild(boards);

    const remove = el('button', 'link-btn danger', 'Remove');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!window.confirm('Remove ' + (a.name || a.email) + '?\n\nTheir sign-in is deleted. Nothing they logged is touched.')) return;
      try {
        await removeAdmin(a.id);
      } catch (err) {
        console.error(err);
        notify(err.message);
        return;
      }
      hubAdmins = hubAdmins.filter((x) => x.id !== a.id);
      renderAdmins();
      notify('Removed ' + (a.name || a.email) + '.');
    });
    rowEl.appendChild(remove);

    host.appendChild(rowEl);
  });
}

async function loadAdmins() {
  try {
    const result = await listAdmins();
    hubAdmins = result.admins || [];
  } catch (err) {
    console.error(err);
    hubAdmins = [];
  }
  renderAdmins();
}

function initHub() {
  $('#hubRange').addEventListener('change', renderHub);

  if (CACHE.me.isOwner) {
    const create = $('#createBoardBtn');
    create.classList.remove('hidden');
    create.addEventListener('click', async () => {
      create.disabled = true;
      try {
        const result = await createBoard();
        notify('Offer created. Its code is ' + result.code + '. Opening it now — name it at the top of Add Team.');
        setTimeout(() => { location.href = '/board/' + result.board.id + '?tab=team'; }, 900);
      } catch (err) {
        console.error(err);
        notify(err.message);
        create.disabled = false;
      }
    });

    $('#peopleSection').classList.remove('hidden');

    /* Quietly bring every team login's name in Supabase up to date. */
    serverAction('/api/boards', { action: 'names' }).catch(() => {});
    $('#inviteForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#inviteName').value.trim();
      const email = $('#inviteEmail').value.trim();
      const title = $('#inviteTitle').value.trim();
      const ids = checkedIn($('#inviteBoards'));
      if (!email) { $('#inviteEmail').focus(); return; }

      const button = $('#inviteBtn');
      button.disabled = true;
      try {
        await inviteAdmin(name, email, title, ids);
      } catch (err) {
        console.error(err);
        notify(err.message);
        return;
      } finally {
        button.disabled = false;
      }
      $('#inviteName').value = '';
      $('#inviteEmail').value = '';
      $('#inviteTitle').value = '';
      delete $('#inviteBoards').dataset.touched;
      notify('Invite sent to ' + email + '.');
      loadAdmins();
      paintInviteBoards();
    });

    loadAdmins();
  }

  renderHub();
}
