/* ============================================================
   app.js — Performance Dashboard
   ============================================================ */

/* ---------- icons ---------- */
const ICON = {
  money: '$',
  pct: '%',
  hash: '#',
  phone:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>'
};

/* ---------- outcome palette ----------
   Steps chosen against the black chart surface, not flipped from a light
   set. Ordered so no two hard-to-separate hues sit next to each other in
   the ring; every slice also carries a label + count in the legend, so
   identity never rests on colour alone. */
/* Booked-calendar outcomes only — a Remainder Collection was never a
   call, so it has no place in a chart of how calls turned out. */
const OUTCOME_SLICES = OUTCOMES
  .filter((o) => o.isCall)
  .map((o) => ({ key: o.key, label: o.short, color: o.color }));

/* fixed categorical order — assigned by entity, never cycled by rank */
const CATEGORICAL = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

/* ---------- formatting ---------- */
const money = (n) =>
  '$' + (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = (n) =>
  '$' + Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US');
const pct = (n) => (Number.isFinite(n) ? Math.round(n * 100) : 0) + '%';
const int = (n) => (Number.isFinite(n) ? n : 0).toLocaleString('en-US');
const safeDiv = (a, b) => (b > 0 ? a / b : 0);

/* ---------- metric registry ---------- */
/* span: 2 = third-width, 3 = half-width, 6 = full-width (6-col grid) */
const METRICS = [
  { id: 'totalCash',     label: 'Total Cash Collected',       sub: 'Sum of payments this period',  icon: 'money', span: 2, fmt: money, get: (m) => m.totalCash },
  { id: 'newCash',       label: 'New Cash Collected (from closes)', sub: 'Cash from newly closed deals', icon: 'money', span: 2, fmt: money, get: (m) => m.newCash },
  { id: 'remainderCash', label: 'Remainder Cash Collected',   sub: 'Remaining balance payments',   icon: 'money', span: 2, fmt: money, get: (m) => m.remainderCash },
  { id: 'depositCash',   label: 'Cash Collected from Deposits', sub: 'Deposit payments collected', icon: 'money', span: 2, fmt: money, get: (m) => m.depositCash },
  { id: 'cashPerCall',   label: 'Cash per Live Call',         sub: 'Cash ÷ calls attended',    icon: 'phone', span: 2, fmt: money, get: (m) => safeDiv(m.totalCash, m.liveCalls) },
  { id: 'cashPerBooking', label: 'Cash per Booking',          sub: 'Cash ÷ calls booked',      icon: 'phone', span: 2, fmt: money, get: (m) => safeDiv(m.totalCash, m.booked) },
  { id: 'aov',           label: 'AOV',                        sub: 'Average deal size',            icon: 'money', span: 2, fmt: money, get: (m) => safeDiv(m.totalRevenue, m.deals) },
  { id: 'calls',         label: 'Calls',                      sub: 'Live calls this period',       icon: 'phone', span: 2, fmt: int,   get: (m) => m.liveCalls },
  { id: 'totalRevenue',  label: 'Total Revenue',              sub: 'Total contract value',         icon: 'money', span: 2, fmt: money, get: (m) => m.totalRevenue },
  { id: 'closeRate',     label: 'Close Rate',                 sub: 'Closed ÷ live calls',      icon: 'pct',   span: 6, fmt: pct,   get: (m) => safeDiv(m.deals, m.liveCalls) },
  { id: 'totalShowRate', label: 'Total Show Rate',            sub: "All calls booked even DQ's",   icon: 'pct',   span: 3, fmt: pct,   get: (m) => safeDiv(m.liveCalls, m.scheduled) },
  { id: 'showRate',      label: 'Show Rate',                  sub: 'Live calls vs. total booked',  icon: 'pct',   span: 3, fmt: pct,   get: (m) => safeDiv(m.showedCalls, m.scheduled) },
  { id: 'deals',         label: 'Deals',                      sub: 'Closed-won deals',             icon: 'hash',  span: 2, fmt: int,   get: (m) => m.deals },
  { id: 'onCalendar',    label: 'Calls On Calendar',          sub: 'Calls booked this period',     icon: 'phone', span: 2, fmt: int,   get: (m) => m.booked },
  { id: 'callsShowed',   label: 'Calls Showed',               sub: 'Calls that were live',         icon: 'phone', span: 2, fmt: int,   get: (m) => m.liveCalls },
  { id: 'cancelled',     label: 'Calls Cancelled',            sub: 'Booked calls that were cancelled', icon: 'phone', span: 2, fmt: int, get: (m) => m.counts.cancelled },
  { id: 'rescheduled',   label: 'Calls Rescheduled',          sub: 'Booked calls that were moved', icon: 'phone', span: 2, fmt: int,   get: (m) => m.counts.rescheduled },
  { id: 'noShow',        label: 'Calls No-Showed',            sub: "Booked but didn't show",       icon: 'phone', span: 2, fmt: int,   get: (m) => m.counts.no_show },
  { id: 'dqCalls',       label: 'Disqualified Calls',         sub: 'Disqualified on the call',     icon: 'hash',  span: 3, fmt: int,   get: (m) => m.counts.disqualified },
  { id: 'dqRate',        label: 'DQ Rate (per live call)',    sub: 'Disqualified ÷ live calls', icon: 'pct', span: 3, fmt: pct,   get: (m) => safeDiv(m.counts.disqualified, m.liveCalls) }
];

const DEFAULT_ORDER = METRICS.map((m) => m.id);
const DEFAULT_PINS = ['totalCash', 'aov', 'closeRate', 'showRate'];

/* ---------- persisted UI state ---------- */
const store = {
  read(key, fallback) {
    try {
      const raw = localStorage.getItem('ia-dash:' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  },
  write(key, value) {
    try { localStorage.setItem('ia-dash:' + key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }
};

const state = {
  order: (function () {
    const saved = store.read('order', null);
    if (!Array.isArray(saved)) return DEFAULT_ORDER.slice();
    const kept = saved.filter((id) => DEFAULT_ORDER.includes(id));
    DEFAULT_ORDER.forEach((id) => { if (!kept.includes(id)) kept.push(id); });
    return kept;
  })(),
  pins: store.read('pins', DEFAULT_PINS.slice()),
  filters: { range: 'ytd', funnel: '', outcome: '', closer: '', setter: '' },
  outcomeSetter: ''
};

/* ---------- date ranges ---------- */
/* Midnight today — so a call logged this morning always falls inside
   the default "This year so far" range. */
const TODAY = (function () {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
})();

function rangeFor(key) {
  const end = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
  const start = new Date(end);
  switch (key) {
    case 'today': break;
    case '7d':  start.setDate(end.getDate() - 6); break;
    case '30d': start.setDate(end.getDate() - 29); break;
    case '90d': start.setDate(end.getDate() - 89); break;
    case '365d': start.setDate(end.getDate() - 364); break;
    case 'mtd': start.setDate(1); break;
    case 'lastMonth': {
      const s = new Date(end.getFullYear(), end.getMonth() - 1, 1);
      const e = new Date(end.getFullYear(), end.getMonth(), 0);
      return { from: s, to: e };
    }
    case 'qtd': start.setMonth(Math.floor(end.getMonth() / 3) * 3, 1); break;
    case 'all': return { from: new Date(2000, 0, 1), to: end };
    case 'ytd':
    default: start.setMonth(0, 1); break;
  }
  return { from: start, to: end };
}

const asDate = (iso) => {
  const p = iso.split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
};
const within = (iso, r) => { const d = asDate(iso); return d >= r.from && d <= r.to; };

/* ---------- metric computation ----------
   Call counts only ever see rows that were genuinely on the calendar.
   Remainder Collections and leads disqualified before a call never
   reach `scheduled`, so they cannot move show rate or close rate —
   their money still lands in the cash figures, which is the point. */
function computeMetrics(rows, range) {
  const calendarRows = rows.filter(isCallRecord);
  const scheduled = calendarRows.filter((c) => within(c.callDate, range));
  const booked = calendarRows.filter((c) => within(c.bookedDate, range));

  const counts = {};
  OUTCOMES.forEach((o) => { counts[o.key] = 0; });
  scheduled.forEach((c) => { counts[c.outcome]++; });

  const liveCalls = scheduled.filter(isLiveRecord).length;
  const showedCalls = counts.closed + counts.no_close + counts.second_call;
  const closedDeals = scheduled.filter((c) => c.outcome === 'closed');

  let totalCash = 0, newCash = 0, remainderCash = 0, depositCash = 0;
  const byDay = new Map();
  const cashByCloser = new Map();
  const cashBySetter = new Map();
  const payByCloser = new Map();
  const paySetter = new Map();
  const ratedCloser = new Map();
  const ratedSetter = new Map();
  let callsWithoutRate = 0;
  const seenWithoutRate = new Set();

  rows.forEach((c) => {
    c.payments.forEach((p) => {
      if (!within(p.date, range)) return;
      totalCash += p.amount;
      if (c.outcome === 'closed' && within(c.callDate, range)) newCash += p.amount;
      if (p.type === 'remainder') remainderCash += p.amount;
      if (p.type === 'deposit') depositCash += p.amount;
      byDay.set(p.date, (byDay.get(p.date) || 0) + p.amount);
      cashByCloser.set(c.closer, (cashByCloser.get(c.closer) || 0) + p.amount);
      cashBySetter.set(c.setter, (cashBySetter.get(c.setter) || 0) + p.amount);

      /* Each payment pays at the rate its own call was logged at. */
      const closerRate = Number.isFinite(c.closerRate) ? c.closerRate : null;
      const setterRate = Number.isFinite(c.setterRate) ? c.setterRate : null;
      if (closerRate == null && setterRate == null && !seenWithoutRate.has(c.id)) {
        seenWithoutRate.add(c.id);
        callsWithoutRate += 1;
      }
      if (closerRate != null) {
        payByCloser.set(c.closer, (payByCloser.get(c.closer) || 0) + p.amount * closerRate);
        ratedCloser.set(c.closer, (ratedCloser.get(c.closer) || 0) + p.amount);
      }
      if (setterRate != null) {
        paySetter.set(c.setter, (paySetter.get(c.setter) || 0) + p.amount * setterRate);
        ratedSetter.set(c.setter, (ratedSetter.get(c.setter) || 0) + p.amount);
      }
    });
  });

  return {
    scheduledCalls: scheduled,
    scheduled: scheduled.length,
    booked: booked.length,
    counts,
    liveCalls,
    showedCalls,
    deals: counts.closed,
    totalRevenue: closedDeals.reduce((s, c) => s + c.contractValue, 0),
    totalCash, newCash, remainderCash, depositCash,
    byDay, cashByCloser, cashBySetter, payByCloser, paySetter,
    ratedCloser, ratedSetter, callsWithoutRate,
    closedDeals
  };
}

/* ---------- team roster ----------
   The Add Team tab is the only source. Removing someone takes them out
   of the dropdowns and out of Commission Tracking; it never touches a
   call they already logged. */
function roster() {
  return CACHE.team;
}

const rosterBy = (role) => roster().filter((t) => t.role === role);

/* Keeps a select's current choice when the roster behind it changes. */
function refillKeeping(sel, values, allLabel) {
  if (!sel) return;
  const prev = sel.value;
  fillSelect(sel, values, allLabel);
  sel.value = values.some((v) => v.value === prev) ? prev : '';
}

function fillTeamSelects() {
  const closers = rosterBy('closer').map((t) => ({ value: t.name, label: t.name }));
  const setters = rosterBy('setter').map((t) => ({ value: t.name, label: t.name }));

  refillKeeping($('#fCloser'), closers, 'Closer');
  refillKeeping($('#fSetter'), setters, 'Setter');
  refillKeeping($('#fOutcomeSetter'), setters, 'All Setters');
  refillKeeping($('#pcCloser'), closers, 'Select...');
  refillKeeping($('#pcSetter'), setters, 'Select...');

  /* A filter pointing at someone no longer on the roster would silently
     match nothing, so drop it rather than leave a dead filter on. */
  state.filters.closer = $('#fCloser').value;
  state.filters.setter = $('#fSetter').value;
  state.outcomeSetter = $('#fOutcomeSetter').value;

  if (window.PostCallForm && window.PostCallForm.paintRosterHint) {
    window.PostCallForm.paintRosterHint();
  }
}

/* Rows logged through the Post Call Form, newest last. Shared by the
   whole team — this is whatever the database last handed us. */
function loggedCalls() {
  return CACHE.calls;
}

function activeCalls() {
  const all = loggedCalls();
  const f = state.filters;
  return all.filter((c) =>
    (!f.funnel  || c.funnel  === f.funnel) &&
    (!f.outcome || c.outcome === f.outcome) &&
    (!f.closer  || c.closer  === f.closer) &&
    (!f.setter  || c.setter  === f.setter)
  );
}

/* ============================================================
   Rendering
   ============================================================ */
const $ = (sel, root) => (root || document).querySelector(sel);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

/* ---------- tooltip ---------- */
const tip = el('div', 'tip');
document.body.appendChild(tip);
function bindTip(node, html) {
  node.addEventListener('mouseenter', () => { tip.innerHTML = html; tip.classList.add('show'); });
  node.addEventListener('mousemove', (e) => {
    tip.style.left = e.clientX + 'px';
    tip.style.top = e.clientY + 'px';
  });
  node.addEventListener('mouseleave', () => tip.classList.remove('show'));
}

/* ============================================================
   Undo
   ------------------------------------------------------------
   Anything that loses data records how to put it back before it
   runs. Entries are small deltas rather than whole snapshots, so
   the history costs almost nothing to keep and survives a reload.
   ============================================================ */
const UNDO_LIMIT = 25;

/* Each offer keeps its own history, so an undo can never write into a
   different offer from the one it came from. */
const undoKey = () => 'undo:' + (CACHE.boardId || 'hub');

function undoStack() {
  const s = store.read(undoKey(), []);
  return Array.isArray(s) ? s : [];
}

/* kind 'restoreCall'  — put a row back, or roll an edit back
   kind 'removeCall'    — take back a call that was just logged
   kind 'renameBoard'   — put the offer's old name back
   kind 'restoreTeam'  — put the whole roster back (it is tiny) */
function pushUndo(entry) {
  const s = undoStack();
  s.push(entry);
  while (s.length > UNDO_LIMIT) s.shift();
  store.write(undoKey(), s);
  paintUndo();
}

function paintUndo() {
  const btn = $('#undoBtn');
  if (!btn) return;
  const last = undoStack().slice(-1)[0];
  btn.classList.toggle('hidden', !last);
  if (last) btn.title = 'Undo: ' + last.label;
}

async function applyUndo() {
  const s = undoStack();
  const entry = s.pop();
  if (!entry) return;
  store.write(undoKey(), s);
  paintUndo();

  try {
    if (entry.kind === 'restoreCall') {
      await restoreCall(entry.row);        // upsert puts back a delete or an edit alike
    } else if (entry.kind === 'removeCall') {
      await deleteCall(entry.id);
    } else if (entry.kind === 'renameBoard') {
      await renameBoard(entry.name, true);
      if (typeof paintBoardName === 'function') paintBoardName();
      if (typeof syncBoardAddress === 'function') syncBoardAddress();
    } else if (entry.kind === 'restoreTeam') {
      await replaceTeam(entry.team);
    }
  } catch (err) {
    console.error(err);
    notify("Couldn't undo that — check your connection and try again.");
    return;
  }

  fillTeamSelects();
  render();
  if (typeof renderDataTab === 'function') renderDataTab();
  if (typeof renderRoster === 'function') renderRoster();
  notify('Undone — ' + entry.label.charAt(0).toLowerCase() + entry.label.slice(1));
}

/* ---------- shared toast ---------- */
let notifyTimer = null;
function notify(message) {
  const node = $('#appToast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => node.classList.remove('show'), 3400);
}

/* ---------- KPI cards ---------- */
function renderKpis(m) {
  const grid = $('#kpiGrid');
  grid.textContent = '';

  state.order.forEach((id) => {
    const def = METRICS.find((x) => x.id === id);
    if (!def) return;
    const pinned = state.pins.includes(id);

    const card = el('div', 'kpi' + (pinned ? ' pinned' : ''));
    card.dataset.span = def.span;
    card.dataset.id = id;
    card.draggable = true;

    const top = el('div', 'kpi-top');
    top.appendChild(el('div', 'kpi-label', def.label));

    const chip = el('button', 'chip', ICON[def.icon] || '');
    chip.type = 'button';
    chip.title = pinned ? 'Unpin this metric' : 'Pin this metric';
    chip.setAttribute('aria-pressed', String(pinned));
    chip.setAttribute('aria-label', (pinned ? 'Unpin ' : 'Pin ') + def.label);
    chip.addEventListener('click', () => {
      state.pins = pinned ? state.pins.filter((p) => p !== id) : state.pins.concat(id);
      store.write('pins', state.pins);
      render();
    });
    top.appendChild(chip);
    card.appendChild(top);

    card.appendChild(el('div', 'kpi-value', def.fmt(def.get(m))));
    card.appendChild(el('div', 'kpi-sub', def.sub));

    const grip = el('div', 'grip',
      '<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">' +
      '<circle cx="3" cy="3" r="1.1"/><circle cx="9" cy="3" r="1.1"/>' +
      '<circle cx="3" cy="9" r="1.1"/><circle cx="9" cy="9" r="1.1"/>' +
      '<circle cx="3" cy="6" r="1.1"/><circle cx="9" cy="6" r="1.1"/></svg>');
    grip.title = 'Drag to reorder';
    card.appendChild(grip);

    grid.appendChild(card);
  });

  wireDragReorder(grid);
}

let dragId = null;
function wireDragReorder(grid) {
  grid.querySelectorAll('.kpi').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      dragId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragId); } catch (err) { /* noop */ }
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      grid.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target'));
      dragId = null;
    });
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (dragId && card.dataset.id !== dragId) card.classList.add('drop-target');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drop-target');
      const target = card.dataset.id;
      if (!dragId || dragId === target) return;
      const next = state.order.filter((x) => x !== dragId);
      next.splice(next.indexOf(target), 0, dragId);
      state.order = next;
      store.write('order', next);
      render();
    });
  });
}

