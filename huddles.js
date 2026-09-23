/* ============================================================
   huddles.js — Daily Huddles, the tab the day starts on
   ------------------------------------------------------------
   One page per offer, run through with the team before calls:

     the meeting        when, where, and the link to join
     accountability     did yesterday's calls get logged
     marketing check    yesterday's prospects, day by day
     bottlenecks        one setter, one closer, one fix each
     pipeline           every live deal and what happens next
     due to close       who needs chasing before they go cold

   Whoever runs the board fills it in while everyone watches; reps
   read it. It is one living page: the pipeline stays until it is
   ticked off, and only the marketing check keeps a day at a time.
   ============================================================ */

const HUDDLE = { content: null, saveTimer: 0, day: '', ready: true };

const HUDDLE_MARKETING = [
  ['situation', "Yesterday's Prospects Situation", true],
  ['qualification', 'Qualification Average', false],
  ['motivations', 'Motivations', true],
  ['struggles', 'Struggles', true],
  ['whyNot', "Why They Didn't Move Forward", true],
  ['whatWould', 'What Would Have Made Them Move Forward', true]
];

const HUDDLE_SPOT = [
  ['weak', "What's the weak number?"],
  ['why', 'Diagnostic — why is it weak?'],
  ['action', 'Action to take today']
];

const hid = () => 'h' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
const canRunHuddle = () => canManage();

function blankHuddle() {
  return {
    meeting: { time: '', zone: '', link: '' },
    accountability: {},
    marketing: { days: [], process: [] },
    setter: { rep: '', weak: '', why: '', action: '' },
    closer: { rep: '', weak: '', why: '', action: '' },
    pipeline: [],
    closing: []
  };
}

/* Days written before a part of the page existed. */
function upgradeHuddle(c) {
  const base = blankHuddle();
  const out = Object.assign(base, c || {});
  out.meeting = Object.assign(base.meeting, out.meeting || {});
  out.marketing = Object.assign(base.marketing, out.marketing || {});
  out.marketing.days = Array.isArray(out.marketing.days) ? out.marketing.days : [];
  out.marketing.process = Array.isArray(out.marketing.process) ? out.marketing.process : [];
  out.setter = Object.assign({ rep: '', weak: '', why: '', action: '' }, out.setter || {});
  out.closer = Object.assign({ rep: '', weak: '', why: '', action: '' }, out.closer || {});
  out.pipeline = Array.isArray(out.pipeline) ? out.pipeline : [];
  out.closing = Array.isArray(out.closing) ? out.closing : [];
  out.accountability = out.accountability && typeof out.accountability === 'object' ? out.accountability : {};
  return out;
}

/* ---------- saving ---------- */
const HUDDLE_HISTORY = makeHistory(
  () => HUDDLE.content,
  (was) => {
    HUDDLE.content = was;
    renderHuddles();
    huddleChanged(true);
    notify('Undone.');
  }
);

function huddleChanged(quiet) {
  if (!canRunHuddle()) return;
  if (!quiet) HUDDLE_HISTORY.remember();
  $('#huddleSaved').textContent = 'Saving…';
  clearTimeout(HUDDLE.saveTimer);
  const boardId = CACHE.boardId;
  HUDDLE.saveTimer = setTimeout(async () => {
    try {
      await saveHuddle(boardId, HUDDLE.content);
      $('#huddleSaved').textContent = 'Saved';
    } catch (err) {
      console.error(err);
      $('#huddleSaved').textContent = /relation|does not exist|schema cache/i.test(String(err.message || ''))
        ? 'Not saved — run supabase/huddles.sql first'
        : "Not saved — check your connection";
    }
  }, 600);
}

