/* ============================================================
   signal.js — Signal List (/signal-list)
   ------------------------------------------------------------
   The owner's own daily page — nobody else has one:

     beside the day, always in view: daily calls · daily brain dump

     calendar · quotes · morning checklist · what broke your speed
     yesterday · focus · goals & limiting factors · highest signal
     actions (and why) · sub-priority tasks · daily speed check in
     30-minute slots · evening reflection · journal

   "Plan tomorrow" opens the next day already set up: goals carried
   over, the checklist reset, and what broke your speed today listed
   as tomorrow's things to watch. Everything on a day is edited in
   place; "Customize" changes the defaults every new day starts from.
   ============================================================ */

const SIGNAL_PATH = '/signal-list';

const SIGNAL_DEFAULTS = {
  quotes: [
    '0 neuroticism — “if it’s not in my control it’s none of my concern”',
    'Action teaches faster than analysis ever will, so I run straight at the abyss, eliminate perfectionism, and execute as fast as possible every day to receive feedback. The highest leverage move is often the one with the most pain and fear of execution.'
  ],
  focus: 'Everything stems from getting richer leads, booking more calls, closing more calls.',
  checklist: ['Pray', 'Gym', 'Breakfast', 'Shower', 'Supplements', 'Meditate (5 min)', 'Stare at a wall (10 min)'],
  questions: ['Did the signal actions get done?', 'If not, why?', 'What broke my speed / execution today?', 'What can I do better tomorrow?'],
  dayStart: '07:00',
  dayEnd: '22:30',
  schedule: {
    '07:00': 'Wake up', '07:30': 'Morning routine', '08:00': 'Gym', '08:30': 'Gym', '09:00': 'Shower & breakfast',
    '09:30': 'Start working', '14:00': 'Start working', '15:30': 'Smoothie', '19:00': 'Dinner',
    '20:30': 'Journal & plan tomorrow today (fill out signal sheet)', '21:00': 'Shut down everything and shower',
    '21:30': 'Take melatonin and read Bible', '22:00': 'Read Bible', '22:30': 'Sleep'
  },
  goals: [
    { goal: 'Sign 2 real estate creators and run ads for their offers', limit: 'Outreach and funnel hack pitch' },
    { goal: 'Make $50K CC with Des (with 40% rev share)', limit: 'Lead flow and ICP' },
    { goal: 'Have high-level reps and a CMO (internal dashboards, software, SOPs ready)', limit: 'Proven offer that attracts A-players' },
    { goal: 'Build my personal brand', limit: 'Results and money to invest into coaching from Gerry' },
    { goal: 'Move to Dubai', limit: 'MRR and savings' }
  ]
};

const SV = { day: '', month: null, content: null, template: null, ready: true, saveTimer: 0, templateTimer: 0, dirty: false, loading: false };

const sid = () => Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
/* 'Today' is today where your main portal clock is set, not wherever this device thinks it is. */
const todayIso = () => { try { return zoneNow(mainClockZone().zone).day; } catch (e) { return isoDay(new Date()); } };
const shiftDay = (iso, n) => { const d = asDate(iso); d.setDate(d.getDate() + n); return isoDay(d); };

function slotsFor(template) {
  const toMin = (t) => { const p = String(t || '07:00').split(':'); return (+p[0]) * 60 + (+p[1] || 0); };
  const out = [];
  for (let m = toMin(template.dayStart); m <= toMin(template.dayEnd); m += 30) {
    out.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
  }
  return out;
}

function templateWithDefaults(saved) {
  return Object.assign(JSON.parse(JSON.stringify(SIGNAL_DEFAULTS)), saved || {});
}

/* A new day: the defaults, plus what carries over from the last day filled in. */
function freshDay(template, previous) {
  const prev = previous && previous.content;
  const content = {
    checklist: template.checklist.map((text) => ({ id: sid(), text, done: false })),
    breakers: [],
    goals: (prev && prev.goals && prev.goals.length ? prev.goals : template.goals).map((g) => ({ id: sid(), goal: g.goal, limit: g.limit })),
    signals: [],
    subs: [],
    schedule: {},
    reflection: {},
    journal: '',
    calls: [],
    dump: ''
  };
  Object.keys(template.schedule || {}).forEach((t) => { content.schedule[t] = template.schedule[t]; });

  if (prev && prev.reflection) {
    const brokeIndex = template.questions.findIndex((q) => /broke/i.test(q));
    const betterIndex = template.questions.findIndex((q) => /better tomorrow/i.test(q));
    const broke = brokeIndex !== -1 ? (prev.reflection[brokeIndex] || '').trim() : '';
    const better = betterIndex !== -1 ? (prev.reflection[betterIndex] || '').trim() : '';
    if (broke || better) content.breakers.push({ id: sid(), problem: broke, fix: better });
  }
  if (prev && prev.breakers) {
    prev.breakers.filter((b) => b.keep).forEach((b) => content.breakers.push({ id: sid(), problem: b.problem, fix: b.fix, keep: true }));
  }

  /* Anything not checked off wasn't done, so it comes along, keeping the
     day it was first written — so it's clear how long it has been open.
     Checked items stay behind. */
  if (prev && previous.day) {
    upgradeSignalDay(prev);
    (prev.signals || []).filter((s) => !s.done && s.text && s.text.trim())
      .forEach((s) => content.signals.push({ id: sid(), text: s.text, why: s.why || '', done: false, since: s.since || previous.day }));
    (prev.subs || []).filter((x) => !x.done && x.text && x.text.trim())
      .forEach((x) => content.subs.push({ id: sid(), text: x.text, done: false, since: x.since || previous.day }));
  }
  if (!content.signals.length) content.signals.push({ id: sid(), text: '', why: '', done: false });
  return content;
}

