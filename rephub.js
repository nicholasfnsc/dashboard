/* ============================================================
   rephub.js — the Rep Hub tab
   ------------------------------------------------------------
   Everything a rep needs to operate: how to start, the standards,
   the offer's assets, and the SOPs for their role.

   It is a template. Every row is either:
     All offers        — filled in once, shown on every board
     This offer only   — each offer fills in its own

   The owner edits everything, including the rows themselves. An
   offer's admins fill in that offer's "This offer only" rows. Reps
   read and click; they cannot change anything.
   ============================================================ */

/* The starting template — your Rep Hub document, turned into rows.
   Once you save a change, the saved version replaces this one. */
const DEFAULT_REP_HUB = {
  sections: [
    {
      id: 'start', title: 'Start Here',
      items: [
        { id: 'start-intro', type: 'text', scope: 'all', label: '',
          value: "Everything you need to operate at a high level here lives in this hub.\n\nExpectations, how everything works day to day, and every tool, login, and asset you'll ever need to do your job.\n\nRead it all before you're considered onboarded. Start with the Loom below — it walks you through how this hub is laid out and what you're responsible for." },
        { id: 'start-loom', type: 'video', scope: 'all', label: 'Onboarding Guide', value: '' },
        { id: 'start-order-heading', type: 'heading', scope: 'all', label: 'Then work through it in this order', value: '' },
        { id: 'start-order', type: 'text', scope: 'all', label: '',
          value: "1. Watch the Standards video. This breaks down exactly how you're expected to perform and the mental frame you operate with inside this company. Non negotiables live here. Watch it before you touch anything else.\n\n2. Go through Client Assets. Everything about the offer lives here: social handles, landing page, confirmation page, logins for every tool, and the research doc you're required to fill out. You'll also find the walkthrough on how we run the CRM, how tracking works, and how payments are handled, including buy now pay later options and every payment link.\n\n3. Setters, go to Setter SOPs. Closers, go to Closer SOPs. Your daily process, responsibilities, and processes are all there. They're mandatory, not reference material." },
        { id: 'start-bar', type: 'note', scope: 'all', label: '',
          value: "We set a high bar here. This hub exists so there's zero excuse for not knowing something. If it applies to your role, it's in here. Own it." }
      ]
    },
    {
      id: 'standards', title: 'Standards',
      items: [
        { id: 'standards-video', type: 'video', scope: 'all', label: 'Inevitable Acquisition Standards', value: '' }
      ]
    },
    {
      id: 'assets', title: 'Client Assets',
      items: [
        { id: 'assets-drive', type: 'item', scope: 'offer', label: 'Google Drive (Marketing Team Only)', value: '' },
        { id: 'assets-offer-name', type: 'offername', scope: 'offer', label: 'Offer Name', value: '' },
        { id: 'assets-youtube', type: 'item', scope: 'offer', label: 'YouTube', value: '' },
        { id: 'assets-instagram', type: 'item', scope: 'offer', label: 'Instagram', value: '' },
        { id: 'assets-landing', type: 'item', scope: 'offer', label: 'Landing Page', value: '' },
        { id: 'assets-confirmation', type: 'item', scope: 'offer', label: 'Confirmation Page', value: '' },
        { id: 'assets-ads', type: 'item', scope: 'offer', label: 'Ads Library', value: '' },
        { id: 'assets-deck', type: 'item', scope: 'offer', label: 'Pitch Deck', value: '' },
        { id: 'assets-login-heading', type: 'heading', scope: 'offer', label: 'Login', value: '' },
        { id: 'assets-gmail', type: 'item', scope: 'offer', label: 'Team Gmail', value: '' },
        { id: 'assets-password', type: 'item', scope: 'offer', label: 'Team Password', value: '' },
        { id: 'assets-offer-heading', type: 'heading', scope: 'offer', label: 'Offer', value: '' },
        { id: 'assets-core', type: 'item', scope: 'offer', label: 'Offer Core', value: '' },
        { id: 'assets-research', type: 'item', scope: 'offer', label: 'Offer Research', value: '' },
        { id: 'assets-resources', type: 'item', scope: 'offer', label: 'Offer Resources', value: '' },
        { id: 'assets-faqs', type: 'item', scope: 'offer', label: "FAQ's", value: '' },
        { id: 'assets-tools-heading', type: 'heading', scope: 'offer', label: 'Research, CRM & tracking', value: '' },
        { id: 'assets-creator-doc', type: 'item', scope: 'offer', label: 'Creator Research Doc', value: '' },
        { id: 'assets-crm', type: 'item', scope: 'offer', label: 'CRM', value: '' },
        { id: 'assets-airtable', type: 'item', scope: 'offer', label: 'Tracking & Forms (Airtable)', value: '' }
      ]
    },
    {
      id: 'payments', title: 'Payment & BNPL',
      items: [
        { id: 'pay-walkthrough', type: 'video', scope: 'offer', label: 'How payments are handled', value: '' },
        { id: 'pay-links', type: 'item', scope: 'offer', label: 'Payment links', value: '' },
        { id: 'pay-bnpl', type: 'item', scope: 'offer', label: 'Buy now, pay later options', value: '' }
      ]
    },
    {
      id: 'setter', title: 'Setter SOPs',
      items: [
        { id: 'setter-daily', type: 'item', scope: 'all', label: 'Daily Process', value: '' },
        { id: 'setter-resp', type: 'item', scope: 'all', label: 'Responsibilities', value: '' },
        { id: 'setter-framework', type: 'item', scope: 'offer', label: 'Setter Framework', value: '' },
        { id: 'setter-process', type: 'item', scope: 'all', label: 'Setter Sales Process',
          value: 'https://miro.com/app/board/uXjVJReQAGo=/?share_link_id=328182428521' },
        { id: 'setter-handoff', type: 'item', scope: 'offer', label: 'Handoff Form', value: '' }
      ]
    },
    {
      id: 'closer', title: 'Closer SOPs',
      items: [
        { id: 'closer-daily', type: 'item', scope: 'all', label: 'Daily Process', value: '' },
        { id: 'closer-resp', type: 'item', scope: 'all', label: 'Responsibilities', value: '' },
        { id: 'closer-framework', type: 'item', scope: 'offer', label: 'Closer Framework', value: '' },
        { id: 'closer-process', type: 'item', scope: 'all', label: 'Closer Sales Process', value: '' },
        { id: 'closer-students', type: 'item', scope: 'offer', label: 'Onboarding Students', value: '' },
        { id: 'closer-tracking', type: 'item', scope: 'all', label: 'Closer Tracking', value: '' },
        { id: 'closer-financing', type: 'item', scope: 'all', label: 'Financing Guide', value: '' }
      ]
    }
  ]
};

