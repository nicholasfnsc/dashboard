/* ============================================================
   projections.js — Funnel Revenue Projections (/projections)
   ------------------------------------------------------------
   Model a funnel from ad spend to revenue. Every figure comes from a
   handful of inputs — ad spend, cost per click, each stage's rate,
   AOV — so any box can be edited and the rest cascades:

     edit a rate    → every count after it follows
     edit a count   → the rate beside it is worked out backwards

   A what-if calculator, not tied to any offer or its data. The
   industry standard under a rate is a reference, edited by clicking
   it. Numbers are remembered in this browser.
   ============================================================ */

const PROJECTIONS_PATH = '/projections';

const PV = { funnel: 'vsl', model: null, saveTimer: 0, boxes: {} };

/* ---------- the two funnels ----------
   inputs    starting numbers (rates are percents)
   std       industry standards, shown under rates
   compute   every figure on the page from the inputs
   sections  what is shown, in order                              */
const div = (a, b) => (b > 0 && Number.isFinite(a) ? a / b : null);
const pctOf = (v) => (v == null ? 0 : v / 100);

const PROJECTION_MODELS = {
  vsl: {
    inputs: {
      spend: 10000, cpc: 2.5, ctr: 2, hook: 35,
      connect: 90, play: 60, engage: 50, clickApp: 40, completion: 70,
      dials: 80, booking: 25, show: 70,
      dq: 15, close: 30, aov: 3000, deposits: 20000, cash: 22000
    },
    std: { cpc: 2, ctr: 2, hook: 40, connect: 80, engage: 40, completion: 50, booking: 80, show: 80, dq: 15, close: 60 },
    compute(i) {
      const v = {};
      v.clicks = div(i.spend, i.cpc);
      v.visits = v.clicks == null ? null : v.clicks * pctOf(i.connect);
      v.plays = v.visits == null ? null : v.visits * pctOf(i.play);
      v.engaged = v.plays == null ? null : v.plays * pctOf(i.engage);
      v.starts = v.engaged == null ? null : v.engaged * pctOf(i.clickApp);
      v.apps = v.starts == null ? null : v.starts * pctOf(i.completion);
      v.leads = v.apps;
      v.cpl = div(i.spend, v.leads);
      v.calendar = v.apps == null ? null : v.apps * pctOf(i.booking);
      v.cpbc = div(i.spend, v.calendar);
      v.leadBooking = v.leads ? (v.calendar / v.leads) * 100 : null;
      v.shows = v.calendar == null ? null : v.calendar * pctOf(i.show);
      v.dqd = v.shows == null ? null : v.shows * pctOf(i.dq);
      v.qualified = v.shows == null ? null : v.shows - v.dqd;
      v.units = v.qualified == null ? null : v.qualified * pctOf(i.close);
      v.tcv = v.units == null ? null : v.units * (i.aov || 0);
      v.cashPerQualified = div(i.cash, v.qualified);
      v.clickSale = v.clicks ? (v.units / v.clicks) * 100 : null;
      v.leadSale = v.leads ? (v.units / v.leads) * 100 : null;
      v.breakEven = div(i.spend, v.units);
      v.earnClick = div(i.cash, v.clicks);
      v.earnLead = div(i.cash, v.leads);
      v.earnBooked = div(i.cash, v.calendar);
      v.profit = (i.cash || 0) - (i.spend || 0);
      v.roas = div(i.cash, i.spend);
      return v;
    },
    /* A count typed in → the input that produces it. */
    inverse: {
      clicks: (n, i) => ({ cpc: div(i.spend, n) }),
      visits: (n, i, v) => ({ connect: div(n, v.clicks) * 100 }),
      plays: (n, i, v) => ({ play: div(n, v.visits) * 100 }),
      engaged: (n, i, v) => ({ engage: div(n, v.plays) * 100 }),
      starts: (n, i, v) => ({ clickApp: div(n, v.engaged) * 100 }),
      apps: (n, i, v) => ({ completion: div(n, v.starts) * 100 }),
      calendar: (n, i, v) => ({ booking: div(n, v.apps) * 100 }),
      shows: (n, i, v) => ({ show: div(n, v.calendar) * 100 }),
      dqd: (n, i, v) => ({ dq: div(n, v.shows) * 100 }),
      units: (n, i, v) => ({ close: div(n, v.qualified) * 100 })
    },
    sections: [
      { title: 'Front-End Awareness', icon: 'eye', foot: 'Top-of-funnel numbers at a glance', rows: [
        { type: 'input', key: 'spend', label: 'Ad Spend', unit: 'money', big: true },
        { type: 'pair', count: 'clicks', countLabel: 'Clicks', rate: 'cpc', rateLabel: 'Cost Per Click', rateUnit: 'money', hint: 'Ad Spend ÷ Cost Per Click' },
        { type: 'refs', items: [{ key: 'ctr', label: 'CTR (Link)', unit: 'percent' }, { key: 'hook', label: 'Hook Rate', unit: 'percent' }], hint: 'Reference only — tracked in your ad platform, not used in the maths here' },
        { type: 'pair', count: 'leads', countLabel: 'Leads', rate: 'cpl', rateLabel: 'Cost Per Lead', rateUnit: 'money', readonly: true, hint: '= Applications Submitted' },
        { type: 'pair', count: 'calendar', countLabel: 'Booked Calls', rate: 'cpbc', rateLabel: 'Cost Per Booked Call', rateUnit: 'money', readonly: true, hint: '= Total Calls on Calendar' },
        { type: 'derived', key: 'leadBooking', label: 'Lead → Booking Rate', unit: 'percent', hint: 'Booked Calls ÷ Leads' }
      ] },
      { title: 'Funnel Conversions', icon: 'funnel', foot: 'Clicks to submitted applications (leads)', rows: [
        { type: 'pair', count: 'visits', countLabel: 'VSL Page Visits', rate: 'connect', rateLabel: 'Landing Page Connect Rate', hint: 'Clicks × Connect Rate' },
        { type: 'pair', count: 'plays', countLabel: 'VSL Plays', rate: 'play', rateLabel: 'VSL Play Rate', hint: 'Page Visits × Play Rate' },
        { type: 'pair', count: 'engaged', countLabel: 'Engaged Viewers', rate: 'engage', rateLabel: 'VSL Engagement Rate', hint: 'VSL Plays × Engagement Rate' },
        { type: 'pair', count: 'starts', countLabel: 'Application Starts', rate: 'clickApp', rateLabel: 'Click → Application Rate', hint: 'Engaged Viewers × Click → Application Rate' },
        { type: 'pair', count: 'apps', countLabel: 'Applications Submitted', rate: 'completion', rateLabel: 'Application Completion Rate', hint: 'Application Starts × Completion Rate' }
      ] },
      { title: 'Setting', icon: 'calendar', foot: 'Booking calls and getting them to show', rows: [
        { type: 'input', key: 'dials', label: 'Dials', unit: 'count', hint: 'Reference only' },
        { type: 'pair', count: 'calendar', countLabel: 'Total Calls on Calendar', rate: 'booking', rateLabel: 'Application → Booking Rate', hint: 'Applications Submitted × Booking Rate' },
        { type: 'pair', count: 'shows', countLabel: 'Total Calls Show', rate: 'show', rateLabel: 'Show Rate', hint: 'Calls on Calendar × Show Rate' }
      ] },
      { title: 'Closing', icon: 'check', foot: 'Qualifying, closing and cash collected', rows: [
        { type: 'pair', count: 'dqd', countLabel: 'DQ’d Calls', rate: 'dq', rateLabel: 'Closing DQ Rate', lowerIsBetter: true, hint: 'Calls Show × DQ Rate' },
        { type: 'derived', key: 'qualified', label: 'Qualified Calls', unit: 'count', hint: 'Calls Show − DQ’d Calls' },
        { type: 'pair', count: 'units', countLabel: 'Units Sold', rate: 'close', rateLabel: 'Close Rate', hint: 'Qualified Calls × Close Rate' },
        { type: 'input', key: 'aov', label: 'AOV (Average Order Value)', unit: 'money' },
        { type: 'derived', key: 'tcv', label: 'Total Contract Value', unit: 'money', hint: 'Units Sold × AOV' },
        { type: 'input', key: 'deposits', label: 'Deposits', unit: 'money', hint: 'Enter manually' },
        { type: 'input', key: 'cash', label: 'Cash Collected', unit: 'money', hint: 'Received to date' },
        { type: 'derived', key: 'cashPerQualified', label: 'Cash Per Qualified Live Call', unit: 'money', hint: 'Cash Collected ÷ Qualified Calls' }
      ] }
    ],
    summary: [
      { title: 'Your conversion rates', rows: [['Click → Sale', 'clickSale', 'percent2'], ['Lead → Sale', 'leadSale', 'percent2'], ['Break-Even AOV', 'breakEven', 'money']] },
      { title: 'Your earnings', hero: ['Total Contract Value', 'tcv'], rows: [['Earning Per Click', 'earnClick', 'money'], ['Earning Per Lead', 'earnLead', 'money'], ['Earning Per Booked Call', 'earnBooked', 'money']], note: 'Earnings use Cash Collected' },
      { title: 'Profitability', profit: true, rows: [['Profit', 'profit', 'profit'], ['ROAS', 'roas', 'roas']], note: 'Cash Collected − Ad Spend' }
    ]
  },

  webinar: {
    inputs: { spend: 10000, cpc: 2.3, optin: 23, showWeb: 30, retention: 50, apply: 20, showCall: 70, close: 30, aov: 2000 },
    std: { cpc: 2, optin: 20, cpl: 8.5, showWeb: 30, retention: 80, apply: 30, showCall: 80, close: 50 },
    compute(i) {
      const v = {};
      v.clicks = div(i.spend, i.cpc);
      v.registrants = v.clicks == null ? null : v.clicks * pctOf(i.optin);
      v.cpl = div(i.spend, v.registrants);
      v.attendees = v.registrants == null ? null : v.registrants * pctOf(i.showWeb);
      v.cpa = div(i.spend, v.attendees);
      v.retained = v.attendees == null ? null : v.attendees * pctOf(i.retention);
      v.booked = v.retained == null ? null : v.retained * pctOf(i.apply);
      v.cpbc = div(i.spend, v.booked);
      v.shown = v.booked == null ? null : v.booked * pctOf(i.showCall);
      v.cpsc = div(i.spend, v.shown);
      v.deals = v.shown == null ? null : v.shown * pctOf(i.close);
      v.cpd = div(i.spend, v.deals);
      v.revenue = v.deals == null ? null : v.deals * (i.aov || 0);
      v.clickSale = v.clicks ? (v.deals / v.clicks) * 100 : null;
      v.leadSale = v.registrants ? (v.deals / v.registrants) * 100 : null;
      v.breakEven = div(i.spend, v.deals);
      v.earnClick = div(v.revenue, v.clicks);
      v.earnLead = div(v.revenue, v.registrants);
      v.earnAttendee = div(v.revenue, v.attendees);
      v.profit = (v.revenue || 0) - (i.spend || 0);
      v.roas = div(v.revenue, i.spend);
      return v;
    },
    inverse: {
      clicks: (n, i) => ({ cpc: div(i.spend, n) }),
      registrants: (n, i, v) => ({ optin: div(n, v.clicks) * 100 }),
      attendees: (n, i, v) => ({ showWeb: div(n, v.registrants) * 100 }),
      retained: (n, i, v) => ({ retention: div(n, v.attendees) * 100 }),
      booked: (n, i, v) => ({ apply: div(n, v.retained) * 100 }),
      shown: (n, i, v) => ({ showCall: div(n, v.booked) * 100 }),
      deals: (n, i, v) => ({ close: div(n, v.shown) * 100 })
    },
    sections: [
      { title: 'Pre-Webinar', icon: 'trend', foot: 'Ad spend, clicks and registrants', rows: [
        { type: 'input', key: 'spend', label: 'Ad Spend', unit: 'money', big: true },
        { type: 'pair', count: 'clicks', countLabel: 'Clicks', rate: 'cpc', rateLabel: 'Cost Per Click', rateUnit: 'money', lowerIsBetter: true, hint: 'Ad Spend ÷ Cost Per Click' },
        { type: 'pair', count: 'registrants', countLabel: 'Registrants / Leads', rate: 'optin', rateLabel: 'Opt-In Rate', hint: 'Clicks × Opt-In Rate' },
        { type: 'derived', key: 'cpl', label: 'Cost Per Lead', unit: 'money', hint: 'Ad Spend ÷ Registrants', std: 'cpl', lowerIsBetter: true }
      ] },
      { title: 'Webinar Conversion', icon: 'video', foot: 'Show-up and retention', rows: [
        { type: 'pair', count: 'attendees', countLabel: 'Attendees', rate: 'showWeb', rateLabel: 'Show Rate to Webinar', hint: 'Registrants × Show Rate' },
        { type: 'derived', key: 'cpa', label: 'Cost Per Attendee', unit: 'money', hint: 'Ad Spend ÷ Attendees' },
        { type: 'pair', count: 'retained', countLabel: 'Retained Attendees', rate: 'retention', rateLabel: 'Retention Rate', hint: 'Attendees × Retention Rate' }
      ] },
      { title: 'Sales Conversion', icon: 'dollar', foot: 'Calls, closes and revenue', rows: [
        { type: 'pair', count: 'booked', countLabel: 'Calls Booked', rate: 'apply', rateLabel: 'Apply / Book Rate', hint: 'Retained × Apply Rate' },
        { type: 'derived', key: 'cpbc', label: 'Cost Per Booked Call', unit: 'money', hint: 'Ad Spend ÷ Calls Booked' },
        { type: 'pair', count: 'shown', countLabel: 'Calls Shown', rate: 'showCall', rateLabel: 'Show Rate to Call', hint: 'Calls Booked × Show Rate' },
        { type: 'derived', key: 'cpsc', label: 'Cost Per Shown Call', unit: 'money', hint: 'Ad Spend ÷ Calls Shown' },
        { type: 'pair', count: 'deals', countLabel: 'Deals Closed', rate: 'close', rateLabel: 'Close Rate', hint: 'Calls Shown × Close Rate' },
        { type: 'derived', key: 'cpd', label: 'Cost Per Deal', unit: 'money', hint: 'Ad Spend ÷ Deals Closed' },
        { type: 'input', key: 'aov', label: 'AOV (Average Order Value)', unit: 'money' }
      ] }
    ],
    summary: [
      { title: 'Your conversion rates', rows: [['Click → Sale', 'clickSale', 'percent2'], ['Lead → Sale', 'leadSale', 'percent2'], ['Break-Even AOV', 'breakEven', 'money']] },
      { title: 'Your earnings', hero: ['Total Revenue', 'revenue'], rows: [['Earning Per Click', 'earnClick', 'money'], ['Earning Per Lead', 'earnLead', 'money'], ['Earning Per Attendee', 'earnAttendee', 'money']] },
      { title: 'Profitability', profit: true, rows: [['Profit', 'profit', 'profit'], ['ROAS', 'roas', 'roas']], note: 'Total Revenue − Ad Spend' }
    ]
  }
};