function shortSignalDate(iso) {
  return asDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* "since Sep 12 · 3 days" — on anything that has rolled over from an earlier day. */
function sinceTag(item) {
  if (!item.since || item.since >= SV.day) return null;
  const days = Math.round((asDate(SV.day) - asDate(item.since)) / 86400000);
  const tag = el('span', 'scarried' + (days >= 3 ? ' is-late' : ''));
  tag.textContent = 'since ' + shortSignalDate(item.since) + ' · ' + days + (days === 1 ? ' day' : ' days');
  tag.title = 'First written on ' + asDate(item.since).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + ' and not checked off since';
  return tag;
}

/* Days written before sub-priority tasks had their own list. */
function upgradeSignalDay(c) {
  if (!Array.isArray(c.calls)) c.calls = [];
  if (typeof c.dump !== 'string') c.dump = '';
  if (!Array.isArray(c.subs)) {
    c.subs = (c.signals || []).filter((s) => s.sub && s.sub.trim()).map((s) => ({ id: sid(), text: s.sub, done: false }));
  }
  (c.signals || []).forEach((s) => { delete s.sub; });
  return c;
}

/* ============================================================
   Saving
   ============================================================ */
function signalChanged() {
  SV.dirty = true;
  $('#signalSaved').textContent = 'Saving…';
  clearTimeout(SV.saveTimer);
  const day = SV.day;
  SV.saveTimer = setTimeout(async () => {
    if (!SV.ready) { $('#signalSaved').textContent = 'Not saved — run signal.sql first'; return; }
    try {
      await saveSignalDay(day, SV.content);
      SV.dirty = false;
      if (day === SV.day) $('#signalSaved').textContent = 'Saved';
      paintSignalCalendar();
    } catch (err) {
      console.error(err);
      $('#signalSaved').textContent = "Couldn't save — check your connection";
    }
    paintSignalProgress();
  }, 700);
  paintSignalProgress();
}

/* Quotes are part of the defaults, so typing in one saves the defaults. */
function templateChanged() {
  clearTimeout(SV.templateTimer);
  $('#signalSaved').textContent = 'Saving…';
  SV.templateTimer = setTimeout(async () => {
    if (await saveTemplateNow()) $('#signalSaved').textContent = 'Saved';
  }, 700);
}

async function saveTemplateNow() {
  if (!SV.ready) { notify('Run supabase/signal.sql in Supabase first.'); return false; }
  try {
    await saveSignalTemplate(SV.template);
    return true;
  } catch (err) {
    console.error(err);
    notify("Couldn't save your defaults — check your connection.");
    return false;
  }
}

/* ============================================================
   Small building blocks
   ============================================================ */
/* A box as tall as what's written in it — never cut off. Measured again
   once it is on the page, when fonts finish loading, and on resize. */
function fitArea(area) {
  if (!area.isConnected || !area.offsetParent) return;
  area.style.height = 'auto';
  area.style.height = area.scrollHeight + 2 + 'px';
}

function autoGrow(area) {
  area.addEventListener('input', () => fitArea(area));
  requestAnimationFrame(() => fitArea(area));
  return area;
}

function refitSignalBoxes() {
  document.querySelectorAll('#signalShell textarea').forEach(fitArea);
}

function textBox(value, placeholder, onChange, opts) {
  const area = document.createElement('textarea');
  area.className = 'sfield' + (opts && opts.cls ? ' ' + opts.cls : '');
  area.rows = 1;
  area.value = value || '';
  area.placeholder = placeholder || '';
  if (opts && opts.label) area.setAttribute('aria-label', opts.label);
  area.addEventListener('input', () => { onChange(area.value); signalChanged(); });
  if (!(opts && opts.multiline)) {
    area.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && opts && opts.onEnter) { e.preventDefault(); opts.onEnter(); } });
  }
  return autoGrow(area);
}

function checkBox(done, label, onToggle) {
  const b = el('button', 'scheck' + (done ? ' is-done' : ''));
  b.type = 'button';
  b.setAttribute('role', 'checkbox');
  b.setAttribute('aria-checked', String(!!done));
  b.setAttribute('aria-label', label);
  b.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><polyline points="3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  b.addEventListener('click', () => {
    const now = b.getAttribute('aria-checked') !== 'true';
    b.setAttribute('aria-checked', String(now));
    b.classList.toggle('is-done', now);
    onToggle(now);
    signalChanged();
  });
  return b;
}

function removeButton(label, onRemove) {
  const b = el('button', 'sremove', '&times;');
  b.type = 'button';
  b.title = 'Remove';
  b.setAttribute('aria-label', 'Remove ' + label);
  b.addEventListener('click', onRemove);
  return b;
}

function addButton(label, onAdd) {
  const b = el('button', 'sadd', '+ ' + label);
  b.type = 'button';
  b.addEventListener('click', onAdd);
  return b;
}

