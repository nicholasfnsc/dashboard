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
function openButton(url) {
  const a = document.createElement('a');
  a.href = url.trim();
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = 'hub-link';
  let host = url;
  try { host = new URL(url.trim()).hostname.replace(/^www\./, ''); } catch (e) { /* keep as typed */ }
  a.textContent = 'Open · ' + host;
  return a;
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
  } else {
    const t = el('span', 'hub-plain');
    t.textContent = value;
    cell.appendChild(t);
  }
  row.appendChild(cell);
  return row;
}

/* ---------- editing view ---------- */
function editItem(section, item, index) {
  const owner = isHubOwner();
  const editable = canEditHubItem(item);
  const box = el('div', 'hub-edit');

  if (!editable) {
    const shown = readItem(item) || el('p', 'hub-empty-value', item.label + ' — not filled in yet');
    box.appendChild(shown);
    const why = item.type === 'offername'
      ? 'Change the offer name at the top of Add Team.'
      : 'Shared by every offer — only the owner changes this.';
    box.appendChild(el('p', 'hub-locked', why));
    box.classList.add('is-locked');
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
      section.items.push({
        id: 'i' + Date.now().toString(36), type: type.value,
        scope: 'all', label: type.value === 'heading' ? 'New heading' : 'New row', value: ''
      });
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
}

function initRepHub() {
  $('#repHubEdit').addEventListener('click', () => {
    hubEditing = !hubEditing;
    renderRepHub();
  });
  renderRepHub();
}
