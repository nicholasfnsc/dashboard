/* ============================================================
   metrics.js — Metrics Tracking (/metrics/<offer>)
   ------------------------------------------------------------
   One board per offer, for the owner and admins given Metrics
   Tracking. VSL and Webinar each have their own metric list.

     top        offer tabs, VSL / Webinar, the week
     cards      the chosen group's metrics for the week, against target
     funnel     each stage of the funnel and the conversion between them
     charts     one metric over time, stage health, call outcomes, cash
     detail     every metric by day — typed-in numbers are edited here,
                sales numbers fill themselves in from the Post Call Form

   "Edit metrics" lets anyone with access add, rename, remove and
   reorder metrics and groups, and choose how each is worked out.
   ============================================================ */

const METRICS_PATH = '/metrics';
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MV = {
  funnel: 'vsl',
  monday: mondayOf(new Date()),
  group: '',
  trendMetric: '',
  trendSpan: 'week',
  editing: false,
  collapsed: new Set()
};

const svgNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, text) {
  const n = document.createElementNS(svgNS, tag);
  Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, String(attrs[k])));
  if (text != null) n.textContent = text;
  return n;
}

const metricsPathFor = (board) => METRICS_PATH + '/' + ((board.directory && board.directory.slug) || board.id);

function shortDay(d) { return MONTHS[d.getMonth()] + ' ' + d.getDate(); }

/* ============================================================
   Render
   ============================================================ */
function metricsContext() {
  const config = metricConfig(MV.funnel);
  const calls = CACHE.calls.filter((c) => (c.funnel || 'vsl') === MV.funnel);
  const calc = metricCalculator(config, calls, CACHE.metrics.values[MV.funnel]);
  const dates = weekDays(MV.monday);
  const days = dates.map(isoDay);
  if (!config.groups.some((g) => g.id === MV.group)) MV.group = config.groups[0] ? config.groups[0].id : '';
  return { config, calls, calc, dates, days };
}