function signalCard(title, sub, extraClass) {
  const card = el('section', 'panel scard' + (extraClass ? ' ' + extraClass : ''));
  const head = el('div', 'scard-head');
  head.appendChild(el('h2', 'scard-title', title));
  head.appendChild(el('span', 'scard-sub', sub || ''));
  card.appendChild(head);
  const body = el('div', 'scard-body');
  card.appendChild(body);
  return { card, head, body };
}

const focusLater = (selector) => requestAnimationFrame(() => { const n = document.querySelector(selector); if (n) n.focus(); });

/* ============================================================
   Render one day
   ============================================================ */
function renderSignal() {
  const c = SV.content;
  const t = SV.template;
  const host = $('#signalBody');
  host.textContent = '';

  const d = asDate(SV.day);
  $('#signalDate').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  $('#signalYear').textContent = (SV.day === todayIso() ? 'Today · ' : SV.day === shiftDay(todayIso(), 1) ? 'Tomorrow · ' : SV.day === shiftDay(todayIso(), -1) ? 'Yesterday · ' : '') + d.getFullYear();
  $('#signalToday').classList.toggle('hidden', SV.day === todayIso());
  $('#signalNotReady').classList.toggle('hidden', SV.ready);

  /* ---------- quotes: click to change, add or remove ---------- */
  const quotes = $('#signalQuotes');
  quotes.textContent = '';
  t.quotes.forEach((q, i) => {
    const row = el('div', 'squote-row');
    const area = document.createElement('textarea');
    area.className = 'squote';
    area.rows = 1;
    area.value = q;
    area.placeholder = 'Write a quote…';
    area.dataset.quote = String(i);
    area.setAttribute('aria-label', 'Quote ' + (i + 1));
    area.addEventListener('input', () => { t.quotes[i] = area.value; templateChanged(); });
    area.addEventListener('blur', () => {
      if (!area.value.trim() && t.quotes.length > 1) { t.quotes.splice(i, 1); templateChanged(); renderSignal(); }
    });
    row.appendChild(autoGrow(area));
    row.appendChild(removeButton('quote', () => { t.quotes.splice(i, 1); templateChanged(); renderSignal(); }));
    quotes.appendChild(row);
  });
  quotes.appendChild(addButton('Add quote', () => {
    t.quotes.push('');
    renderSignal();
    focusLater('.squote[data-quote="' + (t.quotes.length - 1) + '"]');
  }));

  /* ---------- morning checklist ---------- */
  {
    const { card, body, head } = signalCard('Morning checklist', '');
    head.querySelector('.scard-sub').id = 'signalMorningCount';
    const list = el('div', 'slist');
    c.checklist.forEach((item) => {
      const row = el('div', 'srow scheck-row' + (item.done ? ' is-done' : ''));
      row.dataset.id = item.id;
      row.appendChild(checkBox(item.done, item.text, (on) => { item.done = on; row.classList.toggle('is-done', on); }));
      row.appendChild(textBox(item.text, 'Checklist item', (v) => { item.text = v; }, { label: 'Checklist item', cls: 'sfield-plain' }));
      row.appendChild(removeButton(item.text, () => { c.checklist = c.checklist.filter((x) => x !== item); signalChanged(); renderSignal(); }));
      list.appendChild(row);
    });
    body.appendChild(list);
    body.appendChild(addButton('Add to checklist', () => {
      const item = { id: sid(), text: '', done: false };
      c.checklist.push(item);
      signalChanged();
      renderSignal();
      focusLater('.scheck-row[data-id="' + item.id + '"] textarea');
    }));
    host.appendChild(card);
  }

  /* ---------- what broke your speed yesterday ---------- */
  {
    const { card, body } = signalCard('Be aware of what broke your speed & execution yesterday', '', 'scard-warn');
    const list = el('div', 'slist');
    if (!c.breakers.length) list.appendChild(el('p', 'sempty', 'Nothing from yesterday. Add anything you want to watch out for today.'));
    c.breakers.forEach((b) => {
      const row = el('div', 'srow sbreak-row');
      row.dataset.id = b.id;
      row.appendChild(textBox(b.problem, 'What broke your speed', (v) => { b.problem = v; }, { label: 'What broke your speed' }));
      row.appendChild(el('span', 'sarrow', '&rarr;'));
      row.appendChild(textBox(b.fix, 'What you’ll do instead', (v) => { b.fix = v; }, { label: 'What you will do instead', cls: 'sfield-strong' }));
      row.appendChild(removeButton('this', () => { c.breakers = c.breakers.filter((x) => x !== b); signalChanged(); renderSignal(); }));
      list.appendChild(row);
    });
    body.appendChild(list);
    body.appendChild(addButton('Add one', () => {
      const b = { id: sid(), problem: '', fix: '' };
      c.breakers.push(b);
      signalChanged();
      renderSignal();
      focusLater('.sbreak-row[data-id="' + b.id + '"] textarea');
    }));
    host.appendChild(card);
  }

  /* ---------- focus ---------- */
  if (t.focus) {
    const focus = el('p', 'sfocus');
    focus.textContent = t.focus;
    host.appendChild(focus);
  }

  /* ---------- goals & limiting factors ---------- */
  {
    const { card, body } = signalCard('Goals', 'and what’s limiting each one');
    const table = el('div', 'sgrid');
    const headRow = el('div', 'sgrid-head');
    headRow.appendChild(el('span', null, 'Goal'));
    headRow.appendChild(el('span', null, 'Limiting factor'));
    table.appendChild(headRow);
    c.goals.forEach((g) => {
      const row = el('div', 'srow sgoal-row');
      row.dataset.id = g.id;
      row.appendChild(textBox(g.goal, 'Goal', (v) => { g.goal = v; }, { label: 'Goal', cls: 'sfield-strong' }));
      row.appendChild(textBox(g.limit, 'Limiting factor', (v) => { g.limit = v; }, { label: 'Limiting factor' }));
      row.appendChild(removeButton('goal', () => { c.goals = c.goals.filter((x) => x !== g); signalChanged(); renderSignal(); }));
      table.appendChild(row);
    });
    body.appendChild(table);
    body.appendChild(addButton('Add goal', () => {
      const g = { id: sid(), goal: '', limit: '' };
      c.goals.push(g);
      signalChanged();
      renderSignal();
      focusLater('.sgoal-row[data-id="' + g.id + '"] textarea');
    }));
    host.appendChild(card);
  }

  /* ---------- highest signal actions ---------- */
  {
    const { card, body, head } = signalCard('Highest signal actions', '', 'scard-signal');
    head.querySelector('.scard-sub').id = 'signalActionCount';
    const list = el('div', 'slist');
    c.signals.forEach((s, i) => {
      const row = el('div', 'ssignal' + (s.done ? ' is-done' : ''));
      row.dataset.id = s.id;
      const top = el('div', 'ssignal-top');
      top.appendChild(el('span', 'ssignal-num', String(i + 1)));
      top.appendChild(checkBox(s.done, s.text || 'signal action', (on) => { s.done = on; row.classList.toggle('is-done', on); }));
      top.appendChild(textBox(s.text, 'Signal action', (v) => {
        s.text = v;
        const title = document.querySelector('.swhy-item[data-id="' + s.id + '"] .swhy-name');
        if (title) title.textContent = v.trim() || 'Signal action ' + (i + 1);
      }, { label: 'Signal action', cls: 'sfield-signal' }));
      top.appendChild(removeButton('signal action', () => { c.signals = c.signals.filter((x) => x !== s); signalChanged(); renderSignal(); }));
      const sTag = sinceTag(s);
      if (sTag) top.appendChild(sTag);
      row.appendChild(top);
      list.appendChild(row);
    });
    body.appendChild(list);
    if (c.signals.length < 6) {
      body.appendChild(addButton('Add signal action', () => {
        const s = { id: sid(), text: '', why: '', done: false };
        c.signals.push(s);
        signalChanged();
        renderSignal();
        focusLater('.ssignal[data-id="' + s.id + '"] .sfield-signal');
      }));
    }

    /* why are these the highest signal? — full width, grows with the text */
    const why = el('div', 'swhy');
    why.appendChild(el('h3', 'swhy-title', 'Why are these the highest signal?'));
    if (!c.signals.length) why.appendChild(el('p', 'sempty', 'Add a signal action above, then say why it’s the highest signal.'));
    c.signals.forEach((s, i) => {
      const item = el('label', 'swhy-item');
      item.dataset.id = s.id;
      const title = el('span', 'swhy-for');
      title.appendChild(el('b', null, String(i + 1)));
      const name = el('span', 'swhy-name');
      name.textContent = s.text.trim() || 'Signal action ' + (i + 1);
      title.appendChild(name);
      item.appendChild(title);
      item.appendChild(textBox(s.why, 'Why this moves you closest to your goals…', (v) => { s.why = v; }, { label: 'Why ' + (s.text || 'this') + ' is highest signal', multiline: true, cls: 'swhy-text' }));
      why.appendChild(item);
    });
    body.appendChild(why);
    host.appendChild(card);
  }

  /* ---------- sub-priority tasks: after the signals are done ---------- */
  {
    const { card, body, head } = signalCard('Sub-priority tasks', 'once the signals are done', 'scard-subs');
    const count = el('span', 'scard-sub scard-count');
    count.id = 'signalSubCount';
    head.appendChild(count);
    const list = el('div', 'slist');
    if (!c.subs.length) list.appendChild(el('p', 'sempty', 'Nothing here yet. These are for after your signal actions.'));
    c.subs.forEach((item) => {
      const row = el('div', 'srow scheck-row ssub-row' + (item.done ? ' is-done' : ''));
      row.dataset.id = item.id;
      row.appendChild(checkBox(item.done, item.text || 'sub-priority task', (on) => { item.done = on; row.classList.toggle('is-done', on); }));
      row.appendChild(textBox(item.text, 'Sub-priority task', (v) => { item.text = v; }, { label: 'Sub-priority task', cls: 'sfield-plain' }));
      const subTag = sinceTag(item);
      if (subTag) row.appendChild(subTag);
      row.appendChild(removeButton('task', () => { c.subs = c.subs.filter((x) => x !== item); signalChanged(); renderSignal(); }));
      list.appendChild(row);
    });
    body.appendChild(list);
    body.appendChild(addButton('Add sub-priority task', () => {
      const item = { id: sid(), text: '', done: false };
      c.subs.push(item);
      signalChanged();
      renderSignal();
      focusLater('.ssub-row[data-id="' + item.id + '"] textarea');
    }));
    host.appendChild(card);
  }

  /* ---------- daily speed check ---------- */
  {
    const { card, body, head } = signalCard('Daily speed check', 'every 30 minutes');
    const makeDefault = el('button', 'link-btn sdefault', 'Make this my usual day');
    makeDefault.type = 'button';
    makeDefault.addEventListener('click', async () => {
      SV.template.schedule = Object.assign({}, c.schedule);
      Object.keys(SV.template.schedule).forEach((k) => { if (!String(SV.template.schedule[k]).trim()) delete SV.template.schedule[k]; });
      if (await saveTemplateNow()) notify('Saved. New days start with this schedule.');
    });
    head.appendChild(makeDefault);

    const clockNow = zoneNow(mainClockZone().zone).minute;
    const nowSlot = String(Math.floor(clockNow / 60)).padStart(2, '0') + ':' + (clockNow % 60 < 30 ? '00' : '30');
    const grid = el('div', 'sschedule');
    slotsFor(t).forEach((time) => {
      const row = el('div', 'sslot' + (SV.day === todayIso() && time === nowSlot ? ' is-now' : ''));
      const hour = +time.slice(0, 2);
      const label = (hour % 12 || 12) + ':' + time.slice(3) + (hour < 12 ? ' am' : ' pm');
      row.appendChild(el('span', 'sslot-time', label));
      row.appendChild(textBox(c.schedule[time], '', (v) => { if (v.trim()) c.schedule[time] = v; else delete c.schedule[time]; }, { label: 'What you are doing at ' + label, cls: 'sfield-plain' }));
      grid.appendChild(row);
    });
    body.appendChild(grid);
    host.appendChild(card);
  }

  /* ---------- evening reflection ---------- */
  {
    const { card, body } = signalCard('Evening reflection', '');
    t.questions.forEach((q, i) => {
      const row = el('label', 'sreflect');
      const label = el('span', 'sreflect-q');
      label.textContent = q;
      if (/signal actions get done/i.test(q)) {
        const auto = el('small', 'sreflect-auto');
        auto.id = 'signalReflectAuto';
        label.appendChild(auto);
      }
      row.appendChild(label);
      row.appendChild(textBox(c.reflection[i], 'Write it down…', (v) => { c.reflection[i] = v; }, { label: q, multiline: true }));
      body.appendChild(row);
    });
    host.appendChild(card);
  }

  /* ---------- journal ---------- */
  {
    const { card, body } = signalCard('Journal', '');
    const area = textBox(c.journal, 'Anything on your mind…', (v) => { c.journal = v; }, { label: 'Journal', multiline: true, cls: 'sjournal' });
    body.appendChild(area);
    host.appendChild(card);
  }

  /* ---------- plan tomorrow ---------- */
  const plan = el('div', 'splan');
  const planBtn = el('button', 'btn-primary', 'Plan tomorrow &rarr;');
  planBtn.type = 'button';
  planBtn.addEventListener('click', () => goToDay(shiftDay(SV.day, 1)));
  plan.appendChild(el('p', 'axis-note', 'Tomorrow starts with your goals, a fresh checklist, what broke your speed today, and anything you didn’t check off.'));
  plan.appendChild(planBtn);
  host.appendChild(plan);

  renderSignalAside();
  paintSignalProgress();
  requestAnimationFrame(refitSignalBoxes);
}

