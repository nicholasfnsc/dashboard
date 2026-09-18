/* ============================================================
   rephub.js — the Rep Hub tab
   ------------------------------------------------------------
   Everything a rep needs to operate: how to start, the standards,
   the offer's assets, and the SOPs for their role.

   It is a template. Every row is either:
     All offers        — filled in once, shown on every board
     This offer only   — each offer fills in its own

   The owner, and admins who have every offer, edit everything: the
   values, the rows, the links and the sections. An admin with only
   some offers fills in those offers' "This offer only" rows. Reps read
   and click. Who is an admin, and which offers they reach, is set in
   Team & Access.
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

/* A "Link or text" row can hold several values — a doc and the Loom that
   explains it — stored one per line, so rows saved before this still read
   exactly as they did. */
const splitValues = (v) => String(v || '').split('\n').map((x) => x.trim()).filter(Boolean);

function hubValue(item) {
  if (item.type === 'offername') return (CACHE.board && CACHE.board.name) || '';
  return item.scope === 'offer' ? (offerHubValues()[item.id] || '') : (item.value || '');
}

const isHubOwner = () => canEditShared();

/* The template is shared; an offer's own rows are not. */
function canEditHubItem(item) {
  if (item.type === 'offername') return false;         // renamed at the top of Add Team
  if (canEditShared()) return true;
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
  if (host === 'fathom.video') return { icon: 'play', text: 'Watch the call' };
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
    const p = el('p', item.type === 'note' ? 'hub-note is-' + noteColor(item) : 'hub-text');
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
  } else if (item.type === 'video') {
    cell.appendChild(looksLikeUrl(value) ? openButton(value) : copyableText(value));
  } else {
    const values = el('div', 'hub-values');
    splitValues(value).forEach((v) => {
      if (looksLikeUrl(v)) {
        values.appendChild(openButton(v));
      } else if (v.length <= 120) {
        values.appendChild(copyableText(v));
      } else {
        const t = el('span', 'hub-plain');
        t.textContent = v;
        values.appendChild(t);
      }
    });
    cell.appendChild(values);
  }
  row.appendChild(cell);
  return row;
}

/* ---------- editing view ---------- */
function newRow(type) {
  return {
    id: 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    type, scope: 'all', label: type === 'heading' ? 'New heading' : 'New row', value: ''
  };
}

/* "+ Add row below" — a new row exactly where it is wanted. */
function addBelowControl(section, index) {
  const below = el('button', 'link-btn hub-add-below', '+ Add row below');
  below.type = 'button';
  below.addEventListener('click', () => {
    const row = newRow('item');
    section.items.splice(index + 1, 0, row);
    hubFocusId = row.id;
    saveTemplateSoon();
    renderRepHub();
  });
  return below;
}

/* The six-dot handle a row or section is picked up by. It is a real
   button, so it can also be moved from the keyboard with the arrow keys. */
function dragHandle(label) {
  const grip = el('button', 'hub-grip');
  grip.type = 'button';
  grip.title = 'Drag to reorder';
  grip.setAttribute('aria-label', 'Reorder ' + (label || 'row') + ' — drag, or use the arrow keys');
  grip.innerHTML = '<svg viewBox="0 0 12 18" fill="currentColor" aria-hidden="true">' +
    '<circle cx="3" cy="3" r="1.4"/><circle cx="9" cy="3" r="1.4"/>' +
    '<circle cx="3" cy="9" r="1.4"/><circle cx="9" cy="9" r="1.4"/>' +
    '<circle cx="3" cy="15" r="1.4"/><circle cx="9" cy="15" r="1.4"/></svg>';
  return grip;
}

/* Makes the children of `container` slide into a new order when dragged
   by their handle — with a mouse, a trackpad or a finger.

   The row you hold lifts out and follows the pointer exactly. A gap the
   same size stays where it will land, and the rows around it glide out
   of the way. Move as far as you like in one motion; the page scrolls
   when you reach the top or bottom edge. Escape puts everything back.

   Movement is tracked on the whole window rather than the handle, so a
   row shifting under the pointer can never drop the drag. */