function renderMetrics() {
  const focus = rememberFocus();
  const ctx = metricsContext();

  $('#metricsTitle').textContent = (CACHE.board && CACHE.board.name) || 'Offer';
  document.title = 'Metrics · ' + ((CACHE.board && CACHE.board.name) || 'Offer') + ' · Inevitable Acquisition';
  $('#metricsNotReady').classList.toggle('hidden', CACHE.metrics.ready);

  document.querySelectorAll('#metricsFunnel button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.funnel === MV.funnel)));
  const sunday = ctx.dates[6];
  $('#weekLabel').textContent = shortDay(ctx.dates[0]) + ' – ' + shortDay(sunday) + (sunday.getFullYear() !== TODAY.getFullYear() ? ', ' + sunday.getFullYear() : '');
  $('#weekNext').disabled = ctx.days[0] > isoDay(TODAY);
  $('#weekToday').classList.toggle('hidden', isoDay(MV.monday) === isoDay(mondayOf(TODAY)));

  renderGroupTabs(ctx);
  renderMetricCards(ctx);
  renderFunnel(ctx);
  renderTrend(ctx);
  renderStageHealth(ctx);
  renderMetricOutcomes(ctx);
  renderCashByDay(ctx);

  $('#metricsEdit').textContent = MV.editing ? 'Done editing' : 'Edit metrics';
  $('#metricsEdit').classList.toggle('btn-primary', MV.editing);
  $('#metricsDetailHint').textContent = MV.editing
    ? 'Rename, add, remove or drag metrics. Changes save as you go and apply to this offer’s ' + (MV.funnel === 'vsl' ? 'VSL' : 'Webinar') + ' funnel.'
    : 'Type into the boxes to log a day. Sales numbers fill in from the Post Call Form. Click a target to change it.';
  if (MV.editing) renderEditor(ctx); else renderDetail(ctx);

  restoreFocus(focus);
}

/* Re-rendering must never throw someone out of the box they moved to. */
function rememberFocus() {
  const a = document.activeElement;
  return a && a.dataset && a.dataset.key ? { key: a.dataset.key, start: a.selectionStart, end: a.selectionEnd } : null;
}
function restoreFocus(f) {
  if (!f) return;
  const n = document.querySelector('#metricsShell [data-key="' + f.key.replace(/"/g, '') + '"]');
  if (!n) return;
  n.focus();
  try { if (f.start != null) n.setSelectionRange(f.start, f.end); } catch (e) { /* number inputs */ }
}

/* ---------- group tabs + cards ---------- */
function renderGroupTabs(ctx) {
  const host = $('#metricsGroupTabs');
  host.textContent = '';
  ctx.config.groups.forEach((g) => {
    const b = el('button', 'range-pill');
    b.type = 'button';
    b.textContent = g.name;
    b.setAttribute('aria-pressed', String(g.id === MV.group));
    b.addEventListener('click', () => { MV.group = g.id; renderMetrics(); });
    host.appendChild(b);
  });
}

const UNIT_ICONS = { money: '$', count: '#', percent: '%', ratio: 'x', score: '★' };

function renderMetricCards(ctx) {
  const host = $('#metricsKpis');
  host.textContent = '';
  const group = ctx.config.groups.find((g) => g.id === MV.group);
  if (!group) return;
  group.metrics.forEach((m) => {
    const v = ctx.calc.value(m.id, ctx.days);
    const st = ctx.calc.status(m, v);
    const card = el('div', 'mkpi' + (st ? ' is-' + st : ''));
    const head = el('div', 'mkpi-head');
    const name = el('span', 'mkpi-name');
    name.textContent = m.name;
    head.appendChild(name);
    head.appendChild(el('span', 'mkpi-icon', UNIT_ICONS[m.unit] || '#'));
    card.appendChild(head);
    card.appendChild(el('div', 'mkpi-value', formatMetric(m.unit, v)));
    const sub = el('div', 'mkpi-sub');
    sub.textContent = ctx.calc.describe(m);
    card.appendChild(sub);
    const foot = el('div', 'mkpi-foot');
    if (st) foot.appendChild(el('span', 'mbadge is-' + st, st === 'on' ? 'On target' : 'Behind'));
    if (m.target != null && m.target !== '') foot.appendChild(el('span', 'mkpi-target', 'Target ' + formatMetric(m.unit, Number(m.target))));
    card.appendChild(foot);
    host.appendChild(card);
  });
}

/* ---------- funnel ---------- */
function renderFunnel(ctx) {
  const body = $('#metricsFunnelBody');
  body.textContent = '';
  const stages = (ctx.config.stages || []).map((s) => ({ s, v: ctx.calc.value(s.metric, ctx.days) }));
  if (!stages.length) { body.appendChild(el('p', 'axis-note', 'No funnel stages set. Add them under Edit metrics.')); return; }

  const shape = el('div', 'mfunnel-shape');
  const list = el('div', 'mfunnel-list');
  const n = stages.length;
  stages.forEach((item, i) => {
    const top = 100 - (i * 58) / n;
    const bottom = 100 - ((i + 1) * 58) / n;
    const band = el('div', 'mfunnel-band');
    const inset = (100 - top) / 2;
    const insetB = (100 - bottom) / 2;
    band.style.clipPath = 'polygon(' + inset + '% 0, ' + (100 - inset) + '% 0, ' + (100 - insetB) + '% 100%, ' + insetB + '% 100%)';
    band.style.setProperty('--band', 'color-mix(in srgb, var(--chart-cyan) ' + Math.round(100 - (i * 100) / Math.max(n - 1, 1)) + '%, var(--accent))');
    band.appendChild(el('span', null, item.v == null ? '—' : formatMetric('count', item.v)));
    shape.appendChild(band);

    const row = el('div', 'mfunnel-row');
    const dot = el('span', 'mfunnel-dot');
    dot.style.background = 'color-mix(in srgb, var(--chart-cyan) ' + Math.round(100 - (i * 100) / Math.max(n - 1, 1)) + '%, var(--accent))';
    row.appendChild(dot);
    const text = el('div', 'mfunnel-text');
    const nameEl = el('span', 'mfunnel-name');
    nameEl.textContent = item.s.name;
    text.appendChild(nameEl);
    const sub = el('span', 'mfunnel-sub');
    const prev = i > 0 ? stages[i - 1].v : null;
    sub.textContent = (item.s.sub || '') + (prev && item.v != null ? ' · ' + formatMetric('percent', (item.v / prev) * 100) + ' of ' + stages[i - 1].s.name.toLowerCase() : '');
    text.appendChild(sub);
    row.appendChild(text);
    row.appendChild(el('span', 'mfunnel-value', item.v == null ? '—' : formatMetric('count', item.v)));
    list.appendChild(row);
  });
  body.appendChild(shape);
  body.appendChild(list);
}

/* ---------- charts ---------- */
function chartFrame(width, height) {
  const svg = svgEl('svg', { class: 'chart', viewBox: '0 0 ' + width + ' ' + height, width, height, role: 'img' });
  return svg;
}

function lineChartSimple(host, labels, series, opts) {
  host.textContent = '';
  const W = Math.max(host.clientWidth || 520, 280), H = 210, ML = 46, MR = 10, MT = 12, MB = 26;
  const plotW = W - ML - MR, plotH = H - MT - MB;
  const values = [];
  series.forEach((s) => s.values.forEach((v) => { if (v != null) values.push(v); }));
  if (opts.target != null) values.push(Number(opts.target));
  const max = opts.max != null ? opts.max : Math.max.apply(null, values.concat([1]));
  const nice = Math.pow(10, Math.floor(Math.log10(max || 1)));
  const top = opts.max != null ? opts.max : Math.ceil((max * 1.1) / nice) * nice;
  const x = (i) => ML + (labels.length === 1 ? plotW / 2 : (plotW * i) / (labels.length - 1));
  const y = (v) => MT + plotH - (v / top) * plotH;
  const svg = chartFrame(W, H);

  for (let i = 0; i <= 4; i++) {
    const v = (top / 4) * i;
    svg.appendChild(svgEl('line', { class: 'gridline' + (i ? ' soft' : ''), x1: ML, x2: W - MR, y1: y(v), y2: y(v) }));
    svg.appendChild(svgEl('text', { class: 'tick', x: ML - 8, y: y(v) + 3.5, 'text-anchor': 'end' }, opts.tick(v, top)));
  }
  const every = Math.ceil(labels.length / 7);
  labels.forEach((l, i) => {
    if (i % every === 0 || i === labels.length - 1) svg.appendChild(svgEl('text', { class: 'tick', x: x(i), y: H - 8, 'text-anchor': 'middle' }, l));
  });
  if (opts.target != null && opts.target !== '') {
    svg.appendChild(svgEl('line', { class: 'mtarget-line', x1: ML, x2: W - MR, y1: y(Number(opts.target)), y2: y(Number(opts.target)) }));
  }
  series.forEach((s) => {
    let d = '';
    let pen = false;
    s.values.forEach((v, i) => {
      if (v == null) { pen = false; return; }
      d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1);
      pen = true;
    });
    if (d) svg.appendChild(svgEl('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    s.values.forEach((v, i) => {
      if (v == null) return;
      const dot = svgEl('circle', { cx: x(i), cy: y(v), r: 3.2, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 1.5 });
      bindTip(dot, '<b>' + labels[i] + '</b><br>' + (s.name ? s.name + ' ' : '') + opts.fmt(v));
      svg.appendChild(dot);
    });
  });
  host.appendChild(svg);
  if (opts.legend) {
    const key = el('div', 'agency-key mkey');
    opts.legend.forEach((item) => {
      const span = el('span', 'mkey-item');
      const sw = el('i', null);
      sw.style.background = item.color;
      if (item.dashed) sw.className = 'is-dashed';
      span.appendChild(sw);
      span.appendChild(document.createTextNode(item.name));
      key.appendChild(span);
    });
    host.appendChild(key);
  }
}

function allMetrics(ctx) {
  return ctx.config.groups.reduce((list, g) => list.concat(g.metrics), []);
}

function renderTrend(ctx) {
  const select = $('#trendMetric');
  const metrics = allMetrics(ctx);
  if (!metrics.some((m) => m.id === MV.trendMetric)) {
    const preferred = metrics.find((m) => m.target != null) || metrics[0];
    MV.trendMetric = preferred ? preferred.id : '';
  }
  select.textContent = '';
  ctx.config.groups.forEach((g) => {
    const og = document.createElement('optgroup');
    og.label = g.name;
    g.metrics.forEach((m) => {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = m.name;
      og.appendChild(o);
    });
    select.appendChild(og);
  });
  select.value = MV.trendMetric;
  document.querySelectorAll('#trendSpan button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.span === MV.trendSpan)));

  const m = ctx.calc.find(MV.trendMetric);
  const host = $('#trendChart');
  if (!m) { host.textContent = ''; return; }

  let labels, values;
  if (MV.trendSpan === 'week') {
    labels = ctx.dates.map((d, i) => DAY_NAMES[i] + ' ' + d.getDate());
    values = ctx.days.map((iso) => ctx.calc.value(m.id, [iso]));
  } else {
    labels = [];
    values = [];
    for (let w = 11; w >= 0; w--) {
      const monday = new Date(MV.monday);
      monday.setDate(monday.getDate() - w * 7);
      const days = weekDays(monday).map(isoDay);
      labels.push(shortDay(monday));
      values.push(ctx.calc.value(m.id, days));
    }
  }
  lineChartSimple(host, labels, [{ values, color: 'var(--accent-bright)' }], {
    target: m.target,
    fmt: (v) => formatMetric(m.unit, v),
    tick: (v, top) => axisLabel(m.unit, v, top),
    legend: [{ name: 'Actual', color: 'var(--accent-bright)' }].concat(m.target != null && m.target !== '' ? [{ name: 'Target', color: 'var(--muted)', dashed: true }] : [])
  });
}

function renderStageHealth(ctx) {
  const series = ctx.config.groups.map((g) => ({
    name: g.name,
    color: g.color,
    values: ctx.days.map((iso) => {
      let judged = 0;
      let on = 0;
      g.metrics.forEach((m) => {
        const st = ctx.calc.status(m, ctx.calc.value(m.id, [iso]));
        if (st) { judged++; if (st === 'on') on++; }
      });
      return judged ? (on / judged) * 100 : null;
    })
  }));
  lineChartSimple($('#stageHealthChart'), ctx.dates.map((d, i) => DAY_NAMES[i] + ' ' + d.getDate()), series, {
    max: 100,
    fmt: (v) => Math.round(v) + '% on target',
    tick: (v) => Math.round(v) + '%',
    legend: series.map((s) => ({ name: s.name, color: s.color }))
  });
}

function renderMetricOutcomes(ctx) {
  const body = $('#metricOutcomesBody');
  body.textContent = '';
  const counts = ctx.calc.sales(ctx.days[0], ctx.days[6]).outcomes;
  const slices = OUTCOMES.filter((o) => o.isCall).map((o) => ({ label: o.short, color: o.color, value: counts[o.key] || 0 }));
  const row = el('div', 'donut-row');
  row.appendChild(donut(slices, { label: 'Calls this week by result', dashedWhenEmpty: true }));
  row.appendChild(legend(slices));
  body.appendChild(row);
}

function renderCashByDay(ctx) {
  const body = $('#metricCashBody');
  body.textContent = '';
  const rows = ctx.dates.map((d, i) => ({ label: DAY_NAMES[i] + ' ' + d.getDate(), value: ctx.calc.sales(ctx.days[i], ctx.days[i]).cash }));
  const total = rows.reduce((s, r) => s + r.value, 0);
  body.appendChild(barChart(rows, 'day'));
  body.appendChild(el('div', 'axis-note', 'Total ' + money0(total) + ' collected this week from ' + (MV.funnel === 'vsl' ? 'VSL' : 'Webinar') + ' calls'));
}

/* ---------- funnel detail tables ---------- */
function sparkline(values, color) {
  const W = 64, H = 20;
  const got = values.filter((v) => v != null);
  const svg = svgEl('svg', { class: 'mspark', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, 'aria-hidden': 'true' });
  if (got.length < 2) { svg.appendChild(svgEl('line', { x1: 2, x2: W - 2, y1: H / 2, y2: H / 2, class: 'mspark-empty' })); return svg; }
  const min = Math.min.apply(null, got), max = Math.max.apply(null, got);
  const y = (v) => (max === min ? H / 2 : H - 3 - ((v - min) / (max - min)) * (H - 6));
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v == null) { pen = false; return; }
    d += (pen ? 'L' : 'M') + (2 + (i * (W - 4)) / (values.length - 1)).toFixed(1) + ',' + y(v).toFixed(1);
    pen = true;
  });
  svg.appendChild(svgEl('path', { d, fill: 'none', stroke: color, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }));
  return svg;
}