/* ============================================================
   Beside the day: daily calls and the brain dump
   ============================================================ */

/* Call times use the portal clock's main time zone. */
function mainClockZone() {
  const saved = CACHE.me && CACHE.me.clock;
  const lead = saved && (saved.primary || (Array.isArray(saved.places) && saved.places[0]));
  if (lead && typeof lead === 'object' && lead.zone) return { zone: lead.zone, label: lead.label || zoneLabel(lead.zone) };
  if (typeof lead === 'string') return { zone: lead, label: zoneLabel(lead) };
  const zone = deviceZone();
  const city = CLOCK_CITIES.find((c) => c.zone === zone);
  return { zone, label: city ? city.name : zoneLabel(zone) };
}

/* Today's date and the minute of the day, in that zone. */
function zoneNow(zone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date());
  const get = (type) => (parts.find((p) => p.type === type) || {}).value || '';
  return { day: get('year') + '-' + get('month') + '-' + get('day'), minute: (+get('hour') % 24) * 60 + (+get('minute')) };
}

const callMinutes = (time) => (/^\d{1,2}:\d{2}$/.test(time || '') ? (+time.split(':')[0]) * 60 + (+time.split(':')[1]) : null);

function callTimeLabel(time) {
  const m = callMinutes(time);
  if (m == null) return '';
  const h = Math.floor(m / 60);
  const min = String(m % 60).padStart(2, '0');
  return CACHE.me && CACHE.me.clock && CACHE.me.clock.hour12
    ? (h % 12 || 12) + ':' + min + (h < 12 ? ' am' : ' pm')
    : String(h).padStart(2, '0') + ':' + min;
}

