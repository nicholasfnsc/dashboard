/* ============================================================
   profile.js — the name at the top right
   ------------------------------------------------------------
   Owner and admins: their own name, role and picture, which they
   can edit. What they can SEE is set by the owner and cannot be
   changed here.

   Reps: they share their team's account, so they pick which person
   on the roster they are. That choice is remembered on their own
   device and only changes what the top right shows — calls are
   recorded by the Closer and Setter fields on the form.
   ============================================================ */

const repKey = () => 'ia-who:' + CACHE.boardId;

function chosenRep() {
  let name = '';
  try { name = localStorage.getItem(repKey()) || ''; } catch (e) { name = ''; }
  return CACHE.team.some((p) => p.name === name) ? name : '';
}

function chooseRep(name) {
  try { localStorage.setItem(repKey(), name); } catch (e) { /* private window: they pick again next visit */ }
}

function initials(text) {
  const parts = String(text || '').trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

/* A round picture if there is one, otherwise initials. */
function paintAvatar(node, name, url) {
  node.textContent = '';
  node.classList.toggle('has-photo', !!url);
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.onerror = () => { node.classList.remove('has-photo'); node.textContent = initials(name); };
    node.appendChild(img);
  } else {
    node.textContent = initials(name);
  }
}

function repRoles(name) {
  const roles = CACHE.team.filter((p) => p.name === name).map((p) => p.role);
  if (roles.indexOf('closer') !== -1 && roles.indexOf('setter') !== -1) return 'Full cycle';
  return roles.indexOf('closer') !== -1 ? 'Closer' : roles.indexOf('setter') !== -1 ? 'Setter' : '';
}

function paintProfile() {
  const chip = $('#profileChip');
  if (!CACHE.me) { chip.classList.add('hidden'); return; }

  let name;
  let title;
  let photo = '';

  if (CACHE.me.kind === 'team') {
    const rep = chosenRep();
    if (!CACHE.team.length) { chip.classList.add('hidden'); return; }
    name = rep || 'Pick your name';
    title = rep ? repRoles(rep) : 'Sales team';
    chip.title = 'Switch who is logged in';
  } else {
    name = CACHE.me.name || CACHE.me.email;
    title = CACHE.me.title || (CACHE.me.isOwner ? 'Owner' : 'Admin');
    photo = CACHE.me.avatar;
    chip.title = 'Edit your profile';
  }

  paintAvatar($('#profileAvatar'), name === 'Pick your name' ? '?' : name, photo);
  $('#profileName').textContent = name;
  $('#profileTitle').textContent = title;
  chip.classList.remove('hidden');
}

/* ---------- reps: who is this? ---------- */
function askWho(force) {
  if (!CACHE.me || CACHE.me.kind !== 'team') return;
  if (!CACHE.team.length) return;                 // nobody on the roster yet — nothing to pick
  if (!force && chosenRep()) return;

  const names = Array.from(new Set(CACHE.team.map((p) => p.name)));
  const list = $('#whoList');
  list.textContent = '';
  names.forEach((n) => {
    const option = el('button', 'who-option');
    option.type = 'button';

    const who = el('span', 'who-name');
    who.textContent = n;                          // typed by a person — never as markup
    option.appendChild(who);
    option.appendChild(el('span', 'who-role', repRoles(n)));

    option.addEventListener('click', () => {
      chooseRep(n);
      $('#viewWho').classList.add('hidden');
      paintProfile();
    });
    list.appendChild(option);
  });
  $('#viewWho').classList.remove('hidden');
}

/* ---------- owner and admins: edit your own profile ---------- */
function paintPhotoEditor() {
  paintAvatar($('#profilePhotoPreview'), $('#profileNameInput').value || CACHE.me.name || CACHE.me.email, CACHE.me.avatar);
  $('#profilePhotoRemove').classList.toggle('hidden', !CACHE.me.avatar);
  document.querySelector('label[for="profilePhotoInput"]').textContent = CACHE.me.avatar ? 'Change photo' : 'Upload photo';
}

function openProfileEditor() {
  $('#profileEmail').textContent = CACHE.me.email;
  $('#profileNameInput').value = CACHE.me.name || '';
  $('#profileTitleInput').value = CACHE.me.title || '';
  $('#profileError').classList.add('hidden');
  $('#profilePhotoNote').textContent = 'Square photos look best.';
  paintPhotoEditor();
  $('#viewProfile').classList.remove('hidden');
  $('#profileNameInput').focus();
}

function initProfile() {
  $('#profileChip').addEventListener('click', () => {
    if (CACHE.me.kind === 'team') askWho(true);
    else openProfileEditor();
  });

  $('#profileCancel').addEventListener('click', () => $('#viewProfile').classList.add('hidden'));

  const note = $('#profilePhotoNote');
  $('#profilePhotoInput').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    note.textContent = 'Uploading…';
    try {
      await setMyAvatar(file);
    } catch (err) {
      console.error(err);
      note.textContent = err.message || "Couldn't upload that picture.";
      return;
    }
    note.textContent = 'Photo saved.';
    paintPhotoEditor();
    paintProfile();
  });

  $('#profilePhotoRemove').addEventListener('click', async () => {
    note.textContent = 'Removing…';
    try {
      await removeMyAvatar();
    } catch (err) {
      console.error(err);
      note.textContent = "Couldn't remove it — try again.";
      return;
    }
    note.textContent = 'Photo removed.';
    paintPhotoEditor();
    paintProfile();
  });

  $('#profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#profileNameInput').value.trim();
    const title = $('#profileTitleInput').value.trim();
    if (!name) {
      $('#profileError').textContent = 'Add your name.';
      $('#profileError').classList.remove('hidden');
      return;
    }
    const problem = await updateMyProfile(name, title);
    if (problem) {
      $('#profileError').textContent = problem;
      $('#profileError').classList.remove('hidden');
      return;
    }
    $('#viewProfile').classList.add('hidden');
    paintProfile();
    if (typeof renderPortal === 'function' && !$('#portalShell').classList.contains('hidden')) renderPortal();
    notify('Profile saved.');
  });

  paintProfile();
  askWho(false);
}
