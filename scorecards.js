/* ============================================================
   scorecards.js — Rep Daily Numbers
   ------------------------------------------------------------
   Every rep's daily KPIs, the week laid out day by day, and where
   the week is heading. Reps type their numbers each morning; the
   metric list and the targets belong to whoever runs the board.

   Worked out rather than typed:

     daily pace    the week's total over the days filled in
     weekly pace   the week's total
     monthly pace  the week's total, four weeks on
     target %      the week's total against the weekly target
     actual %      the week's total against the metric it converts
                   from — connections out of dials, closes out of
                   bookings — chosen per metric

   Each week is its own row in the database, so last week is one
   click away and nothing is ever written over.
   ============================================================ */

const SCORE = { settings: null, weeks: [], week: '', saveTimer: 0, settingsTimer: 0, ready: true };

const SCORE_ROLES = [
  { key: 'setter', title: 'Setter Scorecard' },
  { key: 'closer', title: 'Closer Scorecard' }
];

const SCORE_DAYS = ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'];

/* The rows his team runs on, until they are changed. */
const SCORE_DEFAULTS = {
  setter: [
    { id: 's-dials', name: 'Dials', kpi: 0, weekly: 0, monthly: 0, money: false, from: '' },
    { id: 's-connections', name: 'Connections (calls answered)', kpi: 0, weekly: 0, monthly: 0, money: false, from: 's-dials' },
    { id: 's-bookings', name: 'Bookings / triages', kpi: 0, weekly: 0, monthly: 0, money: false, from: 's-connections' },
    { id: 's-closes', name: 'Total closes', kpi: 0, weekly: 0, monthly: 0, money: false, from: 's-bookings' },
    { id: 's-commission', name: 'Est commission', kpi: 0, weekly: 0, monthly: 0, money: true, from: '' }
  ],
  closer: [
    { id: 'c-shown', name: 'Calls shown', kpi: 0, weekly: 0, monthly: 0, money: false, from: '' },
    { id: 'c-taken', name: 'Calls taken', kpi: 0, weekly: 0, monthly: 0, money: false, from: 'c-shown' },
    { id: 'c-pitches', name: 'Pitches', kpi: 0, weekly: 0, monthly: 0, money: false, from: 'c-taken' },
    { id: 'c-second', name: '2nd calls booked', kpi: 0, weekly: 0, monthly: 0, money: false, from: 'c-taken' },
    { id: 'c-closed', name: 'Closed', kpi: 0, weekly: 0, monthly: 0, money: false, from: 'c-pitches' },
    { id: 'c-commission', name: 'Est commission', kpi: 0, weekly: 0, monthly: 0, money: true, from: '' }
  ]
};

const scoreId = (role) => role.charAt(0) + '-' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
const canSetTargets = () => canManage();
const canTypeNumbers = () => canManage() || CACHE.role === 'rep';

/* ---------- weeks ---------- */
/* The Monday of whatever week a day falls in. */
function scoreMonday(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const back = (date.getDay() + 6) % 7;                 // Sunday counts as the end
  date.setDate(date.getDate() - back);
  return scoreIso(date);
}

function scoreIso(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function scoreToday() {
  try { return zoneNow(mainClockZone().zone).day; } catch (e) { return scoreIso(new Date()); }
}

function scoreWeekDays(monday) {
  const [y, m, d] = monday.split('-').map(Number);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(y, m - 1, d + i);
    out.push({ iso: scoreIso(date), label: SCORE_DAYS[i], month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(), date: date.getDate() });
  }
  return out;
}

function weekLabel(monday) {
  const days = scoreWeekDays(monday);
  const first = days[0];
  const last = days[6];
  return first.month.charAt(0) + first.month.slice(1).toLowerCase() + ' ' + first.date + ' – ' +
    last.month.charAt(0) + last.month.slice(1).toLowerCase() + ' ' + last.date;
}

function scoreWeek() {
  return SCORE.weeks.find((w) => w.week === SCORE.week) || null;
}

function weekNumbers() {
  const week = scoreWeek();
  return (week && week.content) || {};
}

/* ---------- the figures ---------- */
const scoreNumber = (v) => (Number.isFinite(Number(v)) && String(v).trim() !== '' ? Number(v) : null);

function metricDays(rep, metricId) {
  const numbers = weekNumbers();
  const mine = (numbers[rep] || {})[metricId] || {};
  return scoreWeekDays(SCORE.week).map((day) => scoreNumber(mine[day.iso]));
}

function metricFigures(rep, metric) {
  const values = metricDays(rep, metric.id).filter((v) => v !== null);
  const total = values.reduce((sum, v) => sum + v, 0);
  const filled = values.length;
  return {
    total,
    daily: filled ? total / filled : 0,
    weekly: total,
    monthly: total * 4,
    filled
  };
}

