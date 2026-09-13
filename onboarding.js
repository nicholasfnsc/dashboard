/* ============================================================
   onboarding.js — Onboarding tab
   ------------------------------------------------------------
   The Directory: this offer's name and the links a team member
   needs. The name typed here is the one shown on the hub, in the
   offer tabs and at the top of the dashboard — there is only ever
   one copy of it.

   Owner and admins edit. Reps see the same page as clickable links.
   Changes save as you leave each box.
   ============================================================ */

const DIRECTORY_FIELDS = [
  { key: 'youtube',          label: 'YouTube' },
  { key: 'instagram',        label: 'Instagram' },
  { key: 'adsLibrary',       label: 'Ads Library' },
  { key: 'pitchDeck',        label: 'Pitch Deck' },
  { key: 'vslPage',          label: 'VSL Landing Page' },
  { key: 'confirmationPage', label: 'Confirmation Page' }
];

function directory() {
  const d = (CACHE.board && CACHE.board.directory) || {};
  return Object.assign({ extra: [] }, d, { extra: Array.isArray(d.extra) ? d.extra : [] });
}

const looksLikeLink = (v) => /^https?:\/\//i.test(String(v || '').trim());

/* A link someone can click, or a dash when there is nothing yet. */
function linkOrDash(url) {
  if (!looksLikeLink(url)) {
    const span = el('span', 'dir-empty', '—');
    return span;
  }
  const a = document.createElement('a');
  a.href = url.trim();
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = 'cell-link';
  a.textContent = url.trim();
  return a;
}

async function persist(next, message) {
  try {
    await saveDirectory(next);
  } catch (err) {
    console.error(err);
    notify("Couldn't save that — check your connection and try again.");
    return false;
  }
  if (message) notify(message);
  return true;
}

function row(labelText, control) {
  const r = el('div', 'dir-row');
  r.appendChild(el('span', 'dir-label', labelText));
  const cell = el('div', 'dir-value');
  cell.appendChild(control);
  r.appendChild(cell);
  return r;
}

function renderOnboarding() {
  const host = $('#directoryRows');
  if (!host || !CACHE.board) return;
  host.textContent = '';

  const manager = canManage();
  const d = directory();

  /* ---------- the offer's name ---------- */
  if (manager) {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'dirName';
    input.className = 'dir-input';
    input.placeholder = 'Add a name…';
    input.value = CACHE.board.name === 'Untitled offer' ? '' : CACHE.board.name;
    input.addEventListener('change', async () => {
      const name = input.value.trim() || 'Untitled offer';
      try {
        await renameBoard(name);
      } catch (err) {
        console.error(err);
        notify("Couldn't rename this offer.");
        return;
      }
      paintBoardName();
      notify('Offer renamed to ' + name + '.');
    });
    host.appendChild(row('Offer name', input));
  } else {
    host.appendChild(row('Offer name', el('span', 'dir-text', '')));
    host.lastChild.querySelector('.dir-text').textContent = CACHE.board.name;
  }

  /* ---------- the standard links ---------- */
  DIRECTORY_FIELDS.forEach((f) => {
    if (manager) {
      const input = document.createElement('input');
      input.type = 'url';
      input.id = 'dir-' + f.key;
      input.className = 'dir-input';
      input.placeholder = 'Add a link…';
      input.value = d[f.key] || '';
      input.addEventListener('change', () => {
        const next = directory();
        next[f.key] = input.value.trim();
        persist(next, f.label + ' saved.');
      });
      host.appendChild(row(f.label, input));
    } else {
      host.appendChild(row(f.label, linkOrDash(d[f.key])));
    }
  });

  /* ---------- anything else the offer needs ---------- */
  const extraHost = $('#directoryExtra');
  extraHost.textContent = '';
  d.extra.forEach((item, index) => {
    const r = row('', linkOrDash(item.url));
    r.querySelector('.dir-label').textContent = item.label;
    if (manager) {
      const remove = el('button', 'link-btn danger', 'Remove');
      remove.type = 'button';
      remove.addEventListener('click', async () => {
        const next = directory();
        next.extra.splice(index, 1);
        if (await persist(next, 'Link removed.')) renderOnboarding();
      });
      r.appendChild(remove);
    }
    extraHost.appendChild(r);
  });

  $('#directoryAddForm').classList.toggle('hidden', !manager);
}

function paintBoardName() {
  const name = (CACHE.board && CACHE.board.name) || 'Sales team board';
  const head = $('#boardNameHead');
  if (head) head.textContent = name;
  document.title = name + ' · Inevitable Acquisition';

  const tab = document.querySelector('.offer-tab[data-board="' + CACHE.boardId + '"]');
  if (tab) tab.textContent = name;
}

function initOnboarding() {
  $('#directoryAddForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const label = $('#dirNewLabel').value.trim();
    const url = $('#dirNewUrl').value.trim();
    if (!label) { $('#dirNewLabel').focus(); return; }
    if (!looksLikeLink(url)) { notify('Links need to start with https://'); $('#dirNewUrl').focus(); return; }

    const next = directory();
    next.extra.push({ label, url });
    if (await persist(next, label + ' added.')) {
      $('#dirNewLabel').value = '';
      $('#dirNewUrl').value = '';
      renderOnboarding();
    }
  });

  paintBoardName();
  renderOnboarding();
}
