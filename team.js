/* ============================================================
   team.js — Add Team tab
   ------------------------------------------------------------
   Who is on this offer's team, and how new people get in.
   Owner and admins only; reps never see this tab.

   Removing someone switches them off rather than deleting them, so
   every call they logged and every dollar of commission still adds
   up. Making a new code signs the whole team out; they sign back in
   with the new one. Neither touches a single call.
   ============================================================ */

function savedRoster() {
  return CACHE.team;
}

/* ---------- roster ---------- */
function renderRoster() {
  const rows = savedRoster();
  const manager = canManage();

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
      name.textContent = p.name;              // typed by a person — never as markup
      line.appendChild(name);

      if (manager) {
        const remove = el('button', 'link-btn danger', 'Remove');
        remove.type = 'button';
        remove.setAttribute('aria-label', 'Remove ' + p.name);
        remove.addEventListener('click', async () => {
          if (!window.confirm('Remove ' + p.name + ' from this team?\n\nTheir logged calls stay exactly as they are.')) return;
          pushUndo({ kind: 'restoreTeam', label: 'Removed ' + p.name, team: savedRoster().slice() });
          try {
            await removeMember(p);
          } catch (err) {
            console.error(err);
            notify("Couldn't remove them — check your connection and try again.");
            return;
          }
          afterRosterChange();
          notify('Removed ' + p.name + '. Their logged calls are untouched.');
        });
        line.appendChild(remove);
      }

      host.appendChild(line);
    });
  });

  ['addCloserForm', 'addSetterForm'].forEach((id) => {
    const node = $('#' + id);
    if (node) node.classList.toggle('hidden', !manager);
  });
}

function afterRosterChange() {
  renderRoster();
  fillTeamSelects();
  render();
}

async function addPerson(role, inputId) {
  const input = $('#' + inputId);
  const name = (input.value || '').trim().replace(/\s+/g, ' ');
  if (!name) { input.focus(); return; }

  if (savedRoster().some((p) => p.name.toLowerCase() === name.toLowerCase() && p.role === role)) {
    input.value = '';
    return;                                   // already on this team in this role
  }

  input.value = '';
  try {
    await addMember({ name: name, role: role, rate: role === 'closer' ? CLOSER_RATE : SETTER_RATE });
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

function initTeamTab() {
  if (!$('#closerList')) return;

  $('#addCloserForm').addEventListener('submit', (e) => { e.preventDefault(); addPerson('closer', 'newCloser'); });
  $('#addSetterForm').addEventListener('submit', (e) => { e.preventDefault(); addPerson('setter', 'newSetter'); });

  document.querySelectorAll('.btn-copy').forEach((b) => {
    b.addEventListener('click', () => copyFrom(b.dataset.copy, b));
  });

  $('#rotateCodeBtn').addEventListener('click', makeNewCode);

  paintKeyPanel();
  renderRoster();
}