/* A pasted Meet or Zoom link, with or without https://. */
function meetingUrl(link) {
  const text = String(link || '').trim();
  if (!text) return '';
  const url = /^https?:\/\//i.test(text) ? text : 'https://' + text;
  try { return new URL(url).href; } catch (e) { return ''; }
}

function meetingKind(url) {
  if (/meet\.google\.com/i.test(url)) return 'Google Meet';
  if (/zoom\.us/i.test(url)) return 'Zoom';
  if (/teams\.microsoft|teams\.live/i.test(url)) return 'Teams';
  if (/calendly\.com/i.test(url)) return 'Calendly';
  return 'Link';
}

function sortCalls(calls) {
  return calls.sort((a, b) => {
    const x = callMinutes(a.time);
    const y = callMinutes(b.time);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return x - y;
  });
}

function renderSignalAside() {
  const c = SV.content;
  const host = $('#signalAside');
  if (!host || !c) return;
  host.textContent = '';
  const zone = mainClockZone();

  /* ---------- daily calls ---------- */
  const calls = el('section', 'panel scard sside-card');
  const head = el('div', 'scard-head');
  head.appendChild(el('h2', 'scard-title', 'Daily calls'));
  const count = el('span', 'scard-sub');
  count.id = 'signalCallCount';
  head.appendChild(count);
  calls.appendChild(head);
  const zoneNote = el('p', 'scall-zone');
  zoneNote.textContent = 'Times in ' + zone.label;
  calls.appendChild(zoneNote);

  const list = el('div', 'scall-list');
  if (!c.calls.length) list.appendChild(el('p', 'sempty', 'No calls for this day. Add one and paste its Meet link.'));
  sortCalls(c.calls).forEach((call) => {
    const row = el('div', 'scall' + (call.done ? ' is-done' : ''));
    row.dataset.id = call.id;

    const top = el('div', 'scall-top');
    top.appendChild(checkBox(call.done, call.title || 'call', (on) => { call.done = on; row.classList.toggle('is-done', on); paintSignalCalls(); }));

    const time = document.createElement('input');
    time.type = 'time';
    time.className = 'scall-time';
    time.value = call.time || '';
    time.setAttribute('aria-label', 'Call time');
    time.addEventListener('change', () => { call.time = time.value; signalChanged(); renderSignalAside(); });
    top.appendChild(time);

    const title = document.createElement('input');
    title.type = 'text';
    title.className = 'scall-title';
    title.placeholder = 'Call title';
    title.value = call.title || '';
    title.setAttribute('aria-label', 'Call title');
    title.addEventListener('input', () => { call.title = title.value; signalChanged(); });
    top.appendChild(title);

    top.appendChild(removeButton('call', () => { c.calls = c.calls.filter((x) => x !== call); signalChanged(); renderSignalAside(); }));
    row.appendChild(top);

    const bottom = el('div', 'scall-bottom');
    const link = document.createElement('input');
    link.type = 'text';
    link.className = 'scall-link';
    link.placeholder = 'Paste the Meet link';
    link.value = call.link || '';
    link.setAttribute('aria-label', 'Meeting link');
    link.addEventListener('input', () => { call.link = link.value.trim(); signalChanged(); paintJoin(); });
    bottom.appendChild(link);

    const join = el('a', 'scall-join');
    join.target = '_blank';
    join.rel = 'noopener noreferrer';
    const paintJoin = () => {
      const url = meetingUrl(call.link);
      join.classList.toggle('hidden', !url);
      if (url) { join.href = url; join.textContent = 'Join ' + meetingKind(url) + ' \u2197'; }
    };
    paintJoin();
    bottom.appendChild(join);
    bottom.appendChild(el('span', 'scall-when'));
    row.appendChild(bottom);

    list.appendChild(row);
  });
  calls.appendChild(list);
  calls.appendChild(addButton('Add a call', () => {
    const call = { id: sid(), time: '', title: '', link: '', done: false };
    c.calls.push(call);
    signalChanged();
    renderSignalAside();
    focusLater('.scall[data-id="' + call.id + '"] .scall-title');
  }));
  host.appendChild(calls);

  /* ---------- daily brain dump ---------- */
  const dump = el('section', 'panel scard sside-card sdump-card');
  const dumpHead = el('div', 'scard-head');
  dumpHead.appendChild(el('h2', 'scard-title', 'Daily brain dump'));
  dumpHead.appendChild(el('span', 'scard-sub', asDate(SV.day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })));
  dump.appendChild(dumpHead);
  const area = textBox(c.dump, 'Anything — reminders, notes, what Tom just said on the call…', (v) => { c.dump = v; }, { label: 'Daily brain dump', multiline: true, cls: 'sdump' });
  dump.appendChild(area);
  dump.appendChild(el('p', 'sdump-note', 'Each day starts blank. Open any past day on the calendar to read it again.'));
  host.appendChild(dump);

  paintSignalCalls();
  requestAnimationFrame(() => fitArea(area));
}

