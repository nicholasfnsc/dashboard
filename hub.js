/* ============================================================
   hub.js — Sales Team Boards (/sales-dashboard)
   ------------------------------------------------------------
   Opened from the portal. Owner and admins each see the offers they can reach —
   the owner every one, an admin only those they were given. The
   database decides that; this page shows whatever comes back.

   At the top, the whole agency: revenue or cash collected, all time and
   by period, with a chart. Below, one card per offer. Card figures come
   from the same computeMetrics() each board uses, so a card and its
   board can never disagree.
   ============================================================ */

/* What the summary is showing. Revenue is the contract value of deals
   closed on a day; cash is money that landed on a day — the same two
   definitions every board uses. */
const HUB = { metric: 'revenue', range: '90d', from: '', to: '', grain: 'day' };

const HUB_RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d',    label: '7 days' },
  { key: '30d',   label: '30 days' },
  { key: 'mtd',   label: 'Month' },
  { key: '90d',   label: '90 days' },
  { key: 'ytd',   label: 'Year' },
  { key: '365d',  label: '365 days' },
  { key: 'all',   label: 'All time' }
];

const HUB_STRIP = [
  { key: '365d',  label: 'Last 365 days' },
  { key: 'ytd',   label: 'Year to date' },
  { key: '90d',   label: 'Last 90 days' },
  { key: 'mtd',   label: 'Month to date' },
  { key: '7d',    label: 'Last 7 days' },
  { key: 'today', label: 'Today' }
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const isoOf = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const shortDate = (d) => MONTHS[d.getMonth()] + ' ' + d.getDate();

function boardRows(boardId) {
  return CACHE.allCalls.filter((r) => r.boardId === boardId).map((r) => r.record);
}

/* Revenue and cash per day, across every offer this person can see. */
function dailyTotals(rows) {
  const revenue = new Map();
  const cash = new Map();
  rows.forEach((c) => {
    if (c.outcome === 'closed' && c.callDate) revenue.set(c.callDate, (revenue.get(c.callDate) || 0) + (c.contractValue || 0));
    (c.payments || []).forEach((p) => { if (p.date) cash.set(p.date, (cash.get(p.date) || 0) + p.amount); });
  });
  return { revenue, cash };
}

const sumIn = (map, range) => {
  let total = 0;
  map.forEach((v, iso) => { if (within(iso, range)) total += v; });
  return total;
};

/* The period in view: a preset, or the two dates picked by hand. "All
   time" starts at the first day anything was logged. */
function hubRange(daily) {
  if (HUB.from && HUB.to && HUB.from <= HUB.to) return { from: asDate(HUB.from), to: asDate(HUB.to), custom: true };
  const range = rangeFor(HUB.range);
  if (HUB.range === 'all') {
    const days = Array.from(daily.revenue.keys()).concat(Array.from(daily.cash.keys())).sort();
    const first = days.length ? asDate(days[0]) : new Date(TODAY.getTime() - 29 * 86400000);
    return { from: first < TODAY ? first : TODAY, to: TODAY };
  }
  return range;
}

function periodLabel(range) {
  if (range.custom) return shortDate(range.from) + ' – ' + shortDate(range.to);
  const hit = HUB_RANGES.find((r) => r.key === HUB.range);
  return hit.key === 'today' || hit.key === 'all' ? hit.label : hit.key === 'mtd' ? 'This month' : hit.key === 'ytd' ? 'This year' : 'Last ' + hit.label;
}

/* A sensible grouping for the length of the period. */
function defaultGrain(range) {
  const days = Math.round((range.to - range.from) / 86400000) + 1;
  return days <= 92 ? 'day' : days <= 400 ? 'week' : 'month';
}

/* One point per day, week or month in the period — empty days count as
   zero, so a quiet week reads as quiet rather than disappearing. */
function buckets(daily, range, grain) {
  const out = [];
  const index = new Map();
  const start = new Date(range.from);
  if (grain === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (grain === 'month') start.setDate(1);

  for (let d = new Date(start); d <= range.to;) {
    const b = { from: new Date(d), revenue: 0, cash: 0 };
    if (grain === 'day') { b.label = shortDate(d); d.setDate(d.getDate() + 1); }
    else if (grain === 'week') { b.label = 'Week of ' + shortDate(d); d.setDate(d.getDate() + 7); }
    else { b.label = MONTHS[d.getMonth()] + ' ' + d.getFullYear(); d.setMonth(d.getMonth() + 1); }
    out.push(b);
    if (out.length > 800) break;
  }

  const keyOf = (date) => {
    if (grain === 'day') return isoOf(date);
    if (grain === 'month') return date.getFullYear() + '-' + date.getMonth();
    const monday = new Date(date);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return isoOf(monday);
  };
  out.forEach((b) => index.set(keyOf(b.from), b));

  ['revenue', 'cash'].forEach((metric) => {
    daily[metric].forEach((v, iso) => {
      if (!within(iso, range)) return;
      const b = index.get(keyOf(asDate(iso)));
      if (b) b[metric] += v;
    });
  });
  return out;
}

/* Smooth line that never swings above or below the real values
   (monotone cubic), so a single sale reads as one clean peak. */
function smoothPath(points) {
  const n = points.length;
  if (!n) return '';
  if (n === 1) return 'M' + points[0][0] + ',' + points[0][1];
  const dx = [], slope = [], tangent = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1][0] - points[i][0];
    slope[i] = (points[i + 1][1] - points[i][1]) / dx[i];
  }
  tangent[0] = slope[0];
  tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    tangent[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) { tangent[i] = 0; tangent[i + 1] = 0; continue; }
    const a = tangent[i] / slope[i], b = tangent[i + 1] / slope[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); tangent[i] = t * a * slope[i]; tangent[i + 1] = t * b * slope[i]; }
  }
  let d = 'M' + points[0][0].toFixed(1) + ',' + points[0][1].toFixed(1);
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i], [x1, y1] = points[i + 1], h = dx[i] / 3;
    d += 'C' + (x0 + h).toFixed(1) + ',' + (y0 + tangent[i] * h).toFixed(1) + ' ' +
      (x1 - h).toFixed(1) + ',' + (y1 - tangent[i + 1] * h).toFixed(1) + ' ' + x1.toFixed(1) + ',' + y1.toFixed(1);
  }
  return d;
}