const HUB_TYPES = [
  { value: 'item',    label: 'Link or text' },
  { value: 'video',   label: 'Video (Loom or YouTube)' },
  { value: 'text',    label: 'Paragraph' },
  { value: 'note',    label: 'Highlighted note' },
  { value: 'heading', label: 'Heading' }
];

let hubEditing = false;
let hubSectionId = 'start';
let hubSaveTimer = null;

/* ---------- reading values ---------- */
const hubSections = () => (CACHE.repHub && CACHE.repHub.sections) || [];
const offerHubValues = () => ((CACHE.board && CACHE.board.directory) || {}).repHub || {};
const looksLikeUrl = (v) => /^https?:\/\/\S+$/i.test(String(v || '').trim());

function hubValue(item) {
  if (item.type === 'offername') return (CACHE.board && CACHE.board.name) || '';
  return item.scope === 'offer' ? (offerHubValues()[item.id] || '') : (item.value || '');
}

const isHubOwner = () => CACHE.role === 'owner';

/* Owner: anything. Admin: this offer's own rows. Rep: nothing. */
function canEditHubItem(item) {
  if (item.type === 'offername') return false;         // renamed at the top of Add Team
  if (CACHE.role === 'owner') return true;
  if (item.type === 'heading') return false;           // the structure is the owner's
  return CACHE.role === 'admin' && item.scope === 'offer';
}

