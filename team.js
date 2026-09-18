/* ============================================================
   team.js — Add Team tab
   ------------------------------------------------------------
   This offer's name, who is on its team, and how new people get in.
   Owner and admins only; reps never see this tab.

   Commission is not set here: it belongs to the call, since the same
   person earns 5% for setting and 3% for triaging. Removing someone
   switches them off rather than deleting them, so every call they
   logged and every dollar of commission still adds up. Making a new code signs the whole team out; they sign back in
   with the new one. Neither touches a single call.
   ============================================================ */

function savedRoster() {
  return CACHE.team;
}

/* ---------- roster ----------
   One line per person. A full-cycle rep is simply someone who is both a
   closer and a setter, so they appear in both dropdowns and earn each
   commission on the deals where they played that part. */
const ROLE_CHOICES = [
  { value: 'closer', label: 'Closer' },
  { value: 'setter', label: 'Setter' },
  { value: 'full',   label: 'Full cycle' }
];

const rolesFor = (choice) => (choice === 'full' ? ['closer', 'setter'] : [choice]);
const defaultRate = (role) => (role === 'closer' ? CLOSER_RATE : SETTER_RATE);

/* Everyone on the roster, one entry per person, in the order they were added. */
function rosterPeople() {
  const people = [];
  savedRoster().forEach((p) => {
    let person = people.find((x) => x.name === p.name);
    if (!person) { person = { name: p.name, rows: {} }; people.push(person); }
    person.rows[p.role] = p;
  });
  people.forEach((person) => {
    person.choice = person.rows.closer && person.rows.setter ? 'full' : person.rows.closer ? 'closer' : 'setter';
  });
  return people;
}

function roleLabel(choice) {
  return ROLE_CHOICES.find((c) => c.value === choice).label;
}

async function changeRole(person, choice) {
  const want = rolesFor(choice);
  const have = Object.keys(person.rows);
  pushUndo({ kind: 'restoreTeam', label: 'Changed ' + person.name + "'s role", team: savedRoster().slice() });
  try {
    for (const role of want) {
      if (have.indexOf(role) === -1) await addMember({ name: person.name, role, rate: defaultRate(role) });
    }
    for (const role of have) {
      if (want.indexOf(role) === -1) await removeMember(person.rows[role]);
    }
  } catch (err) {
    console.error(err);
    notify("Couldn't change their role — check your connection and try again.");
  }
  afterRosterChange();
  notify(person.name + ' is now ' + (choice === 'full' ? 'full cycle.' : 'a ' + roleLabel(choice).toLowerCase() + '.'));
}

function renderRoster() {
  const host = $('#rosterList');
  if (!host) return;
  const manager = canManage();
  host.textContent = '';

  const people = rosterPeople();
  if (!people.length) {
    host.appendChild(el('p', 'roster-empty', 'Nobody added yet.'));
  } else {
    const head = el('div', 'roster-row roster-head');
    ['Name', 'Role', 'Commission', ''].forEach((t) => head.appendChild(el('span', null, t)));
    host.appendChild(head);
  }

  people.forEach((person) => {
    const line = el('div', 'roster-row');

    const name = document.createElement('span');
    name.className = 'roster-name';
    name.textContent = person.name;             // typed by a person — never as markup
    line.appendChild(name);

    const role = document.createElement('select');
    role.className = 'role-select';
    role.setAttribute('aria-label', 'Role for ' + person.name);
    ROLE_CHOICES.forEach((c) => {
      const option = el('option', null, c.label);
      option.value = c.value;
      role.appendChild(option);
    });
    role.value = person.choice;
    role.disabled = !manager;
    role.addEventListener('change', () => changeRole(person, role.value));
    line.appendChild(role);

    const remove = el('button', 'link-btn danger', 'Remove');
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Remove ' + person.name);
    remove.classList.toggle('hidden', !manager);
    remove.addEventListener('click', async () => {
      if (!window.confirm('Remove ' + person.name + ' from this team?\n\nTheir logged calls stay exactly as they are.')) return;
      pushUndo({ kind: 'restoreTeam', label: 'Removed ' + person.name, team: savedRoster().slice() });
      try {
        for (const r of Object.keys(person.rows)) await removeMember(person.rows[r]);
      } catch (err) {
        console.error(err);
        notify("Couldn't remove them — check your connection and try again.");
        return;
      }
      afterRosterChange();
      notify('Removed ' + person.name + '. Their logged calls are untouched.');
    });
    line.appendChild(remove);

    host.appendChild(line);
  });

  const form = $('#addPersonForm');
  if (form) form.classList.toggle('hidden', !manager);
}