function axisMoney(v) {
  if (v >= 1000000) return '$' + Math.round(v / 100000) / 10 + 'M';
  if (v >= 1000) return '$' + Math.round(v / 100) / 10 + 'k';
  return '$' + Math.round(v);
}

function lineChart(host, rows, metric) {
  host.textContent = '';
  const ns = 'http://www.w3.org/2000/svg';
  const other = metric === 'revenue' ? 'cash' : 'revenue';
  const W = Math.max(host.clientWidth, 280);
  const H = W < 560 ? 200 : 260;
  const ML = 48, MR = 10, MT = 14, MB = 28;
  const plotW = W - ML - MR, plotH = H - MT - MB;

  const max = Math.max.apply(null, rows.map((r) => Math.max(r.revenue, r.cash)).concat([1]));
  const nice = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / nice) * nice;
  const xAt = (i) => ML + (rows.length === 1 ? plotW / 2 : (plotW * i) / (rows.length - 1));
  const yAt = (v) => MT + plotH - (v / top) * plotH;

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'chart agency-svg');
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', (metric === 'revenue' ? 'Revenue' : 'Cash collected') + ' over the selected period');
  const add = (tag, attrs, text) => {
    const n = document.createElementNS(ns, tag);
    Object.keys(attrs).forEach((k) => n.setAttribute(k, String(attrs[k])));
    if (text != null) n.textContent = text;
    svg.appendChild(n);
    return n;
  };

  const defs = add('defs', {});
  const grad = document.createElementNS(ns, 'linearGradient');
  grad.setAttribute('id', 'agencyFill');
  grad.setAttribute('x1', '0'); grad.setAttribute('x2', '0'); grad.setAttribute('y1', '0'); grad.setAttribute('y2', '1');
  [['0%', '.28'], ['100%', '0']].forEach((s) => {
    const stop = document.createElementNS(ns, 'stop');
    stop.setAttribute('offset', s[0]);
    stop.setAttribute('stop-color', 'var(--accent-bright)');
    stop.setAttribute('stop-opacity', s[1]);
    grad.appendChild(stop);
  });
  defs.appendChild(grad);

  for (let i = 0; i <= 4; i++) {
    const v = (top / 4) * i;
    add('line', { class: 'gridline' + (i ? ' soft' : ''), x1: ML, x2: W - MR, y1: yAt(v), y2: yAt(v) });
    add('text', { class: 'tick', x: ML - 8, y: yAt(v) + 3.5, 'text-anchor': 'end' }, axisMoney(v));
  }

  const main = rows.map((r, i) => [xAt(i), yAt(r[metric])]);
  const second = rows.map((r, i) => [xAt(i), yAt(r[other])]);
  const mainPath = smoothPath(main);

  add('path', { class: 'agency-area', d: mainPath + 'L' + xAt(rows.length - 1) + ',' + (MT + plotH) + 'L' + xAt(0) + ',' + (MT + plotH) + 'Z', fill: 'url(#agencyFill)' });
  add('path', { class: 'agency-line-other', d: smoothPath(second) });
  add('path', { class: 'agency-line', d: mainPath });

  const labels = Math.min(rows.length, W < 560 ? 4 : 7);
  const seen = new Set();
  for (let k = 0; k < labels; k++) {
    const i = labels === 1 ? 0 : Math.round((k * (rows.length - 1)) / (labels - 1));
    if (seen.has(i)) continue;
    seen.add(i);
    add('text', { class: 'tick', x: xAt(i), y: MT + plotH + 18, 'text-anchor': k === 0 ? 'start' : k === labels - 1 ? 'end' : 'middle' },
      rows[i].label.replace('Week of ', ''));
  }

  /* Hover: a guide line, a dot on each series, the day's figures. */
  const guide = add('line', { class: 'agency-guide', x1: 0, x2: 0, y1: MT, y2: MT + plotH, opacity: 0 });
  const dotOther = add('circle', { class: 'agency-dot-other', r: 3, cx: 0, cy: 0, opacity: 0 });
  const dot = add('circle', { class: 'agency-dot', r: 4, cx: 0, cy: 0, opacity: 0 });
  const catcher = add('rect', { x: ML, y: 0, width: plotW, height: H, fill: 'none', 'pointer-events': 'all' });

  const mainName = metric === 'revenue' ? 'Revenue' : 'Cash collected';
  const otherName = metric === 'revenue' ? 'Cash collected' : 'Revenue';
  const show = (clientX, clientY) => {
    const box = svg.getBoundingClientRect();
    const x = ((clientX - box.left) / box.width) * W;
    const i = Math.max(0, Math.min(rows.length - 1, Math.round(((x - ML) / plotW) * (rows.length - 1))));
    const r = rows[i];
    guide.setAttribute('x1', xAt(i)); guide.setAttribute('x2', xAt(i)); guide.setAttribute('opacity', 1);
    dot.setAttribute('cx', xAt(i)); dot.setAttribute('cy', yAt(r[metric])); dot.setAttribute('opacity', 1);
    dotOther.setAttribute('cx', xAt(i)); dotOther.setAttribute('cy', yAt(r[other])); dotOther.setAttribute('opacity', 1);
    tip.innerHTML = '<b>' + r.label + '</b><br>' + mainName + ' ' + money(r[metric]) + '<br><span class="tip-muted">' + otherName + ' ' + money(r[other]) + '</span>';
    tip.style.left = clientX + 'px';
    tip.style.top = clientY + 'px';
    tip.classList.add('show');
  };
  const hide = () => {
    guide.setAttribute('opacity', 0);
    dot.setAttribute('opacity', 0); dotOther.setAttribute('opacity', 0);
    tip.classList.remove('show');
  };
  catcher.addEventListener('mousemove', (e) => show(e.clientX, e.clientY));
  catcher.addEventListener('mouseleave', hide);
  catcher.addEventListener('touchstart', (e) => { const t = e.touches[0]; show(t.clientX, t.clientY); }, { passive: true });
  catcher.addEventListener('touchmove', (e) => { const t = e.touches[0]; show(t.clientX, t.clientY); }, { passive: true });
  catcher.addEventListener('touchend', hide);

  host.appendChild(svg);

  const key = el('div', 'agency-key');
  key.appendChild(el('span', 'key-main', mainName));
  key.appendChild(el('span', 'key-other', otherName));
  host.appendChild(key);
}