/* ---------- donut ---------- */
function donut(slices, opts) {
  opts = opts || {};
  const size = opts.size || 168;
  const stroke = opts.stroke || 22;
  const r = (size - stroke) / 2 - 1;
  const total = slices.reduce((s, x) => s + x.value, 0);

  const wrap = el('div', 'donut-wrap');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', opts.label || 'Distribution');

  const circumference = 2 * Math.PI * r;
  const gap = total > 0 ? (2 / circumference) * 100 : 0; // 2px surface gap, in pathLength units

  const track = document.createElementNS(ns, 'circle');
  track.setAttribute('cx', String(size / 2));
  track.setAttribute('cy', String(size / 2));
  track.setAttribute('r', String(r));
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke', 'var(--line)');
  track.setAttribute('stroke-width', String(stroke));
  if (total === 0 && opts.dashedWhenEmpty) track.setAttribute('stroke-dasharray', '4 7');
  svg.appendChild(track);

  let offset = 0;
  slices.forEach((s) => {
    if (s.value <= 0) return;
    const share = (s.value / total) * 100;
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('class', 'seg');
    c.setAttribute('cx', String(size / 2));
    c.setAttribute('cy', String(size / 2));
    c.setAttribute('r', String(r));
    c.setAttribute('fill', 'none');
    c.setAttribute('stroke', s.color);
    c.setAttribute('stroke-width', String(stroke));
    c.setAttribute('pathLength', '100');
    c.setAttribute('stroke-dasharray', Math.max(share - gap, 0.4) + ' ' + 100);
    c.setAttribute('stroke-dashoffset', String(-offset));
    c.setAttribute('transform', 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')');
    bindTip(c, '<b>' + s.label + '</b> &middot; ' + (opts.fmt ? opts.fmt(s.value) : int(s.value)) +
      ' (' + Math.round((s.value / total) * 100) + '%)');
    svg.appendChild(c);
    offset += share;
  });

  wrap.appendChild(svg);
  const center = el('div', 'donut-center', total === 0 && opts.dashedWhenEmpty
    ? '<span style="font-size:12.5px;font-weight:500;color:var(--muted)">No data</span>'
    : (opts.center != null ? opts.center : int(total)));
  wrap.appendChild(center);
  return wrap;
}