/* ---------- small pieces ---------- */
function hField(value, placeholder, onChange, opts) {
  const node = document.createElement(opts && opts.multiline ? 'textarea' : 'input');
  node.className = 'h-in' + (opts && opts.cls ? ' ' + opts.cls : '');
  node.value = value == null ? '' : value;
  node.placeholder = placeholder || '';
  if (opts && opts.label) node.setAttribute('aria-label', opts.label);
  if (opts && opts.type) node.type = opts.type;
  if (opts && opts.multiline) node.rows = opts.rows || 2;
  if (!canRunHuddle()) {
    node.readOnly = true;
    node.classList.add('is-readonly');
  }
  node.addEventListener('change', () => { onChange(node.value); huddleChanged(); });
  return node;
}

function hPick(value, options, onChange, label) {
  const sel = document.createElement('select');
  sel.className = 'h-in h-select';
  sel.setAttribute('aria-label', label || 'Choose');
  options.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    sel.appendChild(opt);
  });
  sel.value = value || '';
  sel.disabled = !canRunHuddle();
  sel.addEventListener('change', () => { onChange(sel.value); huddleChanged(); });
  return sel;
}

function hCard(title, sub) {
  const card = el('section', 'panel h-card');
  const head = el('div', 'h-card-head');
  head.appendChild(el('h2', 'h-card-title', title));
  if (sub) head.appendChild(el('p', 'h-card-sub', sub));
  card.appendChild(head);
  const body = el('div', 'h-card-body');
  card.appendChild(body);
  return { card, body, head };
}

function hRemove(label, onClick) {
  const b = el('button', 'h-x', '×');
  b.type = 'button';
  b.title = 'Remove ' + label;
  b.setAttribute('aria-label', 'Remove ' + label);
  b.classList.toggle('hidden', !canRunHuddle());
  b.addEventListener('click', onClick);
  return b;
}

function hAdd(label, onClick) {
  const b = el('button', 'link-btn h-add', '+ ' + label);
  b.type = 'button';
  b.classList.toggle('hidden', !canRunHuddle());
  b.addEventListener('click', onClick);
  return b;
}

/* ---------- 1. the meeting ---------- */
function huddleMeeting(c) {
  const { card, body } = hCard('Daily Team Meeting', "Set today's time and time zone, and paste the link so the team knows exactly when and where to join.");
  const row = el('div', 'h-meeting');

  row.appendChild(hField(c.meeting.time, '', (v) => { c.meeting.time = v; }, { type: 'time', label: 'Meeting time', cls: 'h-time' }));

  row.appendChild(huddleZoneBox(c));

  /* the button to join appears as soon as there is somewhere to go */
  row.appendChild(hField(c.meeting.link, "Paste today's meeting link…", (v) => { c.meeting.link = v; renderHuddles(); }, { label: 'Meeting link', cls: 'h-link' }));

  body.appendChild(row);

  const link = (c.meeting.link || '').trim();
  if (link) {
    const open = document.createElement('a');
    open.className = 'h-join';
    open.href = link;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = 'Join the meeting';
    body.appendChild(open);
  }
  return card;
}

/* The same search as the portal clock: any city, anywhere. The places
   you already watch are offered first, before you type anything. */