/* Turns a Loom or YouTube share link into something that plays in
   the page. Only an id is lifted out of the link, never the link as
   given, so nothing else can be smuggled into the player. */
function embedFor(url) {
  try {
    const u = new URL(String(url).trim());
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'loom.com') {
      const m = u.pathname.match(/\/(?:share|embed)\/([a-zA-Z0-9]+)/);
      if (m) return 'https://www.loom.com/embed/' + m[1];
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
      let id = host === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v');
      if (!id) {
        const m = u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]+)/);
        if (m) id = m[1];
      }
      if (id && /^[\w-]{6,20}$/.test(id)) return 'https://www.youtube.com/embed/' + id;
    }
  } catch (e) { /* not a link */ }
  return '';
}

/* ---------- saving ---------- */
function saveTemplateSoon() {
  clearTimeout(hubSaveTimer);
  hubSaveTimer = setTimeout(async () => {
    try {
      await saveRepHubTemplate();
      paintHubHint('Saved');
    } catch (err) {
      console.error(err);
      notify(CACHE.repHubReady
        ? "Couldn't save the Rep Hub — check your connection and try again."
        : 'The Rep Hub needs its one-time database setup before changes can be saved.');
    }
  }, 700);
}

async function saveHubValue(item, value) {
  if (item.scope === 'offer') {
    try {
      await saveOfferHubValue(item.id, value);
      paintHubHint('Saved');
    } catch (err) {
      console.error(err);
      notify("Couldn't save that — check your connection and try again.");
    }
  } else {
    item.value = value;
    saveTemplateSoon();
  }
}

function paintHubHint(text) {
  const hint = $('#repHubHint');
  if (!hint) return;
  hint.textContent = text;
  if (text === 'Saved') setTimeout(() => { if (hint.textContent === 'Saved') hint.textContent = ''; }, 1800);
}

/* ---------- reading view ---------- */
/* Small line icons. Drawn here rather than borrowed brand logos, so the
   page stays one consistent style whatever the link points at. */
const HUB_ICONS = {
  play:   '<path d="M8 5.5v13l10.5-6.5z"/>',
  camera: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  doc:    '<path d="M6.5 3.5h7l4 4v13h-11z"/><path d="M13.5 3.5v4h4M9 12.5h6M9 16h6"/>',
  sheet:  '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.5h16M4 14.5h16M10 9.5v10.5"/>',
  slides: '<rect x="3.5" y="5" width="17" height="11.5" rx="2"/><path d="M12 16.5v3M8.5 19.5h7"/>',
  form:   '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/>',
  board:  '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M7.5 9.5h4v5h-4zM14 9.5h2.5M14 12.5h2.5"/>',
  megaphone: '<path d="M4 10v4h3l7 4V6l-7 4z"/><path d="M17.5 9.5a3.5 3.5 0 0 1 0 5"/>',
  card:   '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 14.5h3"/>',
  globe:  '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.2-3.6-8.5S9.6 5.8 12 3.5z"/>'
};

function svgIcon(name, cls) {
  return '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (HUB_ICONS[name] || HUB_ICONS.globe) + '</svg>';
}