function legend(slices, fmt, oneCol) {
  const box = el('div', 'legend' + (oneCol ? ' one-col' : ''));
  slices.forEach((s) => {
    const row = el('div', 'legend-item');
    const sw = el('span', 'swatch');
    sw.style.background = s.color;
    row.appendChild(sw);
    row.appendChild(el('span', 'legend-name', s.label));
    row.appendChild(el('span', 'legend-val', '(' + (fmt ? fmt(s.value) : int(s.value)) + ')'));
    box.appendChild(row);
  });
  return box;
}

/* ---------- bar chart (cash over time) ---------- */
function roundedTopPath(x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h);
  return 'M' + x + ',' + (y + h) +
    'V' + (y + rad) +
    'a' + rad + ',' + rad + ' 0 0 1 ' + rad + ',' + -rad +
    'h' + (w - rad * 2) +
    'a' + rad + ',' + rad + ' 0 0 1 ' + rad + ',' + rad +
    'V' + (y + h) + 'Z';
}

function bucketCash(byDay, range) {
  const days = Math.round((range.to - range.from) / 86400000) + 1;
  const grain = days <= 32 ? 'day' : days <= 120 ? 'week' : 'month';
  const buckets = new Map();
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  byDay.forEach((amount, iso) => {
    const d = asDate(iso);
    let key, label;
    if (grain === 'day') {
      key = iso; label = d.getDate() + ' ' + MON[d.getMonth()];
    } else if (grain === 'week') {
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      key = monday.toISOString().slice(0, 10);
      label = monday.getDate() + ' ' + MON[monday.getMonth()];
    } else {
      key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      label = MON[d.getMonth()];
    }
    const cur = buckets.get(key) || { key, label, value: 0 };
    cur.value += amount;
    buckets.set(key, cur);
  });

  return { grain, rows: Array.from(buckets.values()).sort((a, b) => (a.key < b.key ? -1 : 1)) };
}