function makeSortable(container, itemSelector, onOrder) {
  const EASE = 'cubic-bezier(.2, .8, .2, 1)';
  const members = () => Array.prototype.filter.call(container.children, (n) => n.matches(itemSelector));
  const ids = () => members().map((n) => n.dataset.id);

  container.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('.hub-grip');
    if (!grip || !container.contains(grip) || e.button > 0) return;
    const node = grip.closest(itemSelector);
    if (!node || node.parentElement !== container) return;
    e.preventDefault();

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const glide = calm ? 'none' : 'transform 220ms ' + EASE;
    const startOrder = ids().join('|');
    const start = node.getBoundingClientRect();
    const grabOffset = e.clientY - start.top;
    let pointerY = e.clientY;
    let active = true;
    let frame = 0;

    /* The gap the row will land in. */
    const gap = document.createElement('div');
    gap.className = 'sort-gap';
    gap.style.height = start.height + 'px';
    const originalNext = node.nextSibling;
    container.insertBefore(gap, node);

    /* Lift the row out of the flow, exactly where it was. */
    container.classList.add('is-sorting');
    document.documentElement.classList.add('is-dragging-something');
    node.classList.add('is-dragging');
    Object.assign(node.style, {
      position: 'fixed', left: start.left + 'px', top: start.top + 'px',
      width: start.width + 'px', height: start.height + 'px',
      margin: '0', zIndex: '70', pointerEvents: 'none', transition: 'none',
      transform: 'translate3d(0, 0, 0)'
    });

    const others = () => members().filter((n) => n !== node);

    /* Slide the gap to where the pointer is, animating everything that
       moves because of it (First, Last, Invert, Play). */
    function placeGap() {
      const siblings = others();
      const box = container.getBoundingClientRect();
      const y = pointerY - box.top;

      let target = null;
      for (const s of siblings) {
        if (y < s.offsetTop + s.offsetHeight / 2) { target = s; break; }
      }
      let next = gap.nextElementSibling;
      if (next === node) next = next.nextElementSibling;          // the lifted row is not a neighbour
      if (target ? next === target : next === null) return;       // the gap is already there

      const firstTops = new Map(siblings.map((s) => [s, s.getBoundingClientRect().top]));
      if (target) container.insertBefore(gap, target);
      else container.appendChild(gap);

      const newBox = container.getBoundingClientRect();
      siblings.forEach((s) => {
        const delta = firstTops.get(s) - (newBox.top + s.offsetTop);
        if (Math.abs(delta) < 0.5) return;
        s.style.transition = 'none';
        s.style.transform = 'translate3d(0, ' + delta + 'px, 0)';
        s.getBoundingClientRect();                       // commit the starting point
        s.style.transition = glide;
        s.style.transform = '';
      });
    }

    function tick() {
      if (!active) return;

      /* Scroll when the pointer nears the top or bottom of the window. */
      const edge = 90;
      if (pointerY < edge) window.scrollBy(0, -Math.ceil((edge - pointerY) / 6));
      else if (pointerY > window.innerHeight - edge) window.scrollBy(0, Math.ceil((pointerY - (window.innerHeight - edge)) / 6));

      node.style.transform = 'translate3d(0, ' + (pointerY - grabOffset - start.top) + 'px, 0)';
      placeGap();
      frame = requestAnimationFrame(tick);
    }

    const onMove = (ev) => { pointerY = ev.clientY; };
    const onKey = (ev) => {
      if (ev.key !== 'Escape') return;
      container.insertBefore(gap, originalNext && originalNext.parentNode === container ? originalNext : null);
      finish(true);
    };

    function finish(cancelled) {
      if (!active) return;
      active = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey, true);

      /* Settle into the gap, then hand the row back to the page. */
      const land = gap.getBoundingClientRect();
      node.style.transition = calm ? 'none' : 'transform 200ms ' + EASE;
      node.style.transform = 'translate3d(0, ' + (land.top - start.top) + 'px, 0)';

      const done = () => {
        container.insertBefore(node, gap);
        gap.remove();
        ['position', 'left', 'top', 'width', 'height', 'margin', 'zIndex', 'pointerEvents', 'transition', 'transform']
          .forEach((k) => { node.style[k] = ''; });
        members().forEach((s) => { s.style.transition = ''; s.style.transform = ''; });
        node.classList.remove('is-dragging');
        container.classList.remove('is-sorting');
        document.documentElement.classList.remove('is-dragging-something');
        const endOrder = ids();
        if (!cancelled && endOrder.join('|') !== startOrder) onOrder(endOrder, node.dataset.id);
      };
      if (calm) done(); else setTimeout(done, 210);
    }

    const onUp = () => finish(false);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey, true);
    frame = requestAnimationFrame(tick);
  });

  /* Keyboard: focus a handle, then the arrow keys move that row. */
  container.addEventListener('keydown', (e) => {
    const grip = e.target.closest('.hub-grip');
    if (!grip || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const node = grip.closest(itemSelector);
    const order = ids();
    const at = order.indexOf(node.dataset.id);
    const to = at + (e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= order.length) return;
    e.preventDefault();
    order.splice(to, 0, order.splice(at, 1)[0]);
    onOrder(order, node.dataset.id, true);
  });
}