/* ---------- formatting ---------- */
function projMoney(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  /* $2.50, $10.00, $1,587.30, $10,000 — cents below $1,000 always, above it only when there are any */
  const digits = abs < 1000 ? 2 : (abs >= 10000 || Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2);
  return (v < 0 ? '-$' : '$') + abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
/* People come in whole numbers, rounded up — the same as the model this page is based on. */
const projCount = (v) => (v == null || !Number.isFinite(v) ? '—' : Math.ceil(v - 1e-9).toLocaleString('en-US'));
const projPct = (v, d) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(d == null ? 1 : d));

function boxText(unit, v) {
  if (v == null || !Number.isFinite(v)) return '';
  if (unit === 'money') return projMoney(v).replace('$', '');
  if (unit === 'percent') return projPct(v);
  return projCount(v);
}

function parseProjection(text) {
  const clean = String(text).replace(/[$,%\s]/g, '');
  if (clean === '') return null;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/* ---------- remembered on this device ----------
   A what-if calculator, not tied to any offer: the numbers typed in
   are kept in this browser so they are still there next time. */
const projectionKey = (funnel) => 'ia-projections:' + funnel;

function savedModel(funnel) {
  try { return JSON.parse(localStorage.getItem(projectionKey(funnel))) || null; } catch (e) { return null; }
}

function currentModel(funnel) {
  const def = PROJECTION_MODELS[funnel];
  const saved = savedModel(funnel) || {};
  return {
    inputs: Object.assign({}, def.inputs, saved.inputs || {}),
    std: Object.assign({}, def.std, saved.std || {})
  };
}

function scheduleSave() {
  clearTimeout(PV.saveTimer);
  const funnel = PV.funnel;
  const model = JSON.stringify(PV.model);
  PV.saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(projectionKey(funnel), model);
      $('#projSaved').textContent = 'Saved on this device';
    } catch (e) {
      $('#projSaved').textContent = 'This browser isn’t keeping changes (private window?)';
    }
  }, 300);
}