function barChart(rows, grain) {
  const ns = 'http://www.w3.org/2000/svg';
  const W = 620, H = 200, ML = 52, MR = 8, MT = 10, MB = 26;
  const plotW = W - ML - MR, plotH = H - MT - MB;
  const max = Math.max.apply(null, rows.map((r) => r.value).concat([1]));
  const nice = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / nice) * nice;

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'chart');
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Cash collected per ' + grain);

  for (let i = 0; i <= 4; i++) {
    const v = (top / 4) * i;
    const y = MT + plotH - (v / top) * plotH;
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('class', 'gridline');
    line.setAttribute('x1', String(ML)); line.setAttribute('x2', String(W - MR));
    line.setAttribute('y1', String(y)); line.setAttribute('y2', String(y));
    svg.appendChild(line);

    const t = document.createElementNS(ns, 'text');
    t.setAttribute('class', 'tick');
    t.setAttribute('x', String(ML - 8)); t.setAttribute('y', String(y + 3.5));
    t.setAttribute('text-anchor', 'end');
    t.textContent = v >= 1000 ? '$' + Math.round(v / 1000) + 'k' : '$' + Math.round(v);
    svg.appendChild(t);
  }

  const step = plotW / rows.length;
  const bw = Math.max(Math.min(step - 2, 34), 2); // 2px surface gap between bars
  const labelEvery = Math.ceil(rows.length / 12);

  rows.forEach((r, i) => {
    const h = (r.value / top) * plotH;
    const x = ML + step * i + (step - bw) / 2;
    const y = MT + plotH - h;
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('class', 'bar');
    p.setAttribute('d', roundedTopPath(x, y, bw, Math.max(h, 1.5), 4));
    p.setAttribute('fill', 'var(--chart-blue)');
    bindTip(p, '<b>' + money0(r.value) + '</b><br>' + r.label);
    svg.appendChild(p);

    if (i % labelEvery === 0) {
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('class', 'tick');
      t.setAttribute('x', String(x + bw / 2));
      t.setAttribute('y', String(MT + plotH + 15));
      t.setAttribute('text-anchor', 'middle');
      t.textContent = r.label;
      svg.appendChild(t);
    }
  });

  const axis = document.createElementNS(ns, 'line');
  axis.setAttribute('class', 'gridline');
  axis.setAttribute('x1', String(ML)); axis.setAttribute('x2', String(W - MR));
  axis.setAttribute('y1', String(MT + plotH)); axis.setAttribute('y2', String(MT + plotH));
  svg.appendChild(axis);

  return svg;
}