/* Puts a list back in the order the ids now say. */
function reorderBy(list, order) {
  const byId = new Map(list.map((x) => [x.id, x]));
  const next = order.map((id) => byId.get(id)).filter(Boolean);
  list.forEach((x) => { if (next.indexOf(x) === -1) next.push(x); });
  return next;
}

let hubGripFocusId = '';

let hubFocusId = '';

/* Highlighted notes come in a few colours; yellow when none is chosen. */
const NOTE_COLORS = [
  { value: 'yellow', label: 'Yellow' },
  { value: 'blue',   label: 'Blue' },
  { value: 'green',  label: 'Green' },
  { value: 'red',    label: 'Red' },
  { value: 'purple', label: 'Purple' },
  { value: 'gray',   label: 'Grey' }
];
const noteColor = (item) => (NOTE_COLORS.some((c) => c.value === item.color) ? item.color : 'yellow');

function noteColorPicker(item, onChange) {
  const wrap = el('div', 'hub-note-colors');
  wrap.setAttribute('role', 'radiogroup');
  wrap.setAttribute('aria-label', 'Note colour');
  NOTE_COLORS.forEach((c) => {
    const dot = el('button', 'hub-note-dot is-' + c.value + (noteColor(item) === c.value ? ' is-on' : ''));
    dot.type = 'button';
    dot.title = c.label;
    dot.setAttribute('role', 'radio');
    dot.setAttribute('aria-checked', String(noteColor(item) === c.value));
    dot.setAttribute('aria-label', c.label);
    dot.addEventListener('click', () => {
      item.color = c.value;
      wrap.querySelectorAll('.hub-note-dot').forEach((d) => {
        const on = d === dot;
        d.classList.toggle('is-on', on);
        d.setAttribute('aria-checked', String(on));
      });
      onChange(c.value);
    });
    wrap.appendChild(dot);
  });
  return wrap;
}

