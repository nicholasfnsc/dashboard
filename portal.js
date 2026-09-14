/* ============================================================
   portal.js — the portal (/)
   ------------------------------------------------------------
   The front door for the owner and admins: the agency's revenue,
   the signal list, and one card per section of the company. Each
   section lives at its own address under the portal, so one sign-in
   opens all of them.

   Adding a section is one entry in PORTAL_SECTIONS. A section with
   no `href` yet shows as coming soon.
   ============================================================ */

const PORTAL_ICONS = {
  revenue: '<path d="M12 3v18"/><path d="M16.5 7.5c0-1.9-2-3-4.5-3s-4.5 1.2-4.5 3.2c0 4.6 9 2.4 9 7.1 0 2-2 3.2-4.5 3.2s-4.5-1.1-4.5-3"/>',
  signal:  '<path d="M4 20V14"/><path d="M9 20V10"/><path d="M14 20V6"/><path d="M19 20V3"/>',
  sales:   '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>',
  metrics: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 16v-4"/><path d="M12 16V8"/><path d="M16 16v-6"/>',
  funnel:  '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
  content: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18"/><path d="M8 2v4"/><path d="M16 2v4"/>',
  access:  '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M17 4.5a3.5 3.5 0 0 1 0 7"/><path d="M19 14.8c1.4.9 2.2 2.6 2.5 5.2"/>'
};

const PORTAL_SECTIONS = [
  { id: 'sales',   title: 'Sales Team Boards',          icon: 'sales',   href: () => SALES_PATH,
    blurb: 'Every offer’s dashboard, post-call form, call data and rep hub.' },
  { id: 'metrics', title: 'Metrics Tracking',           icon: 'metrics', href: () => METRICS_PATH,
    blurb: 'Every funnel metric for each offer, synced with the sales boards.' },
  { id: 'funnel',  title: 'Funnel Revenue Projections', icon: 'funnel',
    blurb: 'Projected revenue at every stage of the funnel.' },
  { id: 'content', title: 'Weekly Content Hub',         icon: 'content',
    blurb: 'The weekly content plan, board and content bank.' }
];

function portalIcon(name) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    PORTAL_ICONS[name] + '</svg>';
}

/* "Welcome back, Mr. Fonseca." for the owner; admins by first name. */
function greeting() {
  const words = String(CACHE.me.name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'Welcome back.';
  if (CACHE.me.isOwner && words.length > 1) return 'Welcome back, Mr. ' + words[words.length - 1] + '.';
  return 'Welcome back, ' + words[0] + '.';
}

function portalCard(opts) {
  const card = el(opts.href ? 'a' : 'div', 'portal-card' + (opts.wide ? ' is-wide' : '') + (opts.href ? '' : ' is-soon'));
  if (opts.href) card.href = opts.href;

  const head = el('div', 'portal-card-head');
  head.appendChild(el('h2', 'portal-card-title', opts.title));
  head.appendChild(el('span', 'portal-icon', portalIcon(opts.icon)));
  card.appendChild(head);

  if (opts.body) card.appendChild(opts.body);

  const foot = el('div', 'portal-card-foot');
  foot.appendChild(el('span', null, opts.foot || (opts.href ? 'Open' : 'Coming soon')));
  if (opts.href) foot.appendChild(el('span', 'portal-arrow', '&#8599;'));
  card.appendChild(foot);
  return card;
}

function renderPortal() {
  $('#portalGreeting').textContent = greeting();
  $('#portalDate').textContent = TODAY.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const host = $('#portalSections');
  host.textContent = '';

  /* Total revenue generated — every offer this person can see, all time.
     Sales data, so it shows to those with the sales boards or metrics. */
  if (canUse('sales') || canUse('metrics')) {
    const rows = CACHE.allCalls.map((r) => r.record);
    const all = computeMetrics(rows, rangeFor('all'));
    const month = computeMetrics(rows, rangeFor('mtd'));
    const revenue = el('div', 'portal-revenue');
    revenue.appendChild(el('div', 'portal-revenue-value', money(all.totalRevenue)));
    const facts = el('div', 'portal-revenue-facts');
    [
      [money(all.totalCash), 'cash collected'],
      [money(month.totalRevenue), 'revenue this month'],
      [int(all.deals), all.deals === 1 ? 'deal closed' : 'deals closed']
    ].forEach((f) => {
      const s = el('span', 'portal-fact');
      s.appendChild(el('b', null, f[0]));
      s.appendChild(document.createTextNode(' ' + f[1]));
      facts.appendChild(s);
    });
    revenue.appendChild(facts);
    host.appendChild(portalCard({
      title: 'Total Revenue Generated', icon: 'revenue', wide: true, body: revenue,
      href: canUse('sales') ? SALES_PATH : '', foot: (CACHE.me.isOwner || CACHE.me.allOffers ? 'All offers' : 'Your offers') + ' · all time'
    }));
  }

  /* Signal List */
  if (canUse('signal')) {
    host.appendChild(portalCard({
      title: 'Signal List', icon: 'signal',
      body: el('p', 'portal-card-blurb', 'Nothing flagged right now.')
    }));
  }

  PORTAL_SECTIONS.filter((s) => canUse(s.id)).forEach((s) => {
    host.appendChild(portalCard({
      title: s.title, icon: s.icon, href: s.href ? s.href() : '',
      body: el('p', 'portal-card-blurb', s.blurb)
    }));
  });

  if (CACHE.me.isOwner) {
    host.appendChild(portalCard({
      title: 'Team &amp; Access', icon: 'access', href: ACCESS_PATH,
      body: el('p', 'portal-card-blurb', 'Invite admins and choose which sections and offers each one can use.')
    }));
  }

  if (!host.children.length) {
    host.appendChild(el('p', 'hub-empty', 'Nothing has been shared with you yet. Ask the owner for access.'));
  }
}

function initPortal() {
  /* Quietly keep team login names and offer addresses up to date. */
  if (CACHE.me.isOwner) serverAction('/api/boards', { action: 'names' }).catch(() => {});
  renderPortal();
}