/* ---------- panels ---------- */
function renderOutcomes(m) {
  const body = $('#outcomesBody');
  body.textContent = '';

  let rows = m.scheduledCalls;
  if (state.outcomeSetter) rows = rows.filter((c) => c.setter === state.outcomeSetter);
  const counts = {};
  OUTCOMES.forEach((o) => { counts[o.key] = 0; });
  rows.forEach((c) => { counts[c.outcome]++; });

  const slices = OUTCOME_SLICES.map((s) => ({ label: s.label, color: s.color, value: counts[s.key] }));
  const row = el('div', 'donut-row');
  row.appendChild(donut(slices, { label: 'Booked calls by result' }));
  row.appendChild(legend(slices));
  body.appendChild(row);
}

function renderCashOverTime(m, range) {
  const body = $('#cashBody');
  body.textContent = '';
  const { grain, rows } = bucketCash(m.byDay, range);

  if (!rows.length) {
    body.appendChild(el('div', 'empty', 'No data'));
    return;
  }
  body.appendChild(barChart(rows, grain));
  body.appendChild(el('div', 'axis-note',
    'Total ' + money0(rows.reduce((s, r) => s + r.value, 0)) + ' across ' + rows.length + ' ' + grain + (rows.length === 1 ? '' : 's')));
}