function editItem(section, item, index) {
  const owner = isHubOwner();
  const editable = canEditHubItem(item);
  const box = el('div', 'hub-edit');

  box.dataset.item = item.id;
  box.dataset.id = item.id;

  if (!editable) {
    const shown = readItem(item) || el('p', 'hub-empty-value', item.label + ' — not filled in yet');
    box.appendChild(shown);
    const why = item.type === 'offername'
      ? 'Change the offer name at the top of Add Team.'
      : 'Shared by every offer — changed by the owner, or an admin with every offer.';
    box.appendChild(el('p', 'hub-locked', why));
    box.classList.add('is-locked');
    if (owner) {                                                // the owner can still move it
      box.insertBefore(dragHandle(item.label), box.firstChild);
      const foot = el('div', 'hub-edit-foot');
      foot.appendChild(addBelowControl(section, index));
      box.appendChild(foot);
    }
    return box;
  }

  /* Owner-only controls: what the row is, and where it applies. */
  if (owner) {
    const controls = el('div', 'hub-edit-controls');
    controls.appendChild(dragHandle(item.label));

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

    if (item.type === 'note') {
      controls.appendChild(noteColorPicker(item, (color) => {
        const preview = box.querySelector('.hub-edit-value');
        if (preview) NOTE_COLORS.forEach((c) => preview.classList.toggle('is-' + c.value, c.value === color));
        saveTemplateSoon();
      }));
    }

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

  if (item.type === 'item') {
    box.appendChild(linksEditor(item));
  } else if (item.type !== 'heading') {
    const long = item.type === 'text' || item.type === 'note';
    const input = document.createElement(long ? 'textarea' : 'input');
    if (!long) input.type = 'text';
    if (long) input.rows = Math.min(10, Math.max(3, Math.ceil(hubValue(item).length / 90)));
    input.className = 'hub-edit-value' + (item.type === 'note' ? ' hub-note-edit is-' + noteColor(item) : '');
    input.placeholder = item.type === 'video' ? 'Paste a Loom or YouTube link'
      : long ? 'Write it here…' : 'Paste a link, or type the text';
    input.value = hubValue(item);
    input.setAttribute('aria-label', item.label || 'Value');
    input.addEventListener('change', () => saveHubValue(item, input.value.trim()));
    box.appendChild(input);
  }

  /* One quiet footer line: where this row applies, and adding below it. */
  if (owner) {
    const foot = el('div', 'hub-edit-foot');
    if (item.type !== 'heading') {
      foot.appendChild(el('p', 'hub-scope-note', item.scope === 'offer'
        ? 'This offer only — each offer fills in its own.'
        : 'All offers — shows on every offer.'));
    }
    foot.appendChild(addBelowControl(section, index));
    box.appendChild(foot);
  }
  return box;
}

/* One box per link, and "+ Add another link" for the next. */
function linksEditor(item) {
  const wrap = el('div', 'hub-links-edit');

  const save = () => {
    const joined = Array.prototype.map.call(wrap.querySelectorAll('.hub-edit-value'), (i) => i.value.trim())
      .filter(Boolean).join('\n');
    saveHubValue(item, joined);
  };

  const add = el('button', 'link-btn hub-add-link', '+ Add another link');
  add.type = 'button';

  const paintRemovers = () => {
    const lines = wrap.querySelectorAll('.hub-link-line');
    lines.forEach((line) => { line.querySelector('.hub-line-remove').hidden = lines.length === 1; });
  };

  const addLine = (value, focus) => {
    const line = el('div', 'hub-link-line');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'hub-edit-value';
    input.placeholder = 'Paste a link, or type the text';
    input.value = value;
    input.setAttribute('aria-label', (item.label || 'Row') + ' link');
    input.addEventListener('change', save);
    line.appendChild(input);

    const remove = el('button', 'hub-line-remove', '×');
    remove.type = 'button';
    remove.title = 'Remove this link';
    remove.setAttribute('aria-label', 'Remove this link');
    remove.addEventListener('click', () => {
      line.remove();
      paintRemovers();
      save();
    });
    line.appendChild(remove);

    wrap.insertBefore(line, add);
    paintRemovers();
    if (focus) input.focus();
  };

  add.addEventListener('click', () => addLine('', true));
  wrap.appendChild(add);

  const values = splitValues(hubValue(item));
  (values.length ? values : ['']).forEach((v) => addLine(v, false));
  return wrap;
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
  const sortingSections = hubEditing && owner;
  const navList = el('div', 'hub-nav-list');
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

    if (sortingSections) {
      const rowEl = el('div', 'hub-nav-row');
      rowEl.dataset.id = s.id;
      rowEl.appendChild(dragHandle(s.title));
      rowEl.appendChild(b);
      navList.appendChild(rowEl);
    } else {
      navList.appendChild(b);
    }
  });
  nav.appendChild(navList);

  if (sortingSections) {
    makeSortable(navList, '.hub-nav-row', (order, movedId, byKeyboard) => {
      CACHE.repHub.sections = reorderBy(CACHE.repHub.sections, order);
      if (byKeyboard) hubGripFocusId = 'nav:' + movedId;
      saveTemplateSoon();
      renderRepHub();
    });
  }

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
    makeSortable(list, '.hub-edit', (order, movedId, byKeyboard) => {
      section.items = reorderBy(section.items, order);
      if (byKeyboard) hubGripFocusId = movedId;
      saveTemplateSoon();
      renderRepHub();
    });
  }

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

  /* Keyboard reordering keeps the focus on the handle that was moved. */
  if (hubGripFocusId) {
    const scope = hubGripFocusId.indexOf('nav:') === 0 ? nav : content;
    const id = hubGripFocusId.replace(/^nav:/, '');
    hubGripFocusId = '';
    const holder = scope.querySelector('[data-id="' + id + '"]');
    const grip = holder && holder.querySelector('.hub-grip');
    if (grip) grip.focus();
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
