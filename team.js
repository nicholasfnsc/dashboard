/* ============================================================
   team.js — Add Team tab and the secret-key gate
   ------------------------------------------------------------
   The roster here is what fills the Closer and Setter dropdowns on
   the Post Call Form, and who the Commission Tracking panels pay.

   The gate is a door latch, not a lock: the key lives in the browser
   alongside the page, so anyone determined can read it. It keeps the
   board from being wandered into, and nothing more. Real accounts
   come with the backend.
   ============================================================ */

const DEFAULT_TEAM_URL = 'https://portal.inevitableacquisition.com/sales-access';

function newSecretKey() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // no I or O — they read as 1 and 0
  let key = '';
  for (let i = 0; i < 5; i++) key += letters[Math.floor(Math.random() * letters.length)];
  return key;
}

function savedRoster() {
  const rows = store.read('team', []);
  return Array.isArray(rows) ? rows : [];
}

/* ---------- roster ---------- */
function renderRoster() {
  const rows = savedRoster();

  [['closer', 'closerList'], ['setter', 'setterList']].forEach((pair) => {
    const role = pair[0];
    const host = $('#' + pair[1]);
    if (!host) return;
    host.textContent = '';

    const people = rows.filter((p) => p.role === role);
    if (!people.length) {
      host.appendChild(el('p', 'roster-empty', 'None added yet.'));
      return;
    }

    people.forEach((p) => {
      const line = el('div', 'roster-row');

      const name = document.createElement('span');
      name.className = 'roster-name';
      name.textContent = p.name;              // user-entered — never as markup
      line.appendChild(name);

      const remove = el('button', 'link-btn danger', 'Remove');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove ' + p.name);
      remove.addEventListener('click', () => {
        if (!window.confirm('Remove ' + p.name + ' from the roster?\n\nTheir logged calls stay exactly as they are.')) return;
        pushUndo({ kind: 'restoreTeam', label: 'Removed ' + p.name, team: savedRoster() });
        store.write('team', savedRoster().filter((x) => !(x.name === p.name && x.role === p.role)));
        afterRosterChange();
        notify('Removed ' + p.name + '. Their logged calls are untouched.');
      });
      line.appendChild(remove);

      host.appendChild(line);
    });
  });
}

function afterRosterChange() {
  renderRoster();
  fillTeamSelects();
  render();
}

function addPerson(role, inputId) {
  const input = $('#' + inputId);
  const name = (input.value || '').trim().replace(/\s+/g, ' ');
  if (!name) { input.focus(); return; }

  const rows = savedRoster();
  if (rows.some((p) => p.name.toLowerCase() === name.toLowerCase() && p.role === role)) {
    input.value = '';
    return;                                   // already on the roster in this role
  }

  rows.push({ name, role, rate: role === 'closer' ? CLOSER_RATE : SETTER_RATE });
  store.write('team', rows);
  input.value = '';
  afterRosterChange();
  input.focus();
}

/* ---------- secret key ---------- */
function currentKey() {
  let key = store.read('teamKey', null);
  if (!key) {
    key = newSecretKey();
    store.write('teamKey', key);
    /* First run on this browser — whoever set the key owns the board and
       is already inside. Anyone who arrives later and types the key in is
       a team member, never an owner. */
    store.write('teamKey', key);
    store.write('unlocked', true);
    store.write('owner', true);
  }
  return key;
}

/* Only the owner may rotate the key. Boards created before this flag
   existed were set up by their owner, so grant it once on sight. */
function isOwner() {
  const flag = store.read('owner', null);
  if (flag === null) {
    const seeded = store.read('teamKey', null) !== null && store.read('unlocked', false) === true;
    store.write('owner', seeded);
    return seeded;
  }
  return flag === true;
}

function paintKeyPanel() {
  const keyInput = $('#teamKey');
  if (!keyInput) return;
  keyInput.value = currentKey();
  $('#teamUrl').value = store.read('teamUrl', DEFAULT_TEAM_URL);
  $('#regenKey').classList.toggle('hidden', !isOwner());
}

async function copyFrom(inputId, button) {
  const input = $('#' + inputId);
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(input.value);
  } catch (err) {
    input.removeAttribute('readonly');
    input.select();
    try { document.execCommand('copy'); } catch (e) { /* nothing else to try */ }
    if (inputId === 'teamKey') input.setAttribute('readonly', '');
  }
  button.textContent = 'Copied';
  setTimeout(() => { button.textContent = original; }, 1600);
}

/* ---------- the gate ---------- */
/* While the key still lives in this browser, whoever is looking at the
   gate is the person who set it — so the gate must always show them the
   way back out. Locking yourself out of your own board is a bug, not a
   security feature. Once the backend holds the key, this footer stops
   rendering for real teammates because they will not have one locally. */
function paintGatePreview() {
  const owns = store.read('teamKey', null);
  const box = $('#gatePreview');
  if (!box) return;
  box.classList.toggle('hidden', !owns);
  if (owns) $('#gatePreviewKey').textContent = owns;
}

function lockBoard() {
  store.write('unlocked', false);
  document.documentElement.classList.add('pre-locked');
  $('#gate').classList.remove('hidden');
  $('#gateError').classList.add('hidden');
  $('#gateKey').value = '';
  paintGatePreview();
  $('#gateKey').focus();
}

function unlockBoard() {
  store.write('unlocked', true);
  document.documentElement.classList.remove('pre-locked');
  $('#gate').classList.add('hidden');
}

(function initTeamTab() {
  if (!$('#gate')) return;

  /* Generating the key on first run also unlocks this browser. */
  const key = currentKey();
  if (store.read('unlocked', false)) unlockBoard();
  else lockBoard();

  $('#gateForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const entered = ($('#gateKey').value || '').trim().toUpperCase();
    if (entered === currentKey()) {
      unlockBoard();
      return;
    }
    $('#gateError').classList.remove('hidden');
    $('#gateKey').select();
  });

  $('#gateKey').addEventListener('input', () => {
    $('#gateError').classList.add('hidden');
  });

  $('#gateExit').addEventListener('click', unlockBoard);

  if (!$('#closerList')) return;

  $('#addCloserForm').addEventListener('submit', (e) => { e.preventDefault(); addPerson('closer', 'newCloser'); });
  $('#addSetterForm').addEventListener('submit', (e) => { e.preventDefault(); addPerson('setter', 'newSetter'); });

  document.querySelectorAll('.btn-copy').forEach((b) => {
    b.addEventListener('click', () => copyFrom(b.dataset.copy, b));
  });

  $('#teamUrl').addEventListener('change', (e) => {
    store.write('teamUrl', (e.target.value || '').trim() || DEFAULT_TEAM_URL);
    paintKeyPanel();
  });

  $('#regenKey').addEventListener('click', () => {
    if (!isOwner()) return;
    if (!window.confirm('Generate a new secret key?\n\nAnyone still using the old key will be locked out and will need the new one.')) return;
    store.write('teamKey', newSecretKey());
    paintKeyPanel();
    notify('New key generated. Send it to anyone who still needs access.');
  });

  $('#testGate').addEventListener('click', lockBoard);

  paintKeyPanel();
  renderRoster();
})();