function metricTotalOf(rep, metricId, role) {
  if (!metricId) return null;
  const metric = (SCORE.settings[role] || []).find((m) => m.id === metricId);
  if (!metric) return null;
  return metricFigures(rep, metric).total;
}

const scoreMoney = (n) => '$' + (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('en-US');
const scoreCount = (n) => {
  const value = Number(n) || 0;
  return Math.abs(value - Math.round(value)) < 0.05 ? String(Math.round(value)) : value.toFixed(1);
};
const scorePercent = (n) => (Math.round((Number(n) || 0) * 1000) / 10) + '%';

/* ---------- saving ---------- */
function numbersChanged() {
  const week = SCORE.week;
  const content = weekNumbers();
  const holder = SCORE.weeks.find((w) => w.week === week);
  if (holder) holder.content = content;
  $('#scoreSaved').textContent = 'Saving…';
  clearTimeout(SCORE.saveTimer);
  SCORE.saveTimer = setTimeout(async () => {
    try {
      await saveScorecardWeek(CACHE.boardId, week, content);
      $('#scoreSaved').textContent = 'Saved';
    } catch (err) {
      console.error(err);
      $('#scoreSaved').textContent = scoreProblem(err);
    }
  }, 600);
}

function settingsChanged() {
  if (!canSetTargets()) return;
  $('#scoreSaved').textContent = 'Saving…';
  clearTimeout(SCORE.settingsTimer);
  SCORE.settingsTimer = setTimeout(async () => {
    try {
      await saveScorecardSettings(CACHE.boardId, SCORE.settings);
      $('#scoreSaved').textContent = 'Saved';
    } catch (err) {
      console.error(err);
      $('#scoreSaved').textContent = scoreProblem(err);
    }
  }, 600);
}

const scoreProblem = (err) => (/relation|does not exist|schema cache/i.test(String(err.message || ''))
  ? 'Not saved — run supabase/scorecards.sql first'
  : 'Not saved — check your connection');

/* ---------- small pieces ---------- */
function scoreBox(value, onChange, opts) {
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.className = 'sc-in' + (opts && opts.cls ? ' ' + opts.cls : '');
  input.value = value === 0 || value ? String(value) : '';
  input.setAttribute('aria-label', (opts && opts.label) || 'Number');
  if (opts && opts.readOnly) {
    input.readOnly = true;
    input.classList.add('is-readonly');
  }
  input.addEventListener('change', () => {
    const raw = input.value.replace(/[^0-9.\-]/g, '');
    onChange(raw === '' ? null : Number(raw) || 0);
  });
  return input;
}

function scoreCell(text, cls) {
  const cell = el('span', 'sc-cell' + (cls ? ' ' + cls : ''));
  cell.textContent = text;
  return cell;
}

/* ---------- one metric row for one rep ---------- */
function metricRow(role, metric, rep, index, first) {
  const row = el('div', 'sc-row');
  row.dataset.id = metric.id;

  const name = el('span', 'sc-cell sc-name');
  if (first) name.textContent = rep;
  row.appendChild(name);

  const label = el('span', 'sc-cell sc-metric');
  if (canSetTargets()) {
    label.appendChild(dragHandle(metric.name));
    const box = scoreBox(metric.name, () => {}, { label: 'Metric name' });
    box.value = metric.name;
    box.classList.add('sc-metric-name');
    box.addEventListener('change', () => { metric.name = box.value; settingsChanged(); renderScorecards(); });
    label.appendChild(box);
    const drop = el('button', 'sc-x', '×');
    drop.type = 'button';
    drop.title = 'Remove ' + metric.name;
    drop.setAttribute('aria-label', 'Remove ' + metric.name);
    drop.addEventListener('click', () => {
      if (!window.confirm('Remove "' + metric.name + '" from the ' + role + ' scorecard?')) return;
      SCORE.settings[role] = SCORE.settings[role].filter((m) => m.id !== metric.id);
      settingsChanged();
      renderScorecards();
    });
    label.appendChild(drop);
  } else {
    label.appendChild(el('span', 'sc-metric-plain', metric.name));
  }
  row.appendChild(label);

  /* the daily KPI — the number the day is measured against */
  const kpi = el('span', 'sc-cell');
  kpi.appendChild(scoreBox(metric.kpi || '', (v) => {
    metric.kpi = v || 0;
    settingsChanged();
    renderScorecards();
  }, { label: 'Daily KPI for ' + metric.name, cls: 'sc-kpi', readOnly: !canSetTargets() }));
  row.appendChild(kpi);

  /* the seven days */
  const numbers = weekNumbers();
  const today = scoreToday();
  scoreWeekDays(SCORE.week).forEach((day) => {
    const cell = el('span', 'sc-cell sc-day' + (day.iso === today ? ' is-today' : ''));
    const mine = numbers[rep] || (numbers[rep] = {});
    const perMetric = mine[metric.id] || (mine[metric.id] = {});
    cell.appendChild(scoreBox(perMetric[day.iso] == null ? '' : perMetric[day.iso], (v) => {
      if (v === null) delete perMetric[day.iso]; else perMetric[day.iso] = v;
      numbersChanged();
      paintScoreFigures();
    }, { label: metric.name + ' on ' + day.label, cls: 'sc-num', readOnly: !canTypeNumbers() }));
    row.appendChild(cell);
  });

  /* what those days add up to */
  const figures = metricFigures(rep, metric);
  const show = metric.money ? scoreMoney : scoreCount;
  ['daily', 'weekly', 'monthly'].forEach((key) => {
    const cell = scoreCell(show(figures[key]), 'sc-pace');
    cell.dataset.pace = rep + '|' + metric.id + '|' + key;
    row.appendChild(cell);
  });

  /* the targets, which fill themselves in from the KPI */
  [['weekly', 5], ['monthly', 21]].forEach(([key, days]) => {
    const cell = el('span', 'sc-cell');
    const suggested = metric.kpi ? metric.kpi * days : '';
    const box = scoreBox(metric[key] || '', (v) => {
      metric[key] = v || 0;
      settingsChanged();
      renderScorecards();
    }, { label: key + ' target for ' + metric.name, cls: 'sc-target', readOnly: !canSetTargets() });
    if (!metric[key] && suggested) {
      box.placeholder = String(suggested);
      box.title = 'Empty means ' + suggested + ' — the daily KPI across ' + days + ' days';
    }
    cell.appendChild(box);
    row.appendChild(cell);
  });

  /* where the week stands */
  const target = metric.weekly || (metric.kpi ? metric.kpi * 5 : 0);
  const against = metricTotalOf(rep, metric.from, role);
  const targetCell = scoreCell(target ? scorePercent(figures.total / target) : '—', 'sc-pct');
  targetCell.dataset.pace = rep + '|' + metric.id + '|target';
  if (target) targetCell.title = show(figures.total) + ' of ' + show(target) + ' this week';
  row.appendChild(targetCell);

  const actualCell = scoreCell(against ? scorePercent(figures.total / against) : '—', 'sc-pct');
  actualCell.dataset.pace = rep + '|' + metric.id + '|actual';
  if (against) {
    const from = (SCORE.settings[role] || []).find((m) => m.id === metric.from);
    actualCell.title = show(figures.total) + ' out of ' + scoreCount(against) + ' ' + (from ? from.name.toLowerCase() : '');
  }
  row.appendChild(actualCell);

  return row;
}

/* Only the worked-out figures change while a number is typed. */
function paintScoreFigures() {
  SCORE_ROLES.forEach(({ key }) => {
    (SCORE.settings[key] || []).forEach((metric) => {
      rosterBy(key).forEach((person) => {
        const figures = metricFigures(person.name, metric);
        const show = metric.money ? scoreMoney : scoreCount;
        ['daily', 'weekly', 'monthly'].forEach((part) => {
          const cell = document.querySelector('[data-pace="' + CSS.escape(person.name + '|' + metric.id + '|' + part) + '"]');
          if (cell) cell.textContent = show(figures[part]);
        });
        const target = metric.weekly || (metric.kpi ? metric.kpi * 5 : 0);
        const targetCell = document.querySelector('[data-pace="' + CSS.escape(person.name + '|' + metric.id + '|target') + '"]');
        if (targetCell) targetCell.textContent = target ? scorePercent(figures.total / target) : '—';
        const against = metricTotalOf(person.name, metric.from, key);
        const actualCell = document.querySelector('[data-pace="' + CSS.escape(person.name + '|' + metric.id + '|actual') + '"]');
        if (actualCell) actualCell.textContent = against ? scorePercent(figures.total / against) : '—';
      });
    });
  });
}

/* ---------- one scorecard ---------- */
function scorecardFor(role, title) {
  const card = el('section', 'panel sc-card');
  const head = el('div', 'sc-card-head');
  head.appendChild(el('h2', 'sc-card-title', title));
  card.appendChild(head);

  const scroller = el('div', 'sc-scroll');
  const table = el('div', 'sc-table');

  /* the headings */
  const header = el('div', 'sc-row sc-row-head');
  header.appendChild(scoreCell('Name'));
  const metricHead = el('span', 'sc-cell');
  metricHead.appendChild(el('span', null, 'Metric'));
  if (canSetTargets()) {
    const add = el('button', 'sc-plus', '+');
    add.type = 'button';
    add.title = 'Add a metric';
    add.setAttribute('aria-label', 'Add a metric to the ' + role + ' scorecard');
    add.addEventListener('click', () => {
      const list = SCORE.settings[role];
      const last = list[list.length - 1];
      list.push({ id: scoreId(role), name: 'New metric', kpi: 0, weekly: 0, monthly: 0, money: false, from: last ? last.id : '' });
      settingsChanged();
      renderScorecards();
    });
    metricHead.appendChild(add);
  }
  header.appendChild(metricHead);
  header.appendChild(scoreCell('Daily KPI'));
  scoreWeekDays(SCORE.week).forEach((day) => {
    const cell = el('span', 'sc-cell sc-day-head');
    cell.appendChild(el('span', 'sc-day-month', day.month));
    cell.appendChild(el('span', 'sc-day-name', day.label.toUpperCase()));
    cell.appendChild(el('span', 'sc-day-date', String(day.date)));
    header.appendChild(cell);
  });
  ['Daily pace', 'Weekly pace', 'Monthly pace', 'Weekly target', 'Monthly target', 'Target %', 'Actual %']
    .forEach((label) => header.appendChild(scoreCell(label)));
  table.appendChild(header);

  const people = rosterBy(role);
  if (!people.length) {
    table.appendChild(el('p', 'sc-empty', 'No ' + role + 's on the team yet. Add them on the Add Team tab.'));
  }

  people.forEach((person) => {
    const block = el('div', 'sc-person');
    block.dataset.rep = person.name;
    (SCORE.settings[role] || []).forEach((metric, i) => {
      block.appendChild(metricRow(role, metric, person.name, i, i === 0));
    });
    table.appendChild(block);

    if (canSetTargets()) {
      makeSortable(block, '.sc-row', (order) => {
        SCORE.settings[role] = reorderBy(SCORE.settings[role], order);
        settingsChanged();
        renderScorecards();
      });
    }
  });

  scroller.appendChild(table);
  card.appendChild(scroller);
  return card;
}

/* ---------- the page ---------- */
function renderScorecards() {
  const host = $('#scoreBody');
  if (!host || !SCORE.settings) return;

  /* the weeks you can flip through */
  const weeks = $('#scoreWeeks');
  weeks.textContent = '';
  SCORE.weeks.forEach((week) => {
    const chip = el('button', 'sc-week' + (week.week === SCORE.week ? ' is-on' : ''));
    chip.type = 'button';
    chip.textContent = weekLabel(week.week);
    chip.addEventListener('click', () => { SCORE.week = week.week; renderScorecards(); });
    weeks.appendChild(chip);
  });

  const add = el('button', 'link-btn sc-add-week', '+ Add New Week');
  add.type = 'button';
  add.classList.toggle('hidden', !canTypeNumbers());
  add.addEventListener('click', addScoreWeek);
  weeks.appendChild(add);

  host.textContent = '';
  SCORE_ROLES.forEach(({ key, title }) => host.appendChild(scorecardFor(key, title)));

  $('#scoreRead').classList.toggle('hidden', canTypeNumbers());
}

/* The week after the newest one, or this week if there is none. */
function addScoreWeek() {
  const newest = SCORE.weeks[0] ? SCORE.weeks[0].week : '';
  let next = scoreMonday(scoreToday());
  if (newest) {
    const [y, m, d] = newest.split('-').map(Number);
    const date = new Date(y, m - 1, d + 7);
    next = scoreIso(date);
  }
  if (SCORE.weeks.some((w) => w.week === next)) { SCORE.week = next; renderScorecards(); return; }
  SCORE.weeks.unshift({ week: next, content: {} });
  SCORE.weeks.sort((a, b) => (a.week < b.week ? 1 : -1));
  SCORE.week = next;
  numbersChanged();
  renderScorecards();
  notify('Week of ' + weekLabel(next) + ' added.');
}

async function initScorecards() {
  const host = $('#scoreBody');
  if (!host) return;
  try {
    const saved = await loadScorecardSettings(CACHE.boardId);
    SCORE.settings = {
      setter: Array.isArray(saved && saved.setter) ? saved.setter : JSON.parse(JSON.stringify(SCORE_DEFAULTS.setter)),
      closer: Array.isArray(saved && saved.closer) ? saved.closer : JSON.parse(JSON.stringify(SCORE_DEFAULTS.closer))
    };
    SCORE.weeks = await loadScorecardWeeks(CACHE.boardId);
    SCORE.ready = true;
    $('#scoreSaved').textContent = '';
  } catch (err) {
    console.error(err);
    SCORE.settings = JSON.parse(JSON.stringify(SCORE_DEFAULTS));
    SCORE.weeks = [];
    SCORE.ready = false;
    $('#scoreSaved').textContent = 'Run supabase/scorecards.sql to save this';
  }

  const thisWeek = scoreMonday(scoreToday());
  if (!SCORE.weeks.some((w) => w.week === thisWeek)) SCORE.weeks.unshift({ week: thisWeek, content: {} });
  SCORE.week = thisWeek;
  renderScorecards();
}