/* The count, and "now" / "in 12 min" beside each call. Runs every 30 seconds. */
function paintSignalCalls() {
  const c = SV.content;
  if (!c || !$('#signalAside')) return;
  const zone = mainClockZone();
  const now = zoneNow(zone.zone);
  const isToday = SV.day === now.day;

  const open = c.calls.filter((x) => !x.done && (x.title.trim() || x.link.trim() || x.time));
  const count = $('#signalCallCount');
  if (count) count.textContent = c.calls.length ? (c.calls.length - open.length) + ' / ' + c.calls.length + ' done' : '';

  let nextMarked = false;
  document.querySelectorAll('#signalAside .scall').forEach((row) => {
    const call = c.calls.find((x) => x.id === row.dataset.id);
    const when = row.querySelector('.scall-when');
    row.classList.remove('is-next', 'is-now');
    when.textContent = '';
    if (!call || call.done || !isToday) return;
    const m = callMinutes(call.time);
    if (m == null) return;
    const diff = m - now.minute;
    if (diff <= 0 && diff > -45) { row.classList.add('is-now'); when.textContent = diff === 0 ? 'Starting now' : 'Started ' + -diff + ' min ago'; return; }
    if (diff > 0 && !nextMarked) {
      nextMarked = true;
      row.classList.add('is-next');
      when.textContent = diff < 60 ? 'in ' + diff + ' min' : 'in ' + Math.floor(diff / 60) + 'h' + (diff % 60 ? ' ' + (diff % 60) + 'm' : '');
    }
  });
}