/* What a link is, in words a rep recognises. */
function describeLink(url) {
  let u;
  try { u = new URL(String(url).trim()); } catch (e) { return { icon: 'globe', text: 'Open link' }; }
  const host = u.hostname.replace(/^www\./, '');
  const path = u.pathname;

  if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com') {
    return /\/@|\/channel\/|\/c\//.test(path) ? { icon: 'play', text: 'YouTube channel' } : { icon: 'play', text: 'Watch on YouTube' };
  }
  if (host === 'instagram.com') return { icon: 'camera', text: 'Instagram' };
  if (host === 'loom.com') return { icon: 'play', text: 'Watch on Loom' };
  if (host === 'drive.google.com') return { icon: 'folder', text: 'Google Drive' };
  if (host === 'docs.google.com') {
    if (path.indexOf('/spreadsheets') === 0) return { icon: 'sheet', text: 'Google Sheet' };
    if (path.indexOf('/presentation') === 0) return { icon: 'slides', text: 'Google Slides' };
    if (path.indexOf('/forms') === 0) return { icon: 'form', text: 'Google Form' };
    return { icon: 'doc', text: 'Google Doc' };
  }
  if (host === 'forms.gle') return { icon: 'form', text: 'Google Form' };
  if (host === 'miro.com') return { icon: 'board', text: 'Miro board' };
  if (host === 'airtable.com') return { icon: 'sheet', text: 'Airtable' };
  if (/(^|\.)notion\.(so|site)$/.test(host)) return { icon: 'doc', text: 'Notion page' };
  if (host === 'canva.com') return { icon: 'slides', text: 'Canva' };
  if (host === 'facebook.com' && path.indexOf('/ads/library') === 0) return { icon: 'megaphone', text: 'Ads Library' };
  if (/stripe\.com$|whop\.com$|paypal\.com$|klarna\.com$|affirm\.com$/.test(host)) return { icon: 'card', text: host.split('.').slice(-2, -1)[0].replace(/^./, (c) => c.toUpperCase()) };
  /* A website: its address says the most. Keep the page path, so a
     landing page and its thank-you page don't read the same. */
  const page = path.replace(/\/+$/, '');
  const shown = host + (page && page.length <= 28 ? page : page ? '/…' : '');
  return { icon: 'globe', text: shown };
}

function openButton(url) {
  const a = document.createElement('a');
  a.href = url.trim();
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = 'hub-link';
  const what = describeLink(url);
  a.innerHTML = svgIcon(what.icon, 'hub-link-icon') +
    '<span class="hub-link-text"></span>' +
    '<svg class="hub-link-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 16 16 8M9.5 8H16v6.5"/></svg>';
  a.querySelector('.hub-link-text').textContent = what.text;  // a hostname is still text, never markup
  return a;
}

/* Plain text a rep will paste somewhere — an email, a password. */
function copyableText(value) {
  const wrap = el('span', 'hub-copyable');
  const t = el('span', 'hub-plain');
  t.textContent = value;
  wrap.appendChild(t);

  const b = el('button', 'hub-copy', 'Copy');
  b.type = 'button';
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(value); } catch (e) { /* clipboard blocked */ }
    b.textContent = 'Copied';
    setTimeout(() => { b.textContent = 'Copy'; }, 1500);
  });
  wrap.appendChild(b);
  return wrap;
}

function readItem(item) {
  const value = hubValue(item);
  const manager = CACHE.role === 'owner' || CACHE.role === 'admin';

  if (item.type === 'heading') {
    const h = el('h4', 'hub-heading');
    h.textContent = item.label;
    return h;
  }

  if (item.type === 'note' || item.type === 'text') {
    if (!value && !manager) return null;
    const p = el('p', item.type === 'note' ? 'hub-note' : 'hub-text');
    p.textContent = value || 'Not filled in yet.';
    if (!value) p.classList.add('hub-empty-value');
    return p;
  }

  if (!value && !manager) return null;                 // reps never see empty rows

  const row = el('div', item.type === 'video' ? 'hub-video' : 'hub-row');
  const label = el('span', 'hub-label');
  label.textContent = item.label;
  row.appendChild(label);

  const cell = el('div', 'hub-value');
  if (!value) {
    cell.appendChild(el('span', 'hub-empty-value', 'Not filled in yet'));
  } else if (item.type === 'video' && embedFor(value)) {
    const frame = document.createElement('iframe');
    frame.src = embedFor(value);
    frame.title = item.label || 'Video';
    frame.loading = 'lazy';
    frame.allowFullscreen = true;
    frame.setAttribute('allow', 'fullscreen; picture-in-picture');
    frame.className = 'hub-frame';
    cell.appendChild(frame);
  } else if (looksLikeUrl(value)) {
    cell.appendChild(openButton(value));
  } else if (item.type === 'item' && value.length <= 120 && value.indexOf('\n') === -1) {
    cell.appendChild(copyableText(value));
  } else {
    const t = el('span', 'hub-plain');
    t.textContent = value;
    cell.appendChild(t);
  }
  row.appendChild(cell);
  return row;
}