function numberBox(unit, value, attrs) {
  const wrap = el('label', 'mnum');
  if (unitPrefix(unit)) wrap.appendChild(el('span', 'mnum-affix', unitPrefix(unit)));
  const input = document.createElement('input');
  input.type = 'number';
  input.step = 'any';
  input.inputMode = 'decimal';
  input.value = value == null ? '' : String(Math.round(value * 100) / 100);
  Object.keys(attrs || {}).forEach((k) => { if (k === 'key') input.dataset.key = attrs[k]; else input.setAttribute(k, attrs[k]); });
  wrap.appendChild(input);
  if (unitSuffix(unit)) wrap.appendChild(el('span', 'mnum-affix', unitSuffix(unit)));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
  return { wrap, input };
}

const parseBox = (input) => {
  const raw = input.value.trim();
  if (raw === '') return { empty: true };
  const v = Number(raw);
  return Number.isFinite(v) ? { value: v } : { bad: true };
};

function renderDetail(ctx) {
  const host = $('#metricsDetail');
  host.textContent = '';
  const today = isoDay(TODAY);
  const canWrite = CACHE.metrics.ready;

  ctx.config.groups.forEach((g) => {
    const judged = g.metrics.map((m) => ctx.calc.status(m, ctx.calc.value(m.id, ctx.days))).filter(Boolean);
    const onCount = judged.filter((s) => s === 'on').length;

    const panel = el('section', 'panel mgroup' + (MV.collapsed.has(g.id) ? ' is-collapsed' : ''));
    panel.style.setProperty('--group', g.color || 'var(--accent-bright)');

    const head = el('button', 'mgroup-head');
    head.type = 'button';
    const title = el('span', 'mgroup-title');
    title.textContent = g.name;
    head.appendChild(title);
    head.appendChild(el('span', 'mgroup-count', g.metrics.length + (g.metrics.length === 1 ? ' metric' : ' metrics')));
    head.appendChild(el('span', 'mgroup-spacer', ''));
    head.appendChild(el('span', 'mgroup-status', judged.length ? onCount + ' of ' + judged.length + ' on target' : 'No targets hit yet'));
    head.appendChild(el('span', 'mgroup-chevron', '&#8964;'));
    head.addEventListener('click', () => {
      if (MV.collapsed.has(g.id)) MV.collapsed.delete(g.id); else MV.collapsed.add(g.id);
      panel.classList.toggle('is-collapsed');
    });
    panel.appendChild(head);

    const scroll = el('div', 'table-scroll mtable-scroll');
    const table = el('table', 'mtable');
    const thead = el('thead');
    const hr = el('tr');
    hr.appendChild(el('th', 'mcol-name', 'Metric'));
    ctx.dates.forEach((d, i) => {
      const th = el('th', 'mcol-day' + (ctx.days[i] === today ? ' is-today' : ''));
      th.appendChild(el('span', null, DAY_NAMES[i]));
      th.appendChild(el('small', null, shortDay(d)));
      hr.appendChild(th);
    });
    ['Week', 'Target', '', 'Trend'].forEach((t, i) => hr.appendChild(el('th', ['mcol-week', 'mcol-target', 'mcol-dot', 'mcol-trend'][i], t)));
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = el('tbody');
    g.metrics.forEach((m) => {
      const tr = el('tr', 'mrow-' + m.source);
      const nameCell = el('td', 'mcol-name');
      const nm = el('span', 'mname');
      nm.textContent = m.name;
      nameCell.appendChild(nm);
      const how = el('small', 'mhow');
      how.textContent = m.source === 'input' ? 'Typed in' : ctx.calc.describe(m);
      nameCell.appendChild(how);
      tr.appendChild(nameCell);

      ctx.days.forEach((iso) => {
        const td = el('td', 'mcol-day' + (iso === today ? ' is-today' : ''));
        if (m.source === 'input') {
          const current = CACHE.metrics.values[MV.funnel].get(m.id + '|' + iso);
          const box = numberBox(m.unit, current, { key: 'e|' + m.id + '|' + iso, 'aria-label': m.name + ' on ' + iso });
          box.input.disabled = !canWrite || iso > today;
          box.input.addEventListener('change', () => saveEntryFrom(box.input, m, iso, current));
          td.appendChild(box.wrap);
        } else {
          td.textContent = formatMetric(m.unit, ctx.calc.value(m.id, [iso]));
          if (td.textContent === '—') td.classList.add('is-empty');
        }
        tr.appendChild(td);
      });

      const week = ctx.calc.value(m.id, ctx.days);
      const st = ctx.calc.status(m, week);
      tr.appendChild(el('td', 'mcol-week' + (st ? ' is-' + st : ''), formatMetric(m.unit, week)));

      const targetCell = el('td', 'mcol-target');
      const tbox = numberBox(m.unit, m.target === '' ? null : m.target, { key: 't|' + m.id, 'aria-label': 'Target for ' + m.name, placeholder: '—' });
      tbox.input.disabled = !canWrite;
      tbox.input.title = m.good === 'down' ? 'Lower is better' : 'Higher is better';
      tbox.input.addEventListener('change', () => saveTargetFrom(tbox.input, m));
      targetCell.appendChild(tbox.wrap);
      tr.appendChild(targetCell);

      const dotCell = el('td', 'mcol-dot');
      const dot = el('span', 'mdot' + (st ? ' is-' + st : ''));
      dot.title = st === 'on' ? 'On target' : st === 'behind' ? 'Behind target' : 'No target or no data yet';
      dotCell.appendChild(dot);
      tr.appendChild(dotCell);

      const trendCell = el('td', 'mcol-trend');
      const weeks = [];
      for (let w = 7; w >= 0; w--) {
        const monday = new Date(MV.monday);
        monday.setDate(monday.getDate() - w * 7);
        weeks.push(ctx.calc.value(m.id, weekDays(monday).map(isoDay)));
      }
      trendCell.appendChild(sparkline(weeks, g.color || 'var(--accent-bright)'));
      tr.appendChild(trendCell);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    scroll.appendChild(table);
    panel.appendChild(scroll);
    host.appendChild(panel);
  });
}

async function saveEntryFrom(input, m, iso, before) {
  const parsed = parseBox(input);
  if (parsed.bad) { input.value = before == null ? '' : String(before); return; }
  const value = parsed.empty ? null : parsed.value;
  const funnel = MV.funnel;
  const map = CACHE.metrics.values[funnel];
  const key = m.id + '|' + iso;
  const previous = map.has(key) ? map.get(key) : null;
  if (value === previous) return;
  if (value == null) map.delete(key); else map.set(key, value);
  renderMetrics();
  try {
    await saveMetricEntry(funnel, m.id, iso, value);
  } catch (err) {
    console.error(err);
    if (previous == null) map.delete(key); else map.set(key, previous);
    renderMetrics();
    notify("Couldn't save that number — check your connection and try again.");
  }
}

async function saveTargetFrom(input, m) {
  const parsed = parseBox(input);
  if (parsed.bad) { renderMetrics(); return; }
  const target = parsed.empty ? null : parsed.value;
  try {
    await updateMetricConfig(MV.funnel, (config) => {
      config.groups.forEach((g) => g.metrics.forEach((x) => { if (x.id === m.id) x.target = target; }));
    });
  } catch (err) {
    console.error(err);
    notify("Couldn't save that target — check your connection and try again.");
  }
  renderMetrics();
}

/* ============================================================
   Edit metrics
   ============================================================ */
let editTimer = 0;
function saveConfigSoon(change, rerender) {
  /* Apply locally at once so typing feels instant, then save. */
  change(metricConfigForEdit());
  clearTimeout(editTimer);
  const funnel = MV.funnel;
  const snapshot = JSON.parse(JSON.stringify(CACHE.metrics.configs[funnel]));
  editTimer = setTimeout(async () => {
    try {
      await updateMetricConfig(funnel, (config) => {
        config.groups = snapshot.groups;
        config.stages = snapshot.stages;
      });
    } catch (err) {
      console.error(err);
      notify("Couldn't save that change — check your connection and try again.");
    }
  }, 500);
  if (rerender) renderMetrics();
}

function metricConfigForEdit() {
  if (!CACHE.metrics.configs[MV.funnel] || !Array.isArray(CACHE.metrics.configs[MV.funnel].groups)) {
    CACHE.metrics.configs[MV.funnel] = templateFor(MV.funnel);
  }
  return CACHE.metrics.configs[MV.funnel];
}

const newId = (prefix) => prefix + '_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);

function selectBox(options, value, label) {
  const s = document.createElement('select');
  s.className = 'role-select';
  s.setAttribute('aria-label', label);
  options.forEach((o) => {
    if (o.group) {
      const og = document.createElement('optgroup');
      og.label = o.group;
      o.options.forEach((x) => { const opt = document.createElement('option'); opt.value = x.value; opt.textContent = x.label; og.appendChild(opt); });
      s.appendChild(og);
    } else {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      s.appendChild(opt);
    }
  });
  s.value = value;
  return s;
}

/* Everything a calculation can use: this funnel's metrics and the sales board. */
function operandOptions(config, exceptId) {
  return config.groups.map((g) => ({
    group: g.name,
    options: g.metrics.filter((m) => m.id !== exceptId).map((m) => ({ value: m.id, label: m.name }))
  })).concat([{ group: 'From the sales board', options: Object.keys(SALES_SOURCES).map((k) => ({ value: 'sales.' + k, label: SALES_SOURCES[k].label })) }]);
}

function renderEditor(ctx) {
  const host = $('#metricsDetail');
  host.textContent = '';
  const config = metricConfigForEdit();

  config.groups.forEach((g) => {
    const panel = el('section', 'panel mgroup medit-group');
    panel.style.setProperty('--group', g.color || 'var(--accent-bright)');

    const head = el('div', 'medit-head');
    const nameInput = document.createElement('input');
    nameInput.className = 'medit-name medit-group-name';
    nameInput.value = g.name;
    nameInput.dataset.key = 'gname|' + g.id;
    nameInput.setAttribute('aria-label', 'Group name');
    nameInput.addEventListener('input', () => saveConfigSoon((c) => { c.groups.find((x) => x.id === g.id).name = nameInput.value.trim() || 'Untitled group'; }));
    nameInput.addEventListener('change', () => renderMetrics());
    head.appendChild(nameInput);

    const colors = el('div', 'medit-colors');
    GROUP_COLORS.forEach((c) => {
      const sw = el('button', 'medit-swatch' + (c === g.color ? ' is-on' : ''));
      sw.type = 'button';
      sw.style.background = c;
      sw.setAttribute('aria-label', 'Group colour');
      sw.addEventListener('click', () => saveConfigSoon((cfg) => { cfg.groups.find((x) => x.id === g.id).color = c; }, true));
      colors.appendChild(sw);
    });
    head.appendChild(colors);

    const removeGroup = el('button', 'link-btn danger', 'Remove group');
    removeGroup.type = 'button';
    removeGroup.addEventListener('click', () => {
      if (!window.confirm('Remove the group “' + g.name + '” and its ' + g.metrics.length + ' metrics?\n\nNumbers already typed in are kept, so adding a metric back brings them back.')) return;
      saveConfigSoon((c) => { c.groups = c.groups.filter((x) => x.id !== g.id); }, true);
    });
    head.appendChild(removeGroup);
    panel.appendChild(head);

    const list = el('div', 'medit-list');
    g.metrics.forEach((m) => list.appendChild(editorRow(config, g, m)));
    makeSortable(list, '.medit-row', (order) => {
      saveConfigSoon((c) => {
        const grp = c.groups.find((x) => x.id === g.id);
        grp.metrics = reorderBy(grp.metrics, order);
      }, true);
    });
    panel.appendChild(list);

    const add = el('button', 'link-btn hub-add-row', '+ Add metric');
    add.type = 'button';
    add.addEventListener('click', () => {
      const id = newId('m');
      saveConfigSoon((c) => {
        c.groups.find((x) => x.id === g.id).metrics.push({ id, name: 'New metric', source: 'input', unit: 'count', target: null, good: 'up' });
      }, true);
      const fresh = document.querySelector('#metricsDetail [data-key="mname|' + id + '"]');
      if (fresh) { fresh.focus(); fresh.select(); }
    });
    panel.appendChild(add);
    host.appendChild(panel);
  });

  const addGroup = el('button', 'btn-export medit-add-group', '+ Add group');
  addGroup.type = 'button';
  addGroup.addEventListener('click', () => {
    const id = newId('g');
    saveConfigSoon((c) => {
      c.groups.push({ id, name: 'New group', color: GROUP_COLORS[c.groups.length % GROUP_COLORS.length], metrics: [] });
    }, true);
    const fresh = document.querySelector('#metricsDetail [data-key="gname|' + id + '"]');
    if (fresh) { fresh.focus(); fresh.select(); }
  });
  host.appendChild(addGroup);

  host.appendChild(stagesEditor(config));
}

function editorRow(config, g, m) {
  const row = el('div', 'medit-row');
  row.dataset.id = m.id;
  row.appendChild(dragHandle(m.name));

  const update = (fn, rerender) => saveConfigSoon((c) => {
    c.groups.forEach((grp) => grp.metrics.forEach((x) => { if (x.id === m.id) fn(x); }));
  }, rerender);

  const name = document.createElement('input');
  name.className = 'medit-name';
  name.value = m.name;
  name.dataset.key = 'mname|' + m.id;
  name.setAttribute('aria-label', 'Metric name');
  name.addEventListener('input', () => update((x) => { x.name = name.value.trim() || 'Untitled metric'; }));
  row.appendChild(name);

  const source = selectBox([
    { value: 'input', label: 'Typed in' },
    { value: 'sales', label: 'From the sales board' },
    { value: 'formula', label: 'Calculated (A ÷ B)' }
  ], m.source, 'How it is worked out');
  source.addEventListener('change', () => update((x) => {
    x.source = source.value;
    if (x.source === 'sales') { x.key = x.key && SALES_SOURCES[x.key] ? x.key : 'callsBooked'; x.unit = SALES_SOURCES[x.key].unit; }
    if (x.source === 'formula') { x.a = x.a || 'sales.revenue'; x.b = x.b || 'sales.deals'; if (x.unit === 'count') x.unit = 'money'; }
  }, true));
  row.appendChild(source);

  const detail = el('div', 'medit-detail');
  if (m.source === 'input') {
    const unit = selectBox(Object.keys(METRIC_UNITS).map((k) => ({ value: k, label: METRIC_UNITS[k].label })), m.unit, 'Kind of number');
    unit.addEventListener('change', () => update((x) => { x.unit = unit.value; }, true));
    detail.appendChild(unit);
  } else if (m.source === 'sales') {
    const key = selectBox(Object.keys(SALES_SOURCES).map((k) => ({ value: k, label: SALES_SOURCES[k].label })), m.key, 'Sales number');
    key.addEventListener('change', () => update((x) => { x.key = key.value; x.unit = SALES_SOURCES[key.value].unit; }, true));
    detail.appendChild(key);
  } else {
    const a = selectBox(operandOptions(config, m.id), m.a, 'Divide this');
    const b = selectBox(operandOptions(config, m.id), m.b, 'By this');
    const unit = selectBox([
      { value: 'money', label: 'as money' },
      { value: 'percent', label: 'as a percent' },
      { value: 'ratio', label: 'as a multiple (x)' },
      { value: 'count', label: 'as a number' }
    ], m.unit, 'Show it');
    a.addEventListener('change', () => update((x) => { x.a = a.value; }, true));
    b.addEventListener('change', () => update((x) => { x.b = b.value; }, true));
    unit.addEventListener('change', () => update((x) => { x.unit = unit.value; }, true));
    detail.appendChild(a);
    detail.appendChild(el('span', 'medit-op', '÷'));
    detail.appendChild(b);
    detail.appendChild(unit);
  }
  row.appendChild(detail);

  const good = selectBox([{ value: 'up', label: 'Higher is better' }, { value: 'down', label: 'Lower is better' }], m.good || 'up', 'Which way is good');
  good.addEventListener('change', () => update((x) => { x.good = good.value; }, true));
  row.appendChild(good);

  const remove = el('button', 'link-btn danger', 'Remove');
  remove.type = 'button';
  remove.addEventListener('click', () => {
    if (!window.confirm('Remove “' + m.name + '”?\n\nNumbers already typed in are kept.')) return;
    saveConfigSoon((c) => {
      c.groups.forEach((grp) => { grp.metrics = grp.metrics.filter((x) => x.id !== m.id); });
    }, true);
  });
  row.appendChild(remove);
  return row;
}

function stagesEditor(config) {
  const panel = el('section', 'panel medit-stages');
  const head = el('div', 'panel-head');
  head.appendChild(el('h3', null, 'Funnel stages'));
  head.appendChild(el('p', null, 'The steps shown in the funnel diagram, top to bottom.'));
  panel.appendChild(head);

  const list = el('div', 'medit-list');
  (config.stages || []).forEach((s, i) => {
    const row = el('div', 'medit-row medit-stage');
    row.dataset.id = 'stage' + i;
    row.appendChild(dragHandle(s.name));
    const name = document.createElement('input');
    name.className = 'medit-name';
    name.value = s.name;
    name.dataset.key = 'sname|' + i;
    name.setAttribute('aria-label', 'Stage name');
    name.addEventListener('input', () => saveConfigSoon((c) => { c.stages[i].name = name.value.trim() || 'Stage'; }));
    row.appendChild(name);
    const sub = document.createElement('input');
    sub.className = 'medit-name medit-sub';
    sub.value = s.sub || '';
    sub.placeholder = 'Short description';
    sub.dataset.key = 'ssub|' + i;
    sub.addEventListener('input', () => saveConfigSoon((c) => { c.stages[i].sub = sub.value; }));
    row.appendChild(sub);
    const metric = selectBox(operandOptions(config), s.metric, 'Stage number');
    metric.addEventListener('change', () => saveConfigSoon((c) => { c.stages[i].metric = metric.value; }, true));
    row.appendChild(metric);
    const remove = el('button', 'link-btn danger', 'Remove');
    remove.type = 'button';
    remove.addEventListener('click', () => saveConfigSoon((c) => { c.stages.splice(i, 1); }, true));
    row.appendChild(remove);
    list.appendChild(row);
  });
  makeSortable(list, '.medit-row', (order) => {
    saveConfigSoon((c) => { c.stages = order.map((id) => c.stages[Number(id.slice(5))]).filter(Boolean); }, true);
  });
  panel.appendChild(list);

  const add = el('button', 'link-btn hub-add-row', '+ Add stage');
  add.type = 'button';
  add.addEventListener('click', () => saveConfigSoon((c) => {
    c.stages = c.stages || [];
    c.stages.push({ name: 'New stage', sub: '', metric: 'sales.deals' });
  }, true));
  panel.appendChild(add);
  return panel;
}

/* ============================================================
   Start
   ============================================================ */
function paintMetricsOffers() {
  const nav = $('#metricsOffers');
  nav.textContent = '';
  nav.classList.toggle('hidden', CACHE.boards.length < 2);
  CACHE.boards.forEach((b) => {
    const a = el('a', 'offer-tab');
    a.href = metricsPathFor(b) + '?funnel=' + MV.funnel;
    a.textContent = b.name;
    if (b.id === CACHE.boardId) a.setAttribute('aria-current', 'page');
    nav.appendChild(a);
  });
}

function syncMetricsAddress() {
  const params = new URLSearchParams();
  params.set('funnel', MV.funnel);
  if (isoDay(MV.monday) !== isoDay(mondayOf(TODAY))) params.set('week', isoDay(MV.monday));
  history.replaceState(null, '', metricsPathFor(CACHE.board) + '?' + params.toString());
  paintMetricsOffers();
}

function initMetrics() {
  const params = new URLSearchParams(location.search);
  if (params.get('funnel') === 'webinar') MV.funnel = 'webinar';
  if (/^\d{4}-\d{2}-\d{2}$/.test(params.get('week') || '')) MV.monday = mondayOf(asDate(params.get('week')));

  const funnel = $('#metricsFunnel');
  METRIC_FUNNELS.forEach((f) => {
    const b = el('button', null, f.label);
    b.type = 'button';
    b.dataset.funnel = f.key;
    b.addEventListener('click', () => { MV.funnel = f.key; MV.group = ''; syncMetricsAddress(); renderMetrics(); });
    funnel.appendChild(b);
  });

  const moveWeek = (weeks) => {
    const d = new Date(MV.monday);
    d.setDate(d.getDate() + weeks * 7);
    MV.monday = weeks === 0 ? mondayOf(TODAY) : d;
    syncMetricsAddress();
    renderMetrics();
  };
  $('#weekPrev').addEventListener('click', () => moveWeek(-1));
  $('#weekNext').addEventListener('click', () => moveWeek(1));
  $('#weekToday').addEventListener('click', () => moveWeek(0));

  $('#trendMetric').addEventListener('change', (e) => { MV.trendMetric = e.target.value; renderMetrics(); });
  document.querySelectorAll('#trendSpan button').forEach((b) => b.addEventListener('click', () => { MV.trendSpan = b.dataset.span; renderMetrics(); }));

  $('#metricsEdit').addEventListener('click', () => {
    if (!MV.editing && !CACHE.metrics.ready) { notify('Run supabase/metrics.sql in Supabase first, then metrics can be edited.'); return; }
    MV.editing = !MV.editing;
    renderMetrics();
  });

  syncMetricsAddress();
  renderMetrics();

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (!$('#metricsShell').classList.contains('hidden')) { renderTrend(metricsContext()); renderStageHealth(metricsContext()); } }, 150);
  });

  /* Keep up with calls logged and numbers typed by everyone else. */
  let last = '';
  let busy = false;
  const poll = async () => {
    if (busy || document.hidden || MV.editing) return;
    const typing = document.activeElement && document.activeElement.closest && document.activeElement.closest('#metricsShell input');
    if (typing) return;
    busy = true;
    try {
      const now = await metricsSignature();
      if (last && now !== last) {
        await loadMetrics(CACHE.boardId);
        renderMetrics();
      }
      last = now;
    } catch (err) {
      /* a blip; the next tick catches up */
    } finally {
      busy = false;
    }
  };
  poll();
  setInterval(poll, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
}