/* ============================================================
   Build — once per funnel
   ============================================================ */
const PROJ_ICONS = {
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  funnel: '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18"/><path d="M8 2v4"/><path d="M16 2v4"/>',
  check: '<circle cx="12" cy="12" r="9"/><polyline points="8 12.5 11 15.5 16 9.5"/>',
  trend: '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
  dollar: '<path d="M12 3v18"/><path d="M16.5 7.5c0-1.9-2-3-4.5-3s-4.5 1.2-4.5 3.2c0 4.6 9 2.4 9 7.1 0 2-2 3.2-4.5 3.2s-4.5-1.1-4.5-3"/>'
};

function projIcon(name) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + PROJ_ICONS[name] + '</svg>';
}

/* One box. kind: 'input' (typed), 'count' (worked out, editable), 'readonly' */
function projBox(kind, unit, key, label) {
  const wrap = el('label', 'pbox is-' + kind + (unit === 'money' ? ' has-prefix' : ''));
  if (unit === 'money') wrap.appendChild(el('span', 'pbox-affix', '$'));
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', label);
  input.readOnly = kind === 'readonly';
  input.tabIndex = kind === 'readonly' ? -1 : 0;
  wrap.appendChild(input);
  if (unit === 'percent') wrap.appendChild(el('span', 'pbox-affix', '%'));
  PV.boxes[key] = { input, unit, kind };
  return { wrap, input };
}

