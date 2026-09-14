/* ============================================================
   access.js — Team & Access (/team-access), owner only
   ------------------------------------------------------------
   Invite admins and choose what each one can use:
     sections   which parts of the portal they can open
     offers     every offer, or a chosen few, inside the sections
                that are per offer

   Inside a section they are given, an admin can view and edit. The
   database enforces all of it (supabase/access.sql); this page only
   records the owner's choices through the server.
   ============================================================ */

const ACCESS_PATH = '/team-access';
let accessAdmins = [];

/* One access picker: section boxes, then offers. Reads and writes a
   plain { sections, allOffers, boardIds } object. */
function accessPicker(value, onChange) {
  const box = el('div', 'access-picker');
  const state = {
    sections: (value.sections || []).slice(),
    allOffers: !!value.allOffers,
    boardIds: (value.boardIds || []).slice()
  };
  const changed = () => { paint(); if (onChange) onChange(state); };

  const check = (label, checked, toggle) => {
    const wrap = el('label', 'check');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => { toggle(input.checked); changed(); });
    wrap.appendChild(input);
    wrap.appendChild(document.createTextNode(' ' + label));
    return wrap;
  };

  const sectionsGroup = el('div', 'access-group');
  sectionsGroup.appendChild(el('span', 'field-label', 'Sections'));
  const sectionRow = el('div', 'check-row');
  PORTAL_SECTION_KEYS.forEach((key) => {
    sectionRow.appendChild(check(PORTAL_SECTION_NAMES[key], state.sections.indexOf(key) !== -1, (on) => {
      state.sections = PORTAL_SECTION_KEYS.filter((k) => (k === key ? on : state.sections.indexOf(k) !== -1));
    }));
  });
  sectionsGroup.appendChild(sectionRow);
  box.appendChild(sectionsGroup);

  const offersGroup = el('div', 'access-group');
  offersGroup.appendChild(el('span', 'field-label', 'Offers'));
  const offerRow = el('div', 'check-row');
  offersGroup.appendChild(offerRow);
  offersGroup.appendChild(el('span', 'access-note', 'Used by Sales Team Boards and Metrics Tracking.'));
  box.appendChild(offersGroup);

  const allBox = check('All offers, including new ones', state.allOffers, (on) => { state.allOffers = on; });
  offerRow.appendChild(allBox);
  if (!CACHE.boards.length) offerRow.appendChild(el('span', 'axis-note', 'No offers yet.'));
  const offerBoxes = CACHE.boards.map((b) => {
    const item = check(b.name, false, (on) => {
      state.boardIds = on ? state.boardIds.concat([b.id]) : state.boardIds.filter((id) => id !== b.id);
    });
    item.dataset.board = b.id;
    offerRow.appendChild(item);
    return item;
  });

  /* With "All offers" ticked, the single offers show as included. */
  function paint() {
    allBox.querySelector('input').checked = state.allOffers;
    offerBoxes.forEach((item) => {
      const input = item.querySelector('input');
      input.checked = state.allOffers || state.boardIds.indexOf(item.dataset.board) !== -1;
      input.disabled = state.allOffers;
      item.classList.toggle('is-muted', state.allOffers);
    });
  }
  paint();

  box.value = () => ({ sections: state.sections.slice(), allOffers: state.allOffers, boardIds: state.boardIds.slice() });
  box.reset = () => {
    state.sections = []; state.allOffers = false; state.boardIds = [];
    sectionRow.querySelectorAll('input').forEach((i) => { i.checked = false; });
    paint();
  };
  return box;
}

function accessSummary(a) {
  if (!a.sections.length) return 'No sections yet';
  const offers = a.allOffers ? 'all offers'
    : a.boardIds.length ? a.boardIds.length + (a.boardIds.length === 1 ? ' offer' : ' offers') : 'no offers';
  return a.sections.length + (a.sections.length === 1 ? ' section' : ' sections') + ' · ' + offers;
}

function renderAccessAdmins() {
  const host = $('#adminList');
  host.textContent = '';

  if (!accessAdmins.length) {
    host.appendChild(el('p', 'hub-empty', 'No admins yet. Invite your first one above.'));
    return;
  }

  accessAdmins.forEach((a) => {
    const card = el('article', 'panel admin-card');

    const head = el('div', 'admin-card-head');
    const avatar = el('span', 'avatar avatar-md');
    paintAvatar(avatar, a.name || a.email, a.avatar);
    head.appendChild(avatar);

    const who = el('div', 'admin-who');
    const name = el('span', 'admin-name');
    name.textContent = a.name || a.email;
    who.appendChild(name);
    const detail = el('span', 'admin-email');
    detail.textContent = [a.title, a.name ? a.email : ''].filter(Boolean).join(' · ');
    if (detail.textContent) who.appendChild(detail);
    head.appendChild(who);

    const status = el('div', 'admin-status');
    if (!a.joined) status.appendChild(el('span', 'admin-pending', 'Invite not accepted yet'));
    const summary = el('span', 'admin-summary', '');
    summary.textContent = accessSummary(a);
    status.appendChild(summary);
    head.appendChild(status);

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
      accessAdmins = accessAdmins.filter((x) => x.id !== a.id);
      renderAccessAdmins();
      notify('Removed ' + (a.name || a.email) + '.');
    });
    head.appendChild(remove);
    card.appendChild(head);

    let saveTimer = 0;
    const picker = accessPicker(a, (value) => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        try {
          await setAdminAccess(a.id, value);
        } catch (err) {
          console.error(err);
          notify(err.message);
          return;
        }
        Object.assign(a, value);
        summary.textContent = accessSummary(a);
        notify('Access updated for ' + (a.name || a.email) + '.');
      }, 450);
    });
    card.appendChild(picker);

    host.appendChild(card);
  });
}

async function loadAccessAdmins() {
  try {
    const result = await listAdmins();
    accessAdmins = result.admins || [];
    $('#accessNotReady').classList.toggle('hidden', result.ready !== false);
  } catch (err) {
    console.error(err);
    accessAdmins = [];
    notify(err.message);
  }
  renderAccessAdmins();
}

function initAccess() {
  const invitePicker = accessPicker({ sections: [], allOffers: false, boardIds: [] });
  $('#inviteAccess').appendChild(invitePicker);

  $('#inviteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#inviteName').value.trim();
    const email = $('#inviteEmail').value.trim();
    const title = $('#inviteTitle').value.trim();
    const access = invitePicker.value();
    if (!email) { $('#inviteEmail').focus(); return; }
    if (!access.sections.length) { notify('Tick at least one section they can use.'); return; }

    const button = $('#inviteBtn');
    button.disabled = true;
    try {
      await inviteAdmin(name, email, title, access);
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
    invitePicker.reset();
    notify('Invite sent to ' + email + '.');
    loadAccessAdmins();
  });

  loadAccessAdmins();
}