function afterRosterChange() {
  renderRoster();
  fillTeamSelects();
  render();
}

async function addPerson() {
  const input = $('#newPerson');
  const choice = $('#newPersonRole').value;
  const name = (input.value || '').trim().replace(/\s+/g, ' ');
  if (!name) { input.focus(); return; }

  const existing = rosterPeople().find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    input.value = '';
    if (existing.choice !== choice) await changeRole(existing, choice);
    return;
  }

  input.value = '';
  pushUndo({ kind: 'restoreTeam', label: 'Added ' + name, team: savedRoster().slice() });
  try {
    for (const role of rolesFor(choice)) await addMember({ name, role, rate: defaultRate(role) });
  } catch (err) {
    console.error(err);
    notify("Couldn't add them — check your connection and try again.");
    return;
  }
  afterRosterChange();
  input.focus();
}

/* ---------- team login ---------- */
function paintKeyPanel() {
  const url = $('#teamUrl');
  if (!url) return;
  url.value = PORTAL_ORIGIN + TEAM_LOGIN_PATH;
  $('#teamCode').value = CACHE.code || '';
}

async function copyFrom(inputId, button) {
  const input = $('#' + inputId);
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(input.value);
  } catch (err) {
    input.select();
    try { document.execCommand('copy'); } catch (e) { /* nothing else to try */ }
  }
  button.textContent = 'Copied';
  setTimeout(() => { button.textContent = original; }, 1600);
}

async function makeNewCode() {
  const name = (CACHE.board && CACHE.board.name) || 'this offer';
  const sure = window.confirm(
    'Make a new code for ' + name + '?\n\n' +
    'Everyone on this team is signed out straight away and needs the new code to get back in. ' +
    'No calls or numbers are affected.');
  if (!sure) return;

  const button = $('#rotateCodeBtn');
  button.disabled = true;
  try {
    await rotateCode(CACHE.boardId);
  } catch (err) {
    console.error(err);
    notify(err.message || "Couldn't make a new code.");
    return;
  } finally {
    button.disabled = false;
  }
  paintKeyPanel();
  notify('New code: ' + CACHE.code + '. Send it to everyone who should still have access.');
}

/* ---------- the offer's name ----------
   One copy, stored on the offer. The hub card, the offer tabs, the top
   of the dashboard and the team login's name in Supabase all read it. */
function paintBoardName() {
  const name = (CACHE.board && CACHE.board.name) || 'Sales team board';
  const head = $('#boardNameHead');
  if (head) head.textContent = name;
  document.title = name + ' · Inevitable Acquisition';

  const tab = document.querySelector('.offer-tab[data-board="' + CACHE.boardId + '"]');
  if (tab) tab.textContent = name;

  const input = $('#offerNameInput');
  if (input && document.activeElement !== input) {
    input.value = name === 'Untitled offer' ? '' : name;
  }
}

async function saveOfferName() {
  const input = $('#offerNameInput');
  const name = input.value.trim() || 'Untitled offer';
  if (CACHE.board && name === CACHE.board.name) return;
  try {
    await renameBoard(name);
  } catch (err) {
    console.error(err);
    notify("Couldn't rename this offer.");
    return;
  }
  paintBoardName();
  syncBoardAddress();
  notify('Offer renamed to ' + name + '.');
}

function initTeamTab() {
  const nameInput = $('#offerNameInput');
  nameInput.addEventListener('change', saveOfferName);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });
  paintBoardName();

  if (!$('#rosterList')) return;

  $('#addPersonForm').addEventListener('submit', (e) => { e.preventDefault(); addPerson(); });

  document.querySelectorAll('.btn-copy').forEach((b) => {
    b.addEventListener('click', () => copyFrom(b.dataset.copy, b));
  });

  $('#rotateCodeBtn').addEventListener('click', makeNewCode);

  paintKeyPanel();
  renderRoster();
}