function renderPeopleDonut(targetId, map, label) {
  const body = $('#' + targetId);
  body.textContent = '';
  const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  const slices = entries.map((e, i) => ({ label: e[0], value: e[1], color: CATEGORICAL[i % CATEGORICAL.length] }));
  const total = slices.reduce((s, x) => s + x.value, 0);

  const row = el('div', 'donut-row');
  row.appendChild(donut(slices, { label: label, dashedWhenEmpty: true, center: total ? int(total) : null }));
  row.appendChild(slices.length ? legend(slices, null, true) : el('div', 'axis-note', label));
  body.appendChild(row);
}

function renderCommission(m) {
  const build = (targetId, role, payMap, ratedMap) => {
    const body = $('#' + targetId);
    body.textContent = '';
    const people = rosterBy(role);
    const rows = people.map((p) => {
      /* Only cash on calls that carry a rate can say anything about the
         percentage, so an unpriced call never drags the number down. */
      const cash = ratedMap.get(p.name) || 0;
      const payout = payMap.get(p.name) || 0;
      return { name: p.name, cash, rate: cash > 0 ? payout / cash : 0, payout };
    }).sort((a, b) => b.payout - a.payout);

    const max = Math.max.apply(null, rows.map((r) => r.payout).concat([1]));
    const list = el('div', 'rank');

    rows.forEach((r, i) => {
      const line = el('div', 'rank-row');
      line.appendChild(el('div', 'rank-name', r.name));

      const track = el('div', 'rank-track');
      const fill = el('div', 'rank-fill' + (role === 'setter' ? ' alt' : ''));
      fill.style.width = Math.max((r.payout / max) * 100, r.payout > 0 ? 2 : 0) + '%';
      track.appendChild(fill);
      bindTip(track, '<b>' + money(r.payout) + '</b><br>' + Math.round(r.rate * 1000) / 10 + '% of ' + money0(r.cash) + ' collected');
      line.appendChild(track);

      line.appendChild(el('div', 'rank-val',
        money(r.payout) + '<span class="rank-meta">' + Math.round(r.rate * 1000) / 10 + '% of ' + money0(r.cash) + '</span>'));
      list.appendChild(line);
    });

    if (!rows.length) list.appendChild(el('div', 'axis-note', 'No team members in this role yet'));
    if (m.callsWithoutRate) {
      list.appendChild(el('div', 'axis-note', m.callsWithoutRate === 1
        ? '1 call has no commission on it yet — open it on the Data tab to set one'
        : m.callsWithoutRate + ' calls have no commission on them yet — open them on the Data tab to set one'));
    }
    body.appendChild(list);
  };

  build('closersBody', 'closer', m.payByCloser, m.ratedCloser);
  build('settersBody', 'setter', m.paySetter, m.ratedSetter);
}