/* ---------- editing view ---------- */
function moveInList(list, from, to) {
  if (to < 0 || to >= list.length) return false;
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  return true;
}

function newRow(type) {
  return {
    id: 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    type, scope: 'all', label: type === 'heading' ? 'New heading' : 'New row', value: ''
  };
}

/* ↑ ↓ and "Add below" — the owner arranges the template. */
function orderControls(section, index) {
  const wrap = el('div', 'hub-order');

  const up = el('button', 'hub-icon-btn', '↑');
  up.type = 'button';
  up.title = 'Move up';
  up.setAttribute('aria-label', 'Move up');
  up.disabled = index === 0;
  up.addEventListener('click', () => {
    if (moveInList(section.items, index, index - 1)) { saveTemplateSoon(); renderRepHub(); }
  });

  const down = el('button', 'hub-icon-btn', '↓');
  down.type = 'button';
  down.title = 'Move down';
  down.setAttribute('aria-label', 'Move down');
  down.disabled = index === section.items.length - 1;
  down.addEventListener('click', () => {
    if (moveInList(section.items, index, index + 1)) { saveTemplateSoon(); renderRepHub(); }
  });

  const below = el('button', 'link-btn', '+ Add row below');
  below.type = 'button';
  below.addEventListener('click', () => {
    const row = newRow('item');
    section.items.splice(index + 1, 0, row);
    hubFocusId = row.id;
    saveTemplateSoon();
    renderRepHub();
  });

  wrap.appendChild(up);
  wrap.appendChild(down);
  wrap.appendChild(below);
  return wrap;
}

let hubFocusId = '';