function renderAgency() {
  const rows = CACHE.allCalls.map((r) => r.record);
  const daily = dailyTotals(rows);
  const metric = HUB.metric;
  const other = metric === 'revenue' ? 'cash' : 'revenue';
  const range = hubRange(daily);

  /* the headline: everything, all time */
  const allTime = { from: new Date(2000, 0, 1), to: TODAY };
  const headline = sumIn(daily[metric], allTime);
  const counterpart = sumIn(daily[other], allTime);
  $('#agencyValue').textContent = money(headline);
  $('#agencyLabel').textContent = (metric === 'revenue' ? 'Total agency revenue' : 'Total cash collected') + ' · all time';
  const share = metric === 'revenue' ? safeDiv(counterpart, headline) : safeDiv(headline, counterpart);
  $('#agencyVersus').textContent = metric === 'revenue'
    ? money(counterpart) + ' cash collected · ' + pct(share) + ' of revenue'
    : money(counterpart) + ' revenue · ' + pct(share) + ' collected';

  document.querySelectorAll('.metric-switch button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.metric === metric));
  });

  /* the quick periods */
  const strip = $('#agencyStrip');
  strip.textContent = '';
  HUB_STRIP.forEach((s) => {
    const cell = el('div', 'strip-cell');
    cell.appendChild(el('span', 'strip-value', money(sumIn(daily[metric], rangeFor(s.key)))));
    cell.appendChild(el('span', 'strip-label', s.label));
    strip.appendChild(cell);
  });

  /* the period buttons and dates */
  document.querySelectorAll('#agencyRanges button').forEach((b) => {
    b.setAttribute('aria-pressed', String(!range.custom && b.dataset.range === HUB.range));
  });
  $('#agencyFrom').value = isoOf(range.from);
  $('#agencyTo').value = isoOf(range.to);
  $('#agencyTo').max = isoOf(TODAY);
  $('#agencyGrain').value = HUB.grain;

  /* the chart */
  const series = buckets(daily, range, HUB.grain);
  lineChart($('#agencyChart'), series, metric);

  const grainWord = { day: 'Daily', week: 'Weekly', month: 'Monthly' }[HUB.grain];
  $('#agencyFootTitle').textContent = metric === 'revenue' ? 'Agency revenue' : 'Cash collected';
  $('#agencyFootSub').textContent = grainWord + ' totals · ' + periodLabel(range);
  $('#agencyFootTotal').textContent = money(sumIn(daily[metric], range));

  return range;
}

