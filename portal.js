/* ============================================================
   portal.js — the portal (/)
   ------------------------------------------------------------
   The front door for the owner and admins: one card per section of
   the company. Each section lives at its own address under the
   portal, so one sign-in opens all of them.

   Adding a section later is one entry in PORTAL_SECTIONS plus its
   own page.
   ============================================================ */

const PORTAL_SECTIONS = [
  {
    id: 'sales',
    title: 'Sales Team Boards',
    blurb: 'Performance, post-call forms, call data and rep hubs for every offer.',
    href: () => SALES_PATH,
    stats: () => {
      const m = computeMetrics(CACHE.allCalls.map((r) => r.record), rangeFor('mtd'));
      const offers = CACHE.boards.length;
      return [
        ['Offers', int(offers)],
        ['Cash this month', money(m.totalCash)],
        ['Deals this month', int(m.deals)]
      ];
    }
  }
];

function greeting() {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const first = String(CACHE.me.name || '').trim().split(/\s+/)[0];
  return first ? part + ', ' + first : part;
}

function renderPortal() {
  $('#portalGreeting').textContent = greeting();

  const host = $('#portalSections');
  host.textContent = '';

  PORTAL_SECTIONS.forEach((s) => {
    const card = el('a', 'portal-card');
    card.href = s.href();

    const head = el('div', 'portal-card-head');
    head.appendChild(el('h2', 'portal-card-title', s.title));
    head.appendChild(el('span', 'portal-card-arrow', '&rarr;'));
    card.appendChild(head);
    card.appendChild(el('p', 'portal-card-blurb', s.blurb));

    const stats = el('div', 'portal-card-stats');
    s.stats().forEach((pair) => {
      const cell = el('div', 'hub-stat');
      cell.appendChild(el('div', 'hub-stat-label', pair[0]));
      cell.appendChild(el('div', 'hub-stat-value', pair[1]));
      stats.appendChild(cell);
    });
    card.appendChild(stats);

    host.appendChild(card);
  });
}

function initPortal() {
  /* Quietly keep team login names and offer addresses up to date. */
  if (CACHE.me.isOwner) serverAction('/api/boards', { action: 'names' }).catch(() => {});
  renderPortal();
}