function editItem(section, item, index) {
  const owner = isHubOwner();
  const editable = canEditHubItem(item);
  const box = el('div', 'hub-edit');

  box.dataset.item = item.id;

  if (!editable) {
    const shown = readItem(item) || el('p', 'hub-empty-value', item.label + ' — not filled in yet');
    box.appendChild(shown);
    const why = item.type === 'offername'
      ? 'Change the offer name at the top of Add Team.'
      : 'Shared by every offer — only the owner changes this.';
    box.appendChild(el('p', 'hub-locked', why));
    box.classList.add('is-locked');
    if (owner) box.appendChild(orderControls(section, index));   // the owner can still move it
    return box;
  }

  /* Owner-only controls: what the row is, and where it applies. */
  if (owner) {
    const controls = el('div', 'hub-edit-controls');

    if (item.type !== 'text' && item.type !== 'note') {
      const label = document.createElement('input');
      label.type = 'text';
      label.className = 'hub-edit-label';
      label.placeholder = item.type === 'heading' ? 'Heading' : 'Label';
      label.value = item.label;
      label.setAttribute('aria-label', 'Label');
      label.addEventListener('change', () => { item.label = label.value.trim(); saveTemplateSoon(); });
      controls.appendChild(label);
    }

    const type = document.createElement('select');
    type.setAttribute('aria-label', 'Row type');
    HUB_TYPES.forEach((t) => {
      const o = document.createElement('option');
      o.value = t.value;
      o.textContent = t.label;
      type.appendChild(o);
    });
    type.value = item.type === 'offername' ? 'item' : item.type;
    type.addEventListener('change', () => { item.type = type.value; saveTemplateSoon(); renderRepHub(); });
    controls.appendChild(type);

    if (item.type !== 'heading') {
      const scope = document.createElement('select');
      scope.setAttribute('aria-label', 'Applies to');
      [['all', 'All offers'], ['offer', 'This offer only']].forEach((pair) => {
        const o = document.createElement('option');
        o.value = pair[0];
        o.textContent = pair[1];
        scope.appendChild(o);
      });
      scope.value = item.scope;
      scope.addEventListener('change', () => { item.scope = scope.value; saveTemplateSoon(); renderRepHub(); });
      controls.appendChild(scope);
    }

    const remove = el('button', 'link-btn danger', 'Remove');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      if (!window.confirm('Remove "' + (item.label || 'this row') + '" from the Rep Hub on every offer?')) return;
      section.items.splice(index, 1);
      saveTemplateSoon();
      renderRepHub();
    });
    controls.appendChild(remove);

    box.appendChild(controls);
    box.appendChild(orderControls(section, index));
  } else {
    const label = el('span', 'hub-label');
    label.textContent = item.label;
    box.appendChild(label);
  }

  if (item.type !== 'heading') {
    const long = item.type === 'text' || item.type === 'note';
    const input = document.createElement(long ? 'textarea' : 'input');
    if (!long) input.type = 'text';
    if (long) input.rows = Math.min(10, Math.max(3, Math.ceil(hubValue(item).length / 90)));
    input.className = 'hub-edit-value';
    input.placeholder = item.type === 'video' ? 'Paste a Loom or YouTube link'
      : long ? 'Write it here…' : 'Paste a link, or type the text';
    input.value = hubValue(item);
    input.setAttribute('aria-label', item.label || 'Value');
    input.addEventListener('change', () => saveHubValue(item, input.value.trim()));
    box.appendChild(input);

    if (owner) {
      box.appendChild(el('p', 'hub-scope-note', item.scope === 'offer'
        ? 'This offer only — what you type here shows on this offer. Each offer fills in its own.'
        : 'All offers — what you type here shows on every offer.'));
    }
  }

  return box;
}