function huddleZoneBox(c) {
  const wrap = el('div', 'h-zone-wrap');

  const button = el('button', 'h-in h-zone');
  button.type = 'button';
  button.textContent = huddleZoneLabel(c) || 'Choose a time zone';
  button.setAttribute('aria-haspopup', 'listbox');
  button.disabled = !canRunHuddle();
  wrap.appendChild(button);
  if (!canRunHuddle()) return wrap;

  const pop = el('div', 'h-zone-pop hidden');
  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'h-in h-zone-search';
  search.placeholder = 'Search a city — Dubai, London, São Paulo…';
  search.setAttribute('aria-label', 'Search time zones');
  pop.appendChild(search);
  const list = el('div', 'h-zone-list');
  pop.appendChild(list);
  wrap.appendChild(pop);

  const pick = (zone, label) => {
    c.meeting.zone = zone;
    c.meeting.zoneLabel = label;
    huddleChanged();
    renderHuddles();
  };

  const paint = () => {
    list.textContent = '';
    const query = search.value.trim();
    const found = query && typeof searchPlaces === 'function' ? searchPlaces(query) : huddleNearbyZones();
    if (!found.length) {
      list.appendChild(el('p', 'h-empty', query ? 'No city by that name.' : 'Search any city to find its time zone.'));
      return;
    }
    found.slice(0, 40).forEach((place) => {
      const row = el('button', 'h-zone-row' + (place.zone === c.meeting.zone ? ' is-on' : ''));
      row.type = 'button';
      row.appendChild(el('span', 'h-zone-name', place.label));
      row.appendChild(el('span', 'h-zone-note', (place.note || place.zone.replace(/_/g, ' ')) + ' · ' + huddleZoneClock(place.zone)));
      row.addEventListener('click', () => pick(place.zone, place.label));
      list.appendChild(row);
    });
  };

  const close = () => {
    pop.classList.add('hidden');
    document.removeEventListener('click', away, true);
  };
  const away = (e) => { if (!wrap.contains(e.target)) close(); };

  button.addEventListener('click', () => {
    const open = pop.classList.contains('hidden');
    pop.classList.toggle('hidden', !open);
    if (!open) { close(); return; }
    search.value = '';
    paint();
    document.addEventListener('click', away, true);
    search.focus();
  });
  search.addEventListener('input', paint);
  search.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  return wrap;
}

/* What the zone reads as before anything is typed: your own clock first. */
function huddleNearbyZones() {
  const out = [];
  const seen = new Set();
  const add = (zone, label, note) => {
    if (!zone || seen.has(zone)) return;
    seen.add(zone);
    out.push({ zone, label: label || zone.split('/').pop().replace(/_/g, ' '), note: note || '' });
  };
  try {
    const main = mainClockZone();
    add(main.zone, main.label, 'Your clock');
    (clockPlaces() || []).forEach((p) => add(p.zone, p.label, 'On your clock'));
  } catch (e) { /* the clock has not been set up */ }
  add(Intl.DateTimeFormat().resolvedOptions().timeZone, 'This device', '');

  /* Somewhere to start from when your clock is still on one place. */
  ['America/Sao_Paulo', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Lisbon', 'Asia/Dubai']
    .forEach((zone) => {
      const city = typeof CLOCK_CITIES !== 'undefined' ? CLOCK_CITIES.find((x) => x.zone === zone) : null;
      add(zone, city ? city.name : zone.split('/').pop().replace(/_/g, ' '), city ? city.country : '');
    });
  return out;
}

function huddleZoneLabel(c) {
  if (c.meeting.zoneLabel) return c.meeting.zoneLabel;
  if (c.meeting.zone) return c.meeting.zone.split('/').pop().replace(/_/g, ' ');
  try { return mainClockZone().label; } catch (e) { return ''; }
}

/* The time there right now, so a zone is chosen by what it says. */
function huddleZoneClock(zone) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date());
  } catch (e) {
    return '';
  }
}

/* ---------- 2. did yesterday's calls get logged ---------- */
function huddleAccountability(c) {
  const { card, body } = hCard('Post-Call Form Accountability', "Check back on yesterday's calls — did everyone fill out their post-call form?");
  const people = rosterPeople ? rosterPeople() : [];
  if (!people.length) {
    body.appendChild(el('p', 'h-empty', 'Nobody on the team yet. Add your reps on the Add Team tab.'));
    return card;
  }
  people.forEach((person) => {
    const row = el('div', 'h-line');
    row.appendChild(el('span', 'h-line-label', person.name));
    row.appendChild(hPick(c.accountability[person.name] || '', [
      { value: '', label: 'Select…' },
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
      { value: 'none', label: 'No calls yesterday' }
    ], (v) => { c.accountability[person.name] = v; }, 'Did ' + person.name + ' fill in their post-call forms'));
    body.appendChild(row);
  });
  return card;
}

