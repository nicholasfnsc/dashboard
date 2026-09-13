/* ============================================================
   team.js — Add Team tab
   ------------------------------------------------------------
   The roster here fills the Closer and Setter dropdowns on the Post
   Call Form and decides who the Commission Tracking panels pay. It
   lives in the shared database, so it is the same roster for
   everyone.

   The secret key is NOT here. It is the password of the shared sales
   account inside Supabase, stored hashed and checked on their server.
   Nothing in this file — or any file in this repo — knows what it is.
   ============================================================ */

const DEFAULT_TEAM_URL = 'https://sales.inevitableacq.com' + TEAM_ACCESS_PATH;

function savedRoster() {
  return CACHE.team;
}

const isOwner = () => CACHE.role === 'owner';

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

      if (isOwner()) {
        const remove = el('button', 'link-btn danger', 'Remove');
        remove.type = 'button';
        remove.setAttribute('aria-label', 'Remove ' + p.name);
        remove.addEventListener('click', async () => {
          if (!window.confirm('Remove ' + p.name + ' from the roster?\n\nTheir logged calls stay exactly as they are.')) return;
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

  /* Only the owner changes the roster, so hide the controls otherwise
     rather than letting the database refuse a click. */
  const owner = isOwner();
  ['addCloserForm', 'addSetterForm'].forEach((id) => {
    const node = $('#' + id);
    if (node) node.classList.toggle('hidden', !owner);
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
    return;                                   // already on the roster in this role
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

/* ---------- the team login panel ---------- */
function paintKeyPanel() {
  const keyInput = $('#teamKey');
  if (!keyInput) return;

  const settings = CACHE.settings || {};
  $('#teamUrl').value = settings.teamUrl || DEFAULT_TEAM_URL;

  /* There is nothing to display: the key is a password held by Supabase,
     and the whole point is that this page cannot read it. */
  keyInput.value = '';
  $('#teamUrl').readOnly = !isOwner();
  $('#keyOwnerOnly').classList.toggle('hidden', !isOwner());
  $('#keyTeamNote').classList.toggle('hidden', isOwner());
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

function initTeamTab() {
  if (!$('#closerList')) return;

  $('#addCloserForm').addEventListener('submit', (e) => { e.preventDefault(); addPerson('closer', 'newCloser'); });
  $('#addSetterForm').addEventListener('submit', (e) => { e.preventDefault(); addPerson('setter', 'newSetter'); });

  document.querySelectorAll('.btn-copy').forEach((b) => {
    b.addEventListener('click', () => copyFrom(b.dataset.copy, b));
  });

  $('#teamUrl').addEventListener('change', async (e) => {
    if (!isOwner()) return;
    const url = (e.target.value || '').trim() || DEFAULT_TEAM_URL;
    try {
      await saveSetting('teamUrl', url);
    } catch (err) {
      console.error(err);
      notify("Couldn't save that link — check your connection and try again.");
    }
    paintKeyPanel();
  });

  paintKeyPanel();
  renderRoster();
}