function renderHub() {
  const who = [CACHE.me.name || CACHE.me.email, CACHE.me.title || (CACHE.me.isOwner ? 'Owner' : 'Admin')];
  $('#hubWho').textContent = who.join(' · ');

  const range = renderAgency();
  const boards = CACHE.boards;
  const month = rangeFor('mtd');
  $('#hubOffersSub').textContent = periodLabel(range) + ' · pick an offer to see its full dashboard and data.';

  /* ---------- one card per offer ---------- */
  const host = $('#hubBoards');
  host.textContent = '';

  if (!boards.length) {
    host.appendChild(el('p', 'hub-empty', CACHE.me.isOwner
      ? 'No offers yet. Click “New offer” to create your first sales team board.'
      : 'You have not been given any offers yet. Ask the owner for access.'));
  }

  boards.forEach((b) => {
    const rows = boardRows(b.id);
    const m = computeMetrics(rows, range);
    const mm = computeMetrics(rows, month);
    const people = CACHE.rosterCounts[b.id] || 0;
    const href = boardPath(b);

    const card = el('article', 'hub-card');

    const head = el('div', 'hub-card-head');
    head.appendChild(el('span', 'hub-avatar', ''));
    head.lastChild.textContent = (b.name || '?').trim().charAt(0).toUpperCase();

    const titles = el('div', 'hub-card-titles');
    const title = el('a', 'hub-card-name');
    title.href = href;
    title.textContent = b.name;                   // typed by a person — never as markup
    titles.appendChild(title);
    titles.appendChild(el('span', 'hub-meta',
      MONTHS[TODAY.getMonth()] + ': ' + money0(mm.totalRevenue) + ' revenue · ' + money0(mm.totalCash) + ' cash'));
    titles.appendChild(el('span', 'hub-meta', people + (people === 1 ? ' person on the team' : ' people on the team')));
    head.appendChild(titles);

    const open = el('a', 'hub-open', 'Open board');
    open.href = href;
    head.appendChild(open);
    card.appendChild(head);

    const stats = el('div', 'hub-stats');
    [
      ['Cash', money(m.totalCash)],
      ['Revenue', money(m.totalRevenue)],
      ['Deals', int(m.deals)],
      ['Close rate', m.liveCalls ? pct(safeDiv(m.deals, m.liveCalls)) : '—']
    ].forEach((pair) => {
      const s = el('div', 'hub-stat');
      s.appendChild(el('div', 'hub-stat-label', pair[0]));
      s.appendChild(el('div', 'hub-stat-value', pair[1]));
      stats.appendChild(s);
    });
    card.appendChild(stats);

    host.appendChild(card);
  });

}