/* ---------- filters ---------- */
function fillSelect(sel, values, allLabel) {
  sel.textContent = '';
  const first = el('option', null, allLabel);
  first.value = '';
  sel.appendChild(first);
  values.forEach((v) => {
    const o = el('option', null, v.label);
    o.value = v.value;
    sel.appendChild(o);
  });
}

function initFilters() {
  fillSelect($('#fFunnel'), FUNNELS, 'Funnel');
  fillSelect($('#fOutcome'), OUTCOMES.map((o) => ({ value: o.key, label: o.label })), 'Call Outcome');
  fillTeamSelects();

  const bind = (id, key) => {
    const sel = $('#' + id);
    sel.value = state.filters[key];
    sel.addEventListener('change', () => { state.filters[key] = sel.value; render(); });
  };
  bind('fRange', 'range');
  bind('fFunnel', 'funnel');
  bind('fOutcome', 'outcome');
  bind('fCloser', 'closer');
  bind('fSetter', 'setter');

  $('#fOutcomeSetter').addEventListener('change', (e) => {
    state.outcomeSetter = e.target.value;
    render();
  });

  $('#resetFilters').addEventListener('click', () => {
    state.filters = { range: 'ytd', funnel: '', outcome: '', closer: '', setter: '' };
    state.outcomeSetter = '';
    ['fRange', 'fFunnel', 'fOutcome', 'fCloser', 'fSetter'].forEach((id) => {
      $('#' + id).value = id === 'fRange' ? 'ytd' : '';
    });
    $('#fOutcomeSetter').value = '';
    render();
  });

}