function paintSignalProgress() {
  const c = SV.content;
  if (!c) return;
  const morningDone = c.checklist.filter((x) => x.done).length;
  const actions = c.signals.filter((s) => s.text.trim());
  const actionsDone = actions.filter((s) => s.done).length;
  const morning = $('#signalMorningCount');
  if (morning) morning.textContent = morningDone + ' / ' + c.checklist.length;
  const count = $('#signalActionCount');
  if (count) count.textContent = actions.length ? actionsDone + ' / ' + actions.length + ' done' : '3–4 a day';
  $('#signalProgress').textContent = 'Morning ' + morningDone + '/' + c.checklist.length + '  ·  Signal actions ' + actionsDone + '/' + actions.length;
  const subCount = $('#signalSubCount');
  if (subCount) {
    const subs = (c.subs || []).filter((x) => x.text.trim());
    subCount.textContent = subs.length ? subs.filter((x) => x.done).length + ' / ' + subs.length : '';
  }
  const auto = $('#signalReflectAuto');
  if (auto) auto.textContent = actions.length ? actionsDone + ' of ' + actions.length + ' checked off' : '';
}

/* ---------- the calendar ----------
   A month at a time. Every day you wrote something has a dot —
   green when every signal action got done, amber when some did,
   grey when it was started. Click any day to open it. */