/* ---------- 3. the marketing debrief, day by day ---------- */
function huddleMarketing(c) {
  const { card, body } = hCard('Marketing Check', "Debrief yesterday's prospects — what's working, what isn't. Add a new day to spot patterns over time.");
  const days = c.marketing.days;
  if (!days.length && canRunHuddle()) days.push(huddleNewDay());
  if (!HUDDLE.day || !days.some((d) => d.id === HUDDLE.day)) HUDDLE.day = days.length ? days[days.length - 1].id : '';

  const tabs = el('div', 'h-days');
  days.forEach((day) => {
    const chip = el('button', 'h-day' + (day.id === HUDDLE.day ? ' is-on' : ''));
    chip.type = 'button';
    chip.textContent = huddleDayLabel(day);
    chip.addEventListener('click', () => { HUDDLE.day = day.id; renderHuddles(); });
    if (canRunHuddle()) {
      chip.appendChild(hRemove('this day', (e) => {
        e.stopPropagation();
        if (!window.confirm('Remove ' + huddleDayLabel(day) + ' from the marketing check?')) return;
        c.marketing.days = days.filter((d) => d.id !== day.id);
        HUDDLE.day = '';
        huddleChanged();
        renderHuddles();
      }));
    }
    tabs.appendChild(chip);
  });
  tabs.appendChild(hAdd('Add New Day', () => {
    const day = huddleNewDay();
    c.marketing.days.push(day);
    HUDDLE.day = day.id;
    huddleChanged();
    renderHuddles();
  }));
  body.appendChild(tabs);

  const day = days.find((d) => d.id === HUDDLE.day);
  if (day) {
    const fields = el('div', 'h-fields');
    HUDDLE_MARKETING.forEach(([key, label, long]) => {
      const line = el('div', 'h-field');
      line.appendChild(el('label', 'h-field-label', label));
      line.appendChild(hField(day[key], '', (v) => { day[key] = v; }, { multiline: long, rows: 2, label: label }));
      fields.appendChild(line);
    });
    body.appendChild(fields);
  }

  /* the steps of the sale, checked off as they hold up */
  const process = el('div', 'h-process');
  process.appendChild(el('h3', 'h-sub-title', 'Sales Process Check'));
  if (!c.marketing.process.length) process.appendChild(el('p', 'h-empty', 'No sales process steps added yet.'));
  c.marketing.process.forEach((step, i) => {
    const row = el('div', 'h-step');
    row.appendChild(el('span', 'h-step-no', String(i + 1)));
    row.appendChild(hField(step.text, 'Step in the sales process', (v) => { step.text = v; }, { label: 'Sales process step ' + (i + 1) }));
    row.appendChild(hRemove('this step', () => {
      c.marketing.process = c.marketing.process.filter((s) => s.id !== step.id);
      huddleChanged();
      renderHuddles();
    }));
    process.appendChild(row);
  });
  process.appendChild(hAdd('Add a step', () => {
    c.marketing.process.push({ id: hid(), text: '' });
    huddleChanged();
    renderHuddles();
  }));
  body.appendChild(process);

  return card;
}

function huddleNewDay() {
  const now = new Date();
  return {
    id: hid(),
    date: now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'),
    situation: '', qualification: '', motivations: '', struggles: '', whyNot: '', whatWould: ''
  };
}