function paintFilterPills() {
  const map = { fRange: state.filters.range !== 'ytd', fFunnel: !!state.filters.funnel,
    fOutcome: !!state.filters.outcome, fCloser: !!state.filters.closer, fSetter: !!state.filters.setter };
  Object.keys(map).forEach((id) => {
    $('#' + id).parentElement.classList.toggle('is-set', map[id]);
  });
}

/* ---------- tabs ---------- */
function showTab(name) {
  document.querySelectorAll('.tab').forEach((t) => {
    t.setAttribute('aria-selected', String(t.dataset.tab === name));
  });
  document.querySelectorAll('[data-panel]').forEach((p) => {
    p.classList.toggle('hidden', p.dataset.panel !== name);
  });
  if (name === 'data' && typeof renderDataTab === 'function') renderDataTab();
  if (name === 'rephub' && typeof renderRepHub === 'function') renderRepHub();
  if (name === 'clients' && typeof renderClients === 'function') renderClients();
  if (name === 'huddles' && typeof renderHuddles === 'function') renderHuddles();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initTabs() {
  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => showTab(t.dataset.tab));
  });
}

/* ---------- main render ---------- */
function render() {
  const range = rangeFor(state.filters.range);
  const calls = activeCalls();
  const m = computeMetrics(calls, range);

  paintFilterPills();
  renderKpis(m);
  renderOutcomes(m);
  renderCashOverTime(m, range);

  const dealsByCloser = new Map();
  const dealsBySetter = new Map();
  m.closedDeals.forEach((c) => {
    dealsByCloser.set(c.closer, (dealsByCloser.get(c.closer) || 0) + 1);
    dealsBySetter.set(c.setter, (dealsBySetter.get(c.setter) || 0) + 1);
  });
  renderPeopleDonut('dealsClosedBody', dealsByCloser, 'Closer');
  renderPeopleDonut('dealsSetBody', dealsBySetter, 'Setter');

  renderCommission(m);
}

/* Called by boot.js once a session exists and the data has loaded. */
function initApp() {
  initTabs();
  initFilters();
  $('#undoBtn').addEventListener('click', applyUndo);
  registerUndo({ label: 'sales board', when: () => shellShown('boardShell'), undo: applyUndo });
  paintUndo();
  render();
}

/* ============================================================
   The order of the tabs
   ------------------------------------------------------------
   Dashboard is always first — it is what the board is for. The rest
   are dragged into whatever order suits the team, by the owner or an
   admin with every offer, and everyone sees that order.
   ============================================================ */
const TAB_LOCKED = 'dashboard';

function tabOrder() {
  const saved = (CACHE.repHub && CACHE.repHub.tabOrder) || [];
  const nav = $('#offerTabsNav') || document.querySelector('.tabs');
  const here = Array.prototype.map.call(nav.querySelectorAll('.tab'), (t) => t.dataset.tab);
  const wanted = saved.filter((name) => here.indexOf(name) !== -1);
  here.forEach((name) => { if (wanted.indexOf(name) === -1) wanted.push(name); });
  return [TAB_LOCKED].concat(wanted.filter((name) => name !== TAB_LOCKED));
}

function paintTabOrder() {
  const nav = document.querySelector('.tabs');
  if (!nav) return;
  const byName = {};
  nav.querySelectorAll('.tab').forEach((t) => { byName[t.dataset.tab] = t; });
  tabOrder().forEach((name) => { if (byName[name]) nav.appendChild(byName[name]); });
}

async function saveTabOrder(order) {
  CACHE.repHub.tabOrder = order;
  try {
    await saveRepHubTemplate();
    notify('Tab order saved for everyone.');
  } catch (err) {
    console.error(err);
    notify("Couldn't save the tab order — check your connection.");
  }
}

function initTabOrder() {
  const nav = document.querySelector('.tabs');
  if (!nav) return;
  nav.querySelectorAll('.tab').forEach((t) => { t.dataset.id = t.dataset.tab; });
  paintTabOrder();

  const mine = typeof canEditShared === 'function' && canEditShared();
  nav.classList.toggle('is-sortable', mine);
  if (!mine || nav.dataset.sortable) return;
  nav.dataset.sortable = '1';

  makeSortable(nav, '.tab', (order) => {
    /* Dashboard cannot be moved off the front. */
    const next = [TAB_LOCKED].concat(order.filter((name) => name !== TAB_LOCKED));
    saveTabOrder(next);
    paintTabOrder();
  }, { handle: '.tab:not([data-tab="dashboard"])', threshold: 6, axis: 'x' });
}