function stdLine(rateKey, unit, lowerIsBetter) {
  const line = el('button', 'pstd');
  line.type = 'button';
  line.dataset.std = rateKey;
  line.dataset.unit = unit;
  line.title = 'Industry standard — click to change';
  line.addEventListener('click', () => editStd(line, rateKey, unit));
  if (lowerIsBetter) line.dataset.lower = '1';
  return line;
}

function editStd(line, key, unit) {
  const current = PV.model.std[key];
  const input = document.createElement('input');
  input.className = 'pstd-edit';
  input.inputMode = 'decimal';
  input.value = current == null ? '' : String(current);
  input.setAttribute('aria-label', 'Industry standard');
  line.replaceWith(input);
  input.focus();
  input.select();
  let finished = false;
  const done = (keep) => {
    if (finished) return;                 // Enter, then the blur it causes, run this only once
    finished = true;
    if (keep) {
      const n = parseProjection(input.value);
      if (n !== undefined) {
        if (n == null) delete PV.model.std[key]; else PV.model.std[key] = n;
        scheduleSave();
      }
    }
    input.replaceWith(line);
    paintProjections();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); done(true); }
    if (e.key === 'Escape') done(false);
  });
  input.addEventListener('blur', () => { if (input.isConnected) done(true); });
}

function buildProjections() {
  const def = PROJECTION_MODELS[PV.funnel];
  PV.model = currentModel(PV.funnel);
  PV.boxes = {};
  const host = $('#projSections');
  host.textContent = '';

  def.sections.forEach((section) => {
    const card = el('section', 'panel pcard');
    const head = el('div', 'pcard-head');
    head.appendChild(el('h2', 'pcard-title', section.title));
    head.appendChild(el('span', 'portal-icon', projIcon(section.icon)));
    card.appendChild(head);

    section.rows.forEach((row) => {
      const r = el('div', 'prow prow-' + row.type);

      if (row.type === 'input' || row.type === 'derived') {
        r.appendChild(el('span', 'prow-label' + (row.big ? ' is-big' : ''), row.label));
        const side = el('div', 'prow-side');
        if (row.std) side.appendChild(stdLine(row.std, row.unit, row.lowerIsBetter));
        if (row.hint) side.appendChild(el('span', 'phint', row.hint));
        const box = projBox(row.type === 'input' ? 'input' : 'readonly', row.unit, row.key + (row.type === 'derived' ? '@v' : '@i'), row.label);
        if (row.type === 'input') wireInput(box.input, row.key);
        side.appendChild(box.wrap);
        r.appendChild(side);
      }

      if (row.type === 'pair') {
        const countCol = el('div', 'pcol');
        countCol.appendChild(el('span', 'pcol-label', row.countLabel));
        const countBox = projBox(row.readonly ? 'readonly' : 'count', 'count', row.count + '@v#' + row.rate, row.countLabel);
        if (!row.readonly) wireCount(countBox.input, row.count);
        countCol.appendChild(countBox.wrap);
        countCol.appendChild(el('span', 'phint', row.hint));
        r.appendChild(countCol);

        r.appendChild(el('span', 'pswap', '&#8644;'));

        const rateCol = el('div', 'pcol');
        rateCol.appendChild(el('span', 'pcol-label', row.rateLabel));
        const unit = row.rateUnit || 'percent';
        const rateBox = row.readonly
          ? projBox('readonly', unit, row.rate + '@v', row.rateLabel)
          : projBox('input', unit, row.rate + '@i', row.rateLabel);
        if (!row.readonly) wireInput(rateBox.input, row.rate);
        rateCol.appendChild(rateBox.wrap);
        if (!row.readonly) rateCol.appendChild(stdLine(row.rate, unit, row.lowerIsBetter || unit === 'money'));
        r.appendChild(rateCol);
      }

      if (row.type === 'refs') {
        const pair = el('div', 'prefs');
        row.items.forEach((item, idx) => {
          const col = el('div', 'pcol');
          col.appendChild(el('span', 'pcol-label', item.label));
          const box = projBox('input', item.unit, item.key + '@i', item.label);
          wireInput(box.input, item.key);
          col.appendChild(box.wrap);
          col.appendChild(stdLine(item.key, item.unit));
          pair.appendChild(col);
          if (idx === 0) pair.appendChild(el('span', 'pswap is-dot', '·'));
        });
        r.appendChild(pair);
        r.appendChild(el('span', 'phint prefs-hint', row.hint));
      }

      card.appendChild(r);
    });

    const foot = el('div', 'pcard-foot');
    foot.appendChild(el('span', null, section.foot));
    foot.appendChild(el('span', 'plive', 'Live'));
    card.appendChild(foot);
    host.appendChild(card);
  });

  const summary = el('section', 'psummary');
  def.summary.forEach((col) => {
    const c = el('div', 'psum-col');
    c.appendChild(el('h3', 'psum-title', col.title));
    if (col.hero) {
      const hero = el('div', 'psum-hero');
      hero.appendChild(el('span', null, col.hero[0]));
      const val = el('b', 'psum-hero-value');
      val.dataset.sum = col.hero[1];
      val.dataset.format = 'money';
      hero.appendChild(val);
      c.appendChild(hero);
    }
    col.rows.forEach((row) => {
      const line = el('div', 'psum-row');
      line.appendChild(el('span', null, row[0]));
      const val = el('b', null);
      val.dataset.sum = row[1];
      val.dataset.format = row[2];
      line.appendChild(val);
      if (row[2] === 'roas') {
        const sub = el('small', 'psum-sub');
        sub.dataset.sum = row[1];
        sub.dataset.format = 'roasPct';
        line.appendChild(sub);
      }
      c.appendChild(line);
    });
    if (col.note) c.appendChild(el('p', 'psum-note', col.note));
    summary.appendChild(c);
  });
  host.appendChild(summary);

  paintProjections();
}