function initAgency() {
  const pills = $('#agencyRanges');
  HUB_RANGES.forEach((r) => {
    const b = el('button', 'range-pill', r.label);
    b.type = 'button';
    b.dataset.range = r.key;
    b.addEventListener('click', () => {
      HUB.range = r.key;
      HUB.from = '';
      HUB.to = '';
      HUB.grain = defaultGrain(hubRange(dailyTotals(CACHE.allCalls.map((x) => x.record))));
      renderHub();
    });
    pills.appendChild(b);
  });

  document.querySelectorAll('.metric-switch button').forEach((b) => {
    b.addEventListener('click', () => { HUB.metric = b.dataset.metric; renderHub(); });
  });

  const pickDates = () => {
    const from = $('#agencyFrom').value;
    const to = $('#agencyTo').value;
    if (!from || !to || from > to) return;
    HUB.from = from;
    HUB.to = to;
    HUB.grain = defaultGrain({ from: asDate(from), to: asDate(to) });
    renderHub();
  };
  $('#agencyFrom').addEventListener('change', pickDates);
  $('#agencyTo').addEventListener('change', pickDates);

  $('#agencyGrain').addEventListener('change', (e) => { HUB.grain = e.target.value; renderHub(); });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (!$('#hubShell').classList.contains('hidden')) renderAgency(); }, 120);
  });
}

function initHub() {
  initAgency();

  if (CACHE.me.isOwner) {
    const create = $('#createBoardBtn');
    create.classList.remove('hidden');
    create.addEventListener('click', async () => {
      create.disabled = true;
      try {
        const result = await createBoard();
        notify('Offer created. Its code is ' + result.code + '. Opening it now — name it at the top of Add Team.');
        const address = SALES_PATH + '/' + (result.board.slug || result.board.id);
        setTimeout(() => { location.href = address + '?tab=team'; }, 900);
      } catch (err) {
        console.error(err);
        notify(err.message);
        create.disabled = false;
      }
    });

  }

  renderHub();
}
