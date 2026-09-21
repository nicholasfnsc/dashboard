/* ============================================================
   playbooks.js — $1M/Month Playbooks
   ------------------------------------------------------------
   The playbooks for running an offer, each one a link to its doc.
   Click a playbook, the doc opens in its own tab.

   The list lives with the other shared settings, so every account
   that has this section sees the same playbooks. The owner writes
   them: rename, paste a link, add another, remove one.
   ============================================================ */

const PLAYBOOKS_PATH = '/playbooks';

/* The four written so far. They show until the first save, then
   whatever was saved replaces them. */
const DEFAULT_PLAYBOOKS = [
  { id: 'webinar-funnel',   title: 'Webinar Funnel Playbook',        url: '' },
  { id: 'selling-rich',     title: 'Selling To Rich People Playbook', url: '' },
  { id: 'paid-cold',        title: 'Paid and Cold Traffic Playbook',  url: '' },
  { id: 'call-funnel',      title: 'Call Funnel Playbook',            url: '' }
];

const pbId = () => 'pb-' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);

let playbookEditing = false;

function playbooks() {
  const saved = CACHE.repHub && CACHE.repHub.playbooks;
  const list = Array.isArray(saved) && saved.length ? saved : DEFAULT_PLAYBOOKS;
  return list.map((p) => ({ id: p.id || pbId(), title: p.title || '', url: p.url || '' }));
}

/* Only the owner, and admins who have every offer, write the list —
   it is one list shared by everyone who can see the section. */
const canEditPlaybooks = () => !!CACHE.me && CACHE.me.kind === 'person' &&
  (CACHE.me.isOwner || (CACHE.me.allOffers && canUse('playbooks')));

async function savePlaybooks(list) {
  CACHE.repHub.playbooks = list.map((p) => ({ id: p.id, title: p.title.trim(), url: p.url.trim() }));
  await saveRepHubTemplate();
}

/* ---------- one playbook ---------- */
function playbookIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true"><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H15l5 5v12.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20.5z"/>' +
    '<path d="M14.5 3v5.5H20"/><path d="M8.5 13h7"/><path d="M8.5 17h5"/></svg>';
}

function playbookCard(p) {
  const open = !!p.url;
  const card = document.createElement(open ? 'a' : 'div');
  card.className = 'pb-card' + (open ? '' : ' is-empty');
  if (open) {
    card.href = p.url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
  }

  const mark = el('span', 'pb-icon');
  mark.innerHTML = playbookIcon();
  card.appendChild(mark);

  const words = el('div', 'pb-words');
  const title = el('h2', 'pb-title');
  title.textContent = p.title || 'Untitled playbook';
  words.appendChild(title);
  words.appendChild(el('p', 'pb-sub', open ? 'Opens in Google Docs' : 'No link yet'));
  card.appendChild(words);

  if (open) {
    const arrow = el('span', 'pb-arrow');
    arrow.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 16 16 8M9.5 8H16v6.5"/></svg>';
    card.appendChild(arrow);
  }
  return card;
}

/* ---------- the owner's version of the same card ---------- */
function playbookEditor(p, list, index) {
  const box = el('div', 'pb-card pb-edit');

  const mark = el('span', 'pb-icon');
  mark.innerHTML = playbookIcon();
  box.appendChild(mark);

  const words = el('div', 'pb-words');

  const title = document.createElement('input');
  title.type = 'text';
  title.className = 'pb-title-input';
  title.value = p.title;
  title.placeholder = 'Playbook name';
  title.setAttribute('aria-label', 'Playbook name');
  title.addEventListener('change', () => { list[index].title = title.value; commitPlaybooks(list, title.value.trim() ? 'Saved.' : 'Name cleared.'); });
  words.appendChild(title);

  const url = document.createElement('input');
  url.type = 'url';
  url.className = 'pb-url-input';
  url.value = p.url;
  url.placeholder = 'Paste the Google Doc link';
  url.setAttribute('aria-label', 'Link for ' + (p.title || 'this playbook'));
  url.addEventListener('change', () => { list[index].url = url.value; commitPlaybooks(list, url.value.trim() ? 'Link saved.' : 'Link removed.'); });
  words.appendChild(url);

  box.appendChild(words);

  const remove = el('button', 'link-btn danger pb-remove', 'Remove');
  remove.type = 'button';
  remove.setAttribute('aria-label', 'Remove ' + (p.title || 'this playbook'));
  remove.addEventListener('click', () => {
    if (!window.confirm('Remove ' + (p.title || 'this playbook') + '? The doc itself is untouched.')) return;
    commitPlaybooks(list.filter((x) => x.id !== p.id), 'Playbook removed.');
  });
  box.appendChild(remove);

  return box;
}

async function commitPlaybooks(list, message) {
  try {
    await savePlaybooks(list);
    if (message) notify(message);
  } catch (err) {
    console.error(err);
    notify("Couldn't save the playbooks — check your connection.");
  }
  renderPlaybooks();
}

/* ---------- the page ---------- */
function renderPlaybooks() {
  const host = $('#playbookList');
  if (!host) return;
  const list = playbooks();
  const mine = canEditPlaybooks();

  host.textContent = '';
  list.forEach((p, i) => host.appendChild(playbookEditing ? playbookEditor(p, list.slice(), i) : playbookCard(p)));

  if (!list.length) {
    host.appendChild(el('p', 'pb-empty', mine
      ? 'No playbooks yet. Add the first one.'
      : 'No playbooks here yet.'));
  }

  const edit = $('#playbookEdit');
  edit.classList.toggle('hidden', !mine);
  edit.textContent = playbookEditing ? 'Done' : 'Edit';
  $('#playbookAdd').classList.toggle('hidden', !mine || !playbookEditing);

  const waiting = list.filter((p) => !p.url).length;
  $('#playbookHint').classList.toggle('hidden', !mine || !waiting || playbookEditing);
  $('#playbookHint').textContent = waiting === 1
    ? 'One playbook has no link yet. Press Edit and paste it.'
    : waiting + ' playbooks have no link yet. Press Edit and paste them.';
}

function initPlaybooks() {
  const edit = $('#playbookEdit');
  if (!edit) return;
  if (!edit.dataset.wired) {
    edit.dataset.wired = '1';
    edit.addEventListener('click', () => { playbookEditing = !playbookEditing; renderPlaybooks(); });
    $('#playbookAdd').addEventListener('click', () => {
      commitPlaybooks(playbooks().concat([{ id: pbId(), title: 'New playbook', url: '' }]), 'Playbook added.');
    });
  }
  playbookEditing = false;
  renderPlaybooks();
}