/* ---------- typing ---------- */
function wireInput(input, key) {
  input.addEventListener('input', () => {
    const n = parseProjection(input.value);
    if (n === undefined) return;
    PV.model.inputs[key] = n;
    paintProjections();
    scheduleSave();
  });
  input.addEventListener('blur', () => paintProjections());
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
}

function wireCount(input, countKey) {
  input.addEventListener('input', () => {
    const n = parseProjection(input.value);
    if (n == null || n === undefined) return;
    const def = PROJECTION_MODELS[PV.funnel];
    const values = def.compute(PV.model.inputs);
    const change = def.inverse[countKey] && def.inverse[countKey](n, PV.model.inputs, values);
    if (!change) return;
    Object.keys(change).forEach((k) => {
      if (change[k] != null && Number.isFinite(change[k])) PV.model.inputs[k] = Math.round(change[k] * 10000) / 10000;
    });
    paintProjections();
    scheduleSave();
  });
  input.addEventListener('blur', () => paintProjections());
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
}

/* ---------- paint every number, never the box being typed in ---------- */
function paintProjections() {
  const def = PROJECTION_MODELS[PV.funnel];
  const inputs = PV.model.inputs;
  const values = def.compute(inputs);
  const focused = document.activeElement;

  Object.keys(PV.boxes).forEach((id) => {
    const box = PV.boxes[id];
    if (box.input === focused) return;
    const key = id.split('@')[0];
    const source = id.indexOf('@i') !== -1 ? inputs : values;
    box.input.value = boxText(box.unit, source[key]);
  });

  document.querySelectorAll('#projSections .pstd').forEach((line) => {
    const key = line.dataset.std;
    const std = PV.model.std[key];
    const unit = line.dataset.unit;
    line.textContent = '';
    if (std == null) { line.appendChild(el('span', 'pstd-empty', '+ Ind. Std')); return; }
    line.appendChild(document.createTextNode('Ind. Std '));
    line.appendChild(el('b', null, unit === 'money' ? projMoney(std) : projPct(std, std % 1 ? 1 : 0) + '%'));
    const actual = key in inputs ? inputs[key] : values[key];
    const lower = line.dataset.lower === '1';
    line.classList.toggle('is-ahead', actual != null && (lower ? actual <= std : actual >= std));
  });

  document.querySelectorAll('#projSections [data-sum]').forEach((node) => {
    const v = values[node.dataset.sum];
    const f = node.dataset.format;
    if (f === 'money') node.textContent = projMoney(v);
    else if (f === 'percent2') node.textContent = v == null ? '—' : v.toFixed(2) + '%';
    else if (f === 'profit') { node.textContent = projMoney(v); node.classList.toggle('is-loss', v < 0); node.classList.toggle('is-gain', v > 0); }
    else if (f === 'roas') node.textContent = v == null ? '—' : (Math.round(v * 10) / 10) + 'x';
    else if (f === 'roasPct') node.textContent = v == null ? '' : Math.round(v * 100) + '% return';
  });
}