async function paintSignalCalendar() {
  const first = SV.month || new Date(asDate(SV.day).getFullYear(), asDate(SV.day).getMonth(), 1);
  SV.month = first;
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  $('#signalMonth').textContent = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  let rows = [];
  try { rows = SV.ready ? await loadSignalWeek(isoDay(first), isoDay(last)) : []; } catch (err) { rows = []; }
  const byDay = {};
  rows.forEach((r) => { byDay[r.day] = r.content; });
  if (SV.content && SV.dirty) byDay[SV.day] = SV.content;

  const grid = $('#signalCalendar');
  grid.textContent = '';
  DAY_NAMES.forEach((n) => grid.appendChild(el('span', 'scal-name', n.slice(0, 2))));
  for (let i = 0; i < (first.getDay() + 6) % 7; i++) grid.appendChild(el('span', 'scal-blank'));

  let written = 0;
  let allDone = 0;
  for (let d = 1; d <= last.getDate(); d++) {
    const iso = isoDay(new Date(first.getFullYear(), first.getMonth(), d));
    const content = byDay[iso];
    const b = el('button', 'scal-day' + (iso === SV.day ? ' is-current' : '') + (iso === todayIso() ? ' is-today' : '') + (iso > todayIso() ? ' is-future' : ''));
    b.type = 'button';
    b.appendChild(el('span', 'scal-num', String(d)));
    const dot = el('span', 'scal-dot');
    let label = asDate(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    if (content) {
      written++;
      const actions = (content.signals || []).filter((s) => s.text && s.text.trim());
      const done = actions.filter((s) => s.done).length;
      if (actions.length && done === actions.length) allDone++;
      dot.classList.add(actions.length && done === actions.length ? 'is-full' : done ? 'is-part' : 'is-planned');
      label += actions.length ? ' — ' + done + ' of ' + actions.length + ' signal actions done' : ' — started';
    }
    b.title = label;
    b.setAttribute('aria-label', label);
    b.appendChild(dot);
    b.addEventListener('click', () => goToDay(iso));
    grid.appendChild(b);
  }
  $('#signalMonthSummary').textContent = written
    ? written + (written === 1 ? ' day' : ' days') + ' written · ' + allDone + ' with every signal action done'
    : 'Nothing written this month yet';
}

function moveSignalMonth(n) {
  const m = SV.month || new Date();
  SV.month = new Date(m.getFullYear(), m.getMonth() + n, 1);
  paintSignalCalendar();
}

/* ============================================================
   Customize — the defaults every new day starts from
   ============================================================ */
function openSignalCustomize() {
  const t = SV.template;
  $('#sFocus').value = t.focus || '';
  $('#sChecklist').value = t.checklist.join('\n');
  $('#sQuestions').value = t.questions.join('\n');
  $('#sDayStart').value = t.dayStart;
  $('#sDayEnd').value = t.dayEnd;
  $('#signalCustomize').classList.remove('hidden');
  $('#sFocus').focus();
}

async function saveSignalCustomize(e) {
  e.preventDefault();
  const lines = (v) => v.split('\n').map((x) => x.trim()).filter(Boolean);
  const t = SV.template;
  t.focus = $('#sFocus').value.trim();
  t.checklist = lines($('#sChecklist').value);
  t.questions = lines($('#sQuestions').value);
  if ($('#sDayStart').value < $('#sDayEnd').value) { t.dayStart = $('#sDayStart').value; t.dayEnd = $('#sDayEnd').value; }
  if (!(await saveTemplateNow())) return;
  $('#signalCustomize').classList.add('hidden');
  renderSignal();
  notify('Defaults saved. Focus, questions and times apply now; the checklist applies to new days.');
}

function fillTimeSelect(sel) {
  sel.textContent = '';
  for (let m = 4 * 60; m <= 24 * 60 - 30; m += 30) {
    const t = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    const h = Math.floor(m / 60);
    const o = el('option', null, (h % 12 || 12) + ':' + t.slice(3) + (h < 12 ? ' am' : ' pm'));
    o.value = t;
    sel.appendChild(o);
  }
}

/* ============================================================
   Moving between days
   ============================================================ */
async function goToDay(iso) {
  if (SV.loading) return;
  if (window.closeSignalCalendar) window.closeSignalCalendar();
  if (SV.dirty) {
    clearTimeout(SV.saveTimer);
    try { await saveSignalDay(SV.day, SV.content); SV.dirty = false; } catch (err) { notify("Couldn't save — check your connection."); return; }
  }
  SV.loading = true;
  try {
    SV.day = iso;
    history.replaceState(null, '', SIGNAL_PATH + (iso === todayIso() ? '' : '?day=' + iso));
    let row = null;
    let previous = null;
    if (SV.ready) {
      row = await loadSignalDay(iso);
      if (!row) previous = await loadSignalDayBefore(iso);
    }
    SV.content = upgradeSignalDay(row ? row.content : freshDay(SV.template, previous));
    const shown = asDate(iso);
    if (!SV.month || SV.month.getMonth() !== shown.getMonth() || SV.month.getFullYear() !== shown.getFullYear()) {
      SV.month = new Date(shown.getFullYear(), shown.getMonth(), 1);
    }
    $('#signalSaved').textContent = row ? 'Saved' : 'New day — starts saving when you type';
    renderSignal();
    paintSignalCalendar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error(err);
    notify("Couldn't open that day — check your connection.");
  } finally {
    SV.loading = false;
  }
}

async function initSignal() {
  document.title = 'Signal List · Inevitable Acquisition';
  const saved = await loadSignalTemplate();
  SV.ready = saved.ready;
  SV.template = templateWithDefaults(saved.template);

  $('#signalPrev').addEventListener('click', () => goToDay(shiftDay(SV.day, -1)));
  $('#signalNext').addEventListener('click', () => goToDay(shiftDay(SV.day, 1)));
  $('#signalToday').addEventListener('click', () => goToDay(todayIso()));
  $('#signalCustomizeBtn').addEventListener('click', openSignalCustomize);
  $('#signalMonthPrev').addEventListener('click', () => moveSignalMonth(-1));

  /* The calendar opens under its button and closes when you pick a day,
     click anywhere else, or press Escape. */
  const pop = $('#signalCalendarPop');
  const toggle = $('#signalCalendarBtn');
  const showCalendar = (open) => {
    pop.classList.toggle('hidden', !open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      const shown = asDate(SV.day);
      SV.month = new Date(shown.getFullYear(), shown.getMonth(), 1);
      paintSignalCalendar();
    }
  };
  toggle.addEventListener('click', (e) => { e.stopPropagation(); showCalendar(pop.classList.contains('hidden')); });
  pop.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => { if (!pop.classList.contains('hidden')) showCalendar(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.classList.contains('hidden')) showCalendar(false); });
  window.closeSignalCalendar = () => showCalendar(false);
  setInterval(() => { if (!$('#signalShell').classList.contains('hidden')) paintSignalCalls(); }, 30000);
  window.addEventListener('resize', () => { if (!$('#signalShell').classList.contains('hidden')) refitSignalBoxes(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refitSignalBoxes);
  $('#signalMonthNext').addEventListener('click', () => moveSignalMonth(1));
  $('#signalCustomizeCancel').addEventListener('click', () => $('#signalCustomize').classList.add('hidden'));
  $('#signalCustomizeForm').addEventListener('submit', saveSignalCustomize);
  fillTimeSelect($('#sDayStart'));
  fillTimeSelect($('#sDayEnd'));

  /* Coming back from another device or tab: pick up the latest, unless typing. */
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || SV.dirty || !SV.ready) return;
    const typing = document.activeElement && document.activeElement.closest && document.activeElement.closest('#signalShell textarea');
    if (typing) return;
    try {
      const row = await loadSignalDay(SV.day);
      if (row && JSON.stringify(row.content) !== JSON.stringify(SV.content)) { SV.content = upgradeSignalDay(row.content); renderSignal(); paintSignalCalendar(); }
    } catch (err) { /* next time */ }
  });

  const asked = new URLSearchParams(location.search).get('day');
  await goToDay(/^\d{4}-\d{2}-\d{2}$/.test(asked || '') ? asked : todayIso());
}

/* For the portal card: today's signal actions. */
async function signalSummaryForToday() {
  try {
    const row = await loadSignalDay(todayIso());
    if (!row) return null;
    return (row.content.signals || []).filter((s) => s.text && s.text.trim());
  } catch (err) {
    return null;
  }
}