/* ---------- the page ---------- */
function renderRepHub() {
  const nav = $('#repHubNav');
  const content = $('#repHubContent');
  if (!nav || !CACHE.board) return;

  const sections = hubSections();
  if (!sections.some((s) => s.id === hubSectionId)) hubSectionId = sections[0] ? sections[0].id : '';
  const owner = isHubOwner();
  const manager = CACHE.role === 'owner' || CACHE.role === 'admin';

  /* ---- section menu ---- */
  nav.textContent = '';
  sections.forEach((s) => {
    const b = el('button', 'hub-nav-item');
    b.type = 'button';
    b.textContent = s.title;
    if (s.id === hubSectionId) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => {
      hubSectionId = s.id;
      renderRepHub();
      $('#repHubContent').scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    nav.appendChild(b);
  });

  if (hubEditing && owner) {
    const add = el('button', 'hub-nav-add', '+ Add section');
    add.type = 'button';
    add.addEventListener('click', () => {
      const id = 's' + Date.now().toString(36);
      CACHE.repHub.sections.push({ id, title: 'New section', items: [] });
      hubSectionId = id;
      saveTemplateSoon();
      renderRepHub();
    });
    nav.appendChild(add);
  }

  /* ---- edit button ---- */
  const editBtn = $('#repHubEdit');
  editBtn.classList.toggle('hidden', !manager);
  editBtn.textContent = hubEditing ? 'Done' : 'Edit';

  const section = sections.find((s) => s.id === hubSectionId);
  content.textContent = '';
  if (!section) {
    content.appendChild(el('p', 'hub-empty', 'Nothing here yet.'));
    return;
  }

  /* ---- section title ---- */
  const head = $('#repHubTitle');
  head.textContent = section.title;

  if (hubEditing && owner) {
    const titleRow = el('div', 'hub-title-edit');
    const title = document.createElement('input');
    title.type = 'text';
    title.className = 'hub-edit-label';
    title.value = section.title;
    title.setAttribute('aria-label', 'Section name');
    title.addEventListener('change', () => {
      section.title = title.value.trim() || 'Untitled section';
      saveTemplateSoon();
      renderRepHub();
    });
    titleRow.appendChild(el('span', 'field-label', 'Section name'));
    titleRow.appendChild(title);

    const removeSection = el('button', 'link-btn danger', 'Remove section');
    removeSection.type = 'button';
    removeSection.addEventListener('click', () => {
      if (!window.confirm('Remove the whole "' + section.title + '" section from every offer?')) return;
      CACHE.repHub.sections = sections.filter((s) => s.id !== section.id);
      saveTemplateSoon();
      renderRepHub();
    });
    titleRow.appendChild(removeSection);

    const at = sections.findIndex((s) => s.id === section.id);
    const sectionUp = el('button', 'link-btn', '↑ Move section up');
    sectionUp.type = 'button';
    sectionUp.disabled = at === 0;
    sectionUp.addEventListener('click', () => {
      if (moveInList(CACHE.repHub.sections, at, at - 1)) { saveTemplateSoon(); renderRepHub(); }
    });
    const sectionDown = el('button', 'link-btn', '↓ Move section down');
    sectionDown.type = 'button';
    sectionDown.disabled = at === sections.length - 1;
    sectionDown.addEventListener('click', () => {
      if (moveInList(CACHE.repHub.sections, at, at + 1)) { saveTemplateSoon(); renderRepHub(); }
    });
    titleRow.appendChild(sectionUp);
    titleRow.appendChild(sectionDown);

    content.appendChild(titleRow);
  }

  /* ---- rows ---- */
  const list = el('div', hubEditing ? 'hub-list is-editing' : 'hub-list');
  let shown = 0;
  section.items.forEach((item, index) => {
    /* A rep should never see a heading with nothing filled in beneath it. */
    if (!hubEditing && !manager && item.type === 'heading') {
      const after = section.items.slice(index + 1);
      const end = after.findIndex((x) => x.type === 'heading');
      const under = end === -1 ? after : after.slice(0, end);
      if (!under.some((x) => hubValue(x))) return;
    }
    const node = hubEditing ? editItem(section, item, index) : readItem(item);
    if (node) { list.appendChild(node); shown++; }
  });
  if (!shown) list.appendChild(el('p', 'hub-empty', 'Nothing here yet.'));
  content.appendChild(list);

  if (hubEditing && owner) {
    const adder = el('div', 'hub-adder');
    const type = document.createElement('select');
    type.setAttribute('aria-label', 'New row type');
    HUB_TYPES.forEach((t) => {
      const o = document.createElement('option');
      o.value = t.value;
      o.textContent = t.label;
      type.appendChild(o);
    });
    const add = el('button', 'btn-primary', '+ Add row');
    add.type = 'button';
    add.addEventListener('click', () => {
      const row = newRow(type.value);
      section.items.push(row);
      hubFocusId = row.id;
      saveTemplateSoon();
      renderRepHub();
    });
    adder.appendChild(type);
    adder.appendChild(add);
    content.appendChild(adder);
  }

  if (!CACHE.repHubReady && owner) {
    paintHubHint('Setup needed before edits save');
  }

  if (hubFocusId) {
    const box = content.querySelector('[data-item="' + hubFocusId + '"]');
    hubFocusId = '';
    if (box) {
      box.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const field = box.querySelector('.hub-edit-label, .hub-edit-value');
      if (field) { field.focus(); if (field.select) field.select(); }
    }
  }
}

function initRepHub() {
  $('#repHubEdit').addEventListener('click', () => {
    hubEditing = !hubEditing;
    renderRepHub();
  });
  renderRepHub();
}