function huddleDayLabel(day) {
  const [y, m, d] = String(day.date || '').split('-').map(Number);
  if (!y) return 'Day';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ---------- 4 and 5. one rep, one bottleneck ---------- */
function huddleSpot(c, role) {
  const who = role === 'setter' ? 'Setter' : 'Closer';
  const { card, body } = hCard(who + ' Bottleneck Spot-Check (5 min)', 'ONE rep, ONE bottleneck. Don’t fix everyone.');
  const spot = c[role];

  const people = (typeof rosterBy === 'function' ? rosterBy(role) : []).map((p) => ({ value: p.name, label: p.name }));
  const line = el('div', 'h-line');
  line.appendChild(el('span', 'h-line-label', 'Rep in focus today'));
  line.appendChild(hPick(spot.rep, [{ value: '', label: 'Select…' }].concat(people), (v) => { spot.rep = v; }, 'Rep in focus'));
  body.appendChild(line);

  HUDDLE_SPOT.forEach(([key, label]) => {
    const row = el('div', 'h-line');
    row.appendChild(el('span', 'h-line-label', label));
    row.appendChild(hField(spot[key], '', (v) => { spot[key] = v; }, { label: who + ' ' + label }));
    body.appendChild(row);
  });
  return card;
}

/* ---------- 6. the pipeline ---------- */
const huddleMoney = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function huddlePipelineTotal(c) {
  return c.pipeline.filter((r) => !r.done).reduce((sum, r) => sum + (Number(String(r.size).replace(/[^0-9.\-]/g, '')) || 0), 0);
}

function huddlePipeline(c) {
  const { card, body, head } = hCard('Pipeline Check (Daily Numbers)', 'Fill this in now.');

  const total = el('div', 'h-total');
  total.appendChild(el('p', 'h-total-label', 'Total pipeline value'));
  const value = el('p', 'h-total-value');
  value.id = 'huddlePipelineTotal';
  value.textContent = huddleMoney(huddlePipelineTotal(c));
  total.appendChild(value);
  head.appendChild(total);

  const table = el('div', 'h-table');
  const header = el('div', 'h-row h-row-head');
  ['Rep', 'Prospect', 'Status', 'Deal size', 'Last contact', 'Plan', 'Done'].forEach((label) => {
    header.appendChild(el('span', 'h-cell-head', label));
  });
  header.appendChild(el('span', 'h-cell-head'));
  table.appendChild(header);

  if (!c.pipeline.length) table.appendChild(el('p', 'h-empty', 'No deals in the pipeline yet.'));

  c.pipeline.forEach((deal) => {
    const row = el('div', 'h-row' + (deal.done ? ' is-done' : ''));
    row.dataset.id = deal.id;
    const cell = (node) => { const box = el('span', 'h-cell'); box.appendChild(node); return box; };

    row.appendChild(cell(hField(deal.rep, 'Who?', (v) => { deal.rep = v; }, { label: 'Rep' })));
    row.appendChild(cell(hField(deal.prospect, 'Who?', (v) => { deal.prospect = v; }, { label: 'Prospect' })));
    row.appendChild(cell(hField(deal.status, 'Booked?', (v) => { deal.status = v; }, { label: 'Status' })));
    row.appendChild(cell(hField(deal.size, '$$$?', (v) => {
      deal.size = v;
      const box = $('#huddlePipelineTotal');
      if (box) box.textContent = huddleMoney(huddlePipelineTotal(c));
    }, { label: 'Deal size' })));
    row.appendChild(cell(hField(deal.lastContact, '', (v) => { deal.lastContact = v; }, { type: 'date', label: 'Last contact' })));
    row.appendChild(cell(hField(deal.plan, 'Forward action', (v) => { deal.plan = v; }, { multiline: true, rows: 1, label: 'Plan' })));

    const tick = el('span', 'h-cell h-cell-done');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !!deal.done;
    box.disabled = !canRunHuddle();
    box.setAttribute('aria-label', 'Done with ' + (deal.prospect || 'this deal'));
    box.addEventListener('change', () => {
      deal.done = box.checked;
      row.classList.toggle('is-done', box.checked);
      const shown = $('#huddlePipelineTotal');
      if (shown) shown.textContent = huddleMoney(huddlePipelineTotal(c));
      huddleChanged();
    });
    tick.appendChild(box);
    row.appendChild(tick);

    const x = el('span', 'h-cell h-cell-x');
    x.appendChild(hRemove(deal.prospect || 'this row', () => {
      c.pipeline = c.pipeline.filter((d) => d.id !== deal.id);
      huddleChanged();
      renderHuddles();
    }));
    row.appendChild(x);

    table.appendChild(row);
  });

  body.appendChild(table);
  body.appendChild(hAdd('Add Row', () => {
    c.pipeline.push({ id: hid(), rep: '', prospect: '', status: '', size: '', lastContact: '', plan: '', done: false });
    huddleChanged();
    renderHuddles();
  }));
  return card;
}

/* ---------- 7. who is about to go cold ---------- */
function huddleClosing(c) {
  const { card, body } = hCard('Students Due to Close Soon', 'Track prospects who need a specific follow-up before they go cold.');

  const table = el('div', 'h-table h-table-3');
  const header = el('div', 'h-row h-row-head');
  ['Prospect', 'Date to follow up', "Why they didn't close"].forEach((label) => header.appendChild(el('span', 'h-cell-head', label)));
  header.appendChild(el('span', 'h-cell-head'));
  table.appendChild(header);

  if (!c.closing.length) table.appendChild(el('p', 'h-empty', 'No prospects added yet.'));

  c.closing.forEach((item) => {
    const row = el('div', 'h-row');
    row.dataset.id = item.id;
    const cell = (node) => { const box = el('span', 'h-cell'); box.appendChild(node); return box; };
    row.appendChild(cell(hField(item.prospect, 'Who?', (v) => { item.prospect = v; }, { label: 'Prospect' })));
    row.appendChild(cell(hField(item.followUp, '', (v) => { item.followUp = v; }, { type: 'date', label: 'Date to follow up' })));
    row.appendChild(cell(hField(item.why, 'What stopped them', (v) => { item.why = v; }, { multiline: true, rows: 1, label: "Why they didn't close" })));
    const x = el('span', 'h-cell h-cell-x');
    x.appendChild(hRemove(item.prospect || 'this row', () => {
      c.closing = c.closing.filter((i) => i.id !== item.id);
      huddleChanged();
      renderHuddles();
    }));
    row.appendChild(x);
    table.appendChild(row);
  });

  body.appendChild(table);
  body.appendChild(hAdd('Add Row', () => {
    c.closing.push({ id: hid(), prospect: '', followUp: '', why: '' });
    huddleChanged();
    renderHuddles();
  }));
  return card;
}

/* ---------- the page ---------- */
function renderHuddles() {
  const host = $('#huddleBody');
  if (!host || !HUDDLE.content) return;
  const c = HUDDLE.content;

  host.textContent = '';
  host.appendChild(huddleMeeting(c));
  host.appendChild(huddleAccountability(c));
  host.appendChild(huddleMarketing(c));
  host.appendChild(huddleSpot(c, 'setter'));
  host.appendChild(huddleSpot(c, 'closer'));
  host.appendChild(huddlePipeline(c));
  host.appendChild(huddleClosing(c));

  $('#huddleRead').classList.toggle('hidden', canRunHuddle());
}

async function initHuddles() {
  const host = $('#huddleBody');
  if (!host) return;
  try {
    HUDDLE.content = upgradeHuddle(await loadHuddle(CACHE.boardId));
    HUDDLE.ready = true;
    $('#huddleSaved').textContent = '';
  } catch (err) {
    console.error(err);
    HUDDLE.content = upgradeHuddle(null);
    HUDDLE.ready = false;
    $('#huddleSaved').textContent = 'Run supabase/huddles.sql to save this';
  }
  HUDDLE.day = '';
  HUDDLE_HISTORY.reset();
  renderHuddles();
}

registerUndo({
  label: 'daily huddles',
  when: () => shellShown('boardShell') && !!document.querySelector('[data-panel="huddles"]:not(.hidden)'),
  undo: () => HUDDLE_HISTORY.undo(),
  redo: () => HUDDLE_HISTORY.redo()
});