/* ============================================================
   Start
   ============================================================ */
function initProjections() {
  if (new URLSearchParams(location.search).get('funnel') === 'webinar') PV.funnel = 'webinar';
  document.title = 'Funnel Revenue Projections · Inevitable Acquisition';

  const show = () => {
    document.querySelectorAll('#projFunnel button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.funnel === PV.funnel)));
    history.replaceState(null, '', PROJECTIONS_PATH + '?funnel=' + PV.funnel);
    $('#projSaved').textContent = savedModel(PV.funnel) ? 'Saved on this device' : 'Example numbers — edit any box';
    buildProjections();
  };

  /* VSL on the left, Webinar on the right. */
  METRIC_FUNNELS.forEach((f) => {
    const b = el('button', null, f.label);
    b.type = 'button';
    b.dataset.funnel = f.key;
    b.addEventListener('click', () => { if (PV.funnel !== f.key) { PV.funnel = f.key; show(); } });
    $('#projFunnel').appendChild(b);
  });

  $('#projReset').addEventListener('click', () => {
    if (!window.confirm('Put the example numbers back for the ' + (PV.funnel === 'vsl' ? 'VSL' : 'Webinar') + ' projection?\n\nIndustry standards go back to the defaults too.')) return;
    try { localStorage.removeItem(projectionKey(PV.funnel)); } catch (e) { /* nothing saved */ }
    buildProjections();
    $('#projSaved').textContent = 'Example numbers — edit any box';
  });

  show();
}
