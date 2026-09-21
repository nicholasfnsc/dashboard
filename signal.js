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
    /* The brain dump holds reminders as often as it holds notes, so it
       travels too. Deleting a line is what ends it. */
    if (typeof prev.dump === 'string' && prev.dump.trim()) content.dump = prev.dump;
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
/* The day as it was, before whatever just changed. */
const SIGNAL_HISTORY = makeHistory(
  () => SV.content,
  (was) => {
    SV.content = was;
    renderSignal();
    paintSignalCalendar();
    SV.dirty = true;
    clearTimeout(SV.saveTimer);
    const day = SV.day;
    SV.saveTimer = setTimeout(() => saveSignalDay(day, SV.content).catch((err) => console.error(err)), 400);
    notify('Undone.');
  }
);

function signalChanged() {
  SIGNAL_HISTORY.remember();
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
  document.querySelectorAll('#signalShell textarea:not(.sdump)').forEach(fitArea);
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
  /* A box that keeps its own height scrolls itself, so what was written
     first stays one scroll away instead of being pushed off the top. */
  if (opts && opts.ownScroll) return area;
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
    const x = callMinutes(a.start);
    const y = callMinutes(b.start);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return x - y;
  });
}

/* ---------- repeating calls ----------
   Kept with your defaults, not on any one day, so they appear on every
   day they repeat. Each day only remembers whether you checked it off. */
const REPEAT_LABELS = { daily: 'Every day', weekdays: 'Weekdays', weekly: 'Weekly' };
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function repeatingCalls() {
  if (!Array.isArray(SV.template.calls)) SV.template.calls = [];
  return SV.template.calls;
}

function occursOn(call, iso) {
  if (!call.repeat || iso < call.from) return false;
  if (call.until && iso > call.until) return false;
  if ((call.skip || []).indexOf(iso) !== -1) return false;
  const weekday = asDate(iso).getDay();
  if (call.repeat === 'daily') return true;
  if (call.repeat === 'weekdays') return weekday >= 1 && weekday <= 5;
  return (call.days || []).indexOf(weekday) !== -1;
}

function repeatText(call) {
  if (!call.repeat) return '';
  if (call.repeat !== 'weekly') return REPEAT_LABELS[call.repeat];
  const days = (call.days || []).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  return days.length === 7 ? 'Every day' : 'Every ' + days.map((d) => WEEKDAY_SHORT[d]).join(', ');
}

/* One-off calls for this day, plus every repeating call that falls on it. */
function callsForDay() {
  const c = SV.content;
  if (!c.doneRepeats || typeof c.doneRepeats !== 'object') c.doneRepeats = {};
  const own = c.calls.map((call) => Object.assign(call, { start: call.start || call.time || '' }));
  const repeats = repeatingCalls().filter((r) => occursOn(r, SV.day))
    .map((r) => Object.assign({}, r, { done: !!c.doneRepeats[r.id], repeating: true }));
  return sortCalls(own.concat(repeats));
}

function callRangeLabel(call) {
  const start = callTimeLabel(call.start);
  const end = callTimeLabel(call.end);
  if (!start) return 'No time set';
  if (!end) return start;
  const twelve = CACHE.me && CACHE.me.clock && CACHE.me.clock.hour12;
  if (twelve && start.slice(-2) === end.slice(-2)) return start.slice(0, -3) + ' – ' + end;
  return start + ' – ' + end;
}

const LOOP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/></svg>';

function renderSignalAside() {
  const c = SV.content;
  const host = $('#signalAside');
  if (!host || !c) return;
  host.textContent = '';
  const zone = mainClockZone();

  /* ---------- daily calls ---------- */
  const card = el('section', 'panel scard sside-card');
  const head = el('div', 'scard-head');
  head.appendChild(el('h2', 'scard-title', 'Daily calls'));
  const count = el('span', 'scard-sub');
  count.id = 'signalCallCount';
  head.appendChild(count);
  card.appendChild(head);
  const zoneNote = el('p', 'scall-zone');
  zoneNote.textContent = 'Times in ' + zone.label;
  card.appendChild(zoneNote);

  const list = el('div', 'scall-list');
  const calls = callsForDay();
  if (!calls.length) list.appendChild(el('p', 'sempty', 'No calls on this day.'));
  calls.forEach((call) => {
    const row = el('div', 'scall' + (call.done ? ' is-done' : ''));
    row.dataset.id = call.id;

    row.appendChild(checkBox(call.done, call.title || 'call', (on) => {
      if (call.repeating) c.doneRepeats[call.id] = on;
      else c.calls.find((x) => x.id === call.id).done = on;
      row.classList.toggle('is-done', on);
      paintSignalCalls();
    }));

    const open = el('button', 'scall-body');
    open.type = 'button';
    open.title = 'Edit call';
    const title = el('span', 'scall-title');
    title.textContent = call.title || 'Untitled call';
    open.appendChild(title);
    const meta = el('span', 'scall-meta');
    meta.appendChild(el('span', 'scall-range', callRangeLabel(call)));
    if (call.repeating) {
      const loop = el('span', 'scall-loop', LOOP_ICON);
      loop.title = repeatText(call);
      meta.appendChild(loop);
    }
    meta.appendChild(el('span', 'scall-when'));
    open.appendChild(meta);
    open.addEventListener('click', () => openCallEditor(call));
    row.appendChild(open);

    const url = meetingUrl(call.link);
    if (url) {
      const join = el('a', 'scall-join', 'Join');
      join.href = url;
      join.target = '_blank';
      join.rel = 'noopener noreferrer';
      join.title = 'Join on ' + meetingKind(url);
      row.appendChild(join);
    }
    list.appendChild(row);
  });
  card.appendChild(list);
  card.appendChild(addButton('Add a call', () => openCallEditor(null)));
  host.appendChild(card);

  /* ---------- daily brain dump ---------- */
  const dump = el('section', 'panel scard sside-card sdump-card');
  const dumpHead = el('div', 'scard-head');
  dumpHead.appendChild(el('h2', 'scard-title', 'Daily brain dump'));
  dumpHead.appendChild(el('span', 'scard-sub', asDate(SV.day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })));
  dump.appendChild(dumpHead);
  const area = textBox(c.dump, 'Anything — reminders, notes, things to keep in mind…', (v) => { c.dump = v; }, { label: 'Daily brain dump', multiline: true, cls: 'sdump', ownScroll: true });
  dump.appendChild(area);
  dump.appendChild(el('p', 'sdump-note', 'Whatever you leave here comes with you tomorrow. Delete a line to stop it. Drag the corner for a taller box.'));
  host.appendChild(dump);

  paintSignalCalls();
}

/* The count, and "now" / "in 12 min" beside each call. Runs every 30 seconds. */
function paintSignalCalls() {
  const c = SV.content;
  if (!c || !$('#signalAside')) return;
  const now = zoneNow(mainClockZone().zone);
  const isToday = SV.day === now.day;
  const calls = callsForDay();

  const count = $('#signalCallCount');
  if (count) count.textContent = calls.length ? calls.filter((x) => x.done).length + ' / ' + calls.length + ' done' : '';

  let nextMarked = false;
  document.querySelectorAll('#signalAside .scall').forEach((row) => {
    const call = calls.find((x) => x.id === row.dataset.id);
    const when = row.querySelector('.scall-when');
    row.classList.remove('is-next', 'is-now');
    when.textContent = '';
    if (!call || call.done || !isToday) return;
    const start = callMinutes(call.start);
    if (start == null) return;
    const end = callMinutes(call.end);
    const diff = start - now.minute;
    const running = diff <= 0 && (end != null ? now.minute < end : diff > -45);
    if (running) { row.classList.add('is-now'); when.textContent = 'Now'; return; }
    if (diff > 0 && !nextMarked) {
      nextMarked = true;
      row.classList.add('is-next');
      when.textContent = diff < 60 ? 'in ' + diff + ' min' : 'in ' + Math.floor(diff / 60) + 'h' + (diff % 60 ? ' ' + (diff % 60) + 'm' : '');
    }
  });
}

/* ============================================================
   The call window — like Google Calendar's
   ============================================================ */
const toClock = (minutes) => String(Math.floor(minutes / 60) % 24).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');

function durationText(minutes) {
  if (minutes <= 0) return '';
  if (minutes < 60) return minutes + ' min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h + (h === 1 ? ' hr' : ' hrs') + (m ? ' ' + m + ' min' : '');
}

/* A time chooser: a button that opens a dark list in 15-minute steps. */
function timeChooser(getValue, onPick, opts) {
  const wrap = el('div', 'tpick');
  const button = el('button', 'tpick-button');
  button.type = 'button';
  const list = el('div', 'tpick-list hidden');
  list.setAttribute('role', 'listbox');

  const paint = () => { button.textContent = callTimeLabel(getValue()) || 'Time'; };
  const close = () => { list.classList.add('hidden'); wrap.classList.remove('is-open'); };

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = list.classList.contains('hidden');
    document.querySelectorAll('.tpick-list').forEach((l) => l.classList.add('hidden'));
    document.querySelectorAll('.tpick.is-open').forEach((w) => w.classList.remove('is-open'));
    if (!opening) return;
    list.textContent = '';
    const from = opts && opts.after ? callMinutes(opts.after()) : null;
    const first = from != null ? from + 15 : 0;
    const last = from != null ? from + 12 * 60 : 24 * 60 - 15;
    let selected = null;
    for (let m = first; m <= last; m += 15) {
      if (from == null && m >= 24 * 60) break;
      const value = toClock(m);
      const item = el('button', 'tpick-item' + (value === getValue() ? ' is-on' : ''));
      item.type = 'button';
      item.appendChild(el('span', null, callTimeLabel(value)));
      if (from != null) item.appendChild(el('small', null, durationText(m - from)));
      item.addEventListener('click', (ev) => { ev.stopPropagation(); onPick(value); paint(); close(); });
      list.appendChild(item);
      if (value === getValue()) selected = item;
    }
    list.classList.remove('hidden');
    wrap.classList.add('is-open');
    const target = selected || (from == null ? list.children[Math.min(36, list.children.length - 1)] : null);
    if (target) list.scrollTop = target.offsetTop - 60;
  });
  list.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', close);

  wrap.appendChild(button);
  wrap.appendChild(list);
  wrap.paint = paint;
  paint();
  return wrap;
}

function openCallEditor(existing) {
  const modal = $('#callEditor');
  const form = $('#callEditorBody');
  form.textContent = '';
  const series = existing && existing.repeating ? repeatingCalls().find((r) => r.id === existing.id) : null;
  const own = existing && !existing.repeating ? SV.content.calls.find((x) => x.id === existing.id) : null;
  const source = series || own || {};
  const weekday = asDate(SV.day).getDay();

  const draft = {
    title: source.title || '',
    start: source.start || source.time || '',
    end: source.end || '',
    link: source.link || '',
    repeat: source.repeat || '',
    days: Array.isArray(source.days) && source.days.length ? source.days.slice() : [weekday]
  };
  if (!draft.start) {
    const now = zoneNow(mainClockZone().zone).minute;
    const rounded = Math.min(Math.ceil((now + 1) / 15) * 15, 23 * 60);
    draft.start = SV.day === todayIso() ? toClock(rounded) : '09:00';
  }
  if (!draft.end) draft.end = toClock(Math.min(callMinutes(draft.start) + 30, 24 * 60 - 1));

  $('#callEditorTitle').textContent = existing ? 'Edit call' : 'New call';

  const title = document.createElement('input');
  title.type = 'text';
  title.className = 'cedit-title';
  title.placeholder = 'Add a title';
  title.value = draft.title;
  title.setAttribute('aria-label', 'Call title');
  title.addEventListener('input', () => { draft.title = title.value; });
  form.appendChild(title);

  const timeRow = el('div', 'cedit-row');
  timeRow.appendChild(el('span', 'cedit-icon', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'));
  const dayLabel = el('span', 'cedit-day');
  dayLabel.textContent = asDate(SV.day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  timeRow.appendChild(dayLabel);
  let endChooser = null;
  const startChooser = timeChooser(() => draft.start, (v) => {
    const length = callMinutes(draft.end) - callMinutes(draft.start);
    draft.start = v;
    draft.end = toClock(Math.min(callMinutes(v) + (length > 0 ? length : 30), 24 * 60 - 1));
    if (endChooser) endChooser.paint();
  });
  endChooser = timeChooser(() => draft.end, (v) => { draft.end = v; }, { after: () => draft.start });
  const times = el('div', 'cedit-times');
  times.appendChild(startChooser);
  times.appendChild(el('span', 'cedit-dash', '–'));
  times.appendChild(endChooser);
  timeRow.appendChild(times);
  form.appendChild(timeRow);

  const repeatRow = el('div', 'cedit-row cedit-repeat');
  repeatRow.appendChild(el('span', 'cedit-icon', LOOP_ICON));
  const choices = el('div', 'cedit-choices');
  const dayChips = el('div', 'cedit-days');
  const paintRepeat = () => {
    choices.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.repeat === draft.repeat)));
    dayChips.classList.toggle('hidden', draft.repeat !== 'weekly');
    dayChips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(draft.days.indexOf(+b.dataset.day) !== -1)));
  };
  [['', "Doesn't repeat"], ['daily', 'Every day'], ['weekdays', 'Weekdays'], ['weekly', 'Weekly on…']].forEach(([value, label]) => {
    const b = el('button', 'cedit-choice', label);
    b.type = 'button';
    b.dataset.repeat = value;
    b.addEventListener('click', () => { draft.repeat = value; paintRepeat(); });
    choices.appendChild(b);
  });
  [1, 2, 3, 4, 5, 6, 0].forEach((d) => {
    const b = el('button', 'cedit-daychip', WEEKDAY_SHORT[d].slice(0, 2));
    b.type = 'button';
    b.dataset.day = String(d);
    b.title = WEEKDAY_SHORT[d];
    b.addEventListener('click', () => {
      draft.days = draft.days.indexOf(d) === -1 ? draft.days.concat([d]) : draft.days.filter((x) => x !== d);
      if (!draft.days.length) draft.days = [d];
      paintRepeat();
    });
    dayChips.appendChild(b);
  });
  const repeatWrap = el('div', 'cedit-repeat-wrap');
  repeatWrap.appendChild(choices);
  repeatWrap.appendChild(dayChips);
  repeatRow.appendChild(repeatWrap);
  form.appendChild(repeatRow);
  paintRepeat();

  const linkRow = el('div', 'cedit-row');
  linkRow.appendChild(el('span', 'cedit-icon', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6.5" width="13" height="11" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/></svg>'));
  const link = document.createElement('input');
  link.type = 'text';
  link.className = 'cedit-link';
  link.placeholder = 'Paste the Google Meet or Zoom link';
  link.value = draft.link;
  link.setAttribute('aria-label', 'Meeting link');
  link.addEventListener('input', () => { draft.link = link.value.trim(); });
  linkRow.appendChild(link);
  form.appendChild(linkRow);

  /* ---------- buttons ---------- */
  const actions = el('div', 'cedit-actions');
  const left = el('div', 'cedit-left');
  if (existing) {
    if (series) {
      const skip = el('button', 'link-btn danger', 'Remove from this day');
      skip.type = 'button';
      skip.addEventListener('click', async () => {
        series.skip = (series.skip || []).concat([SV.day]);
        closeCallEditor();
        await saveTemplateNow();
        renderSignalAside();
      });
      left.appendChild(skip);
      const stop = el('button', 'link-btn danger', 'Delete this and future');
      stop.type = 'button';
      stop.addEventListener('click', async () => {
        if (SV.day <= series.from) SV.template.calls = repeatingCalls().filter((r) => r !== series);
        else series.until = shiftDay(SV.day, -1);
        closeCallEditor();
        await saveTemplateNow();
        renderSignalAside();
      });
      left.appendChild(stop);
    } else {
      const del = el('button', 'link-btn danger', 'Delete');
      del.type = 'button';
      del.addEventListener('click', () => {
        SV.content.calls = SV.content.calls.filter((x) => x !== own);
        signalChanged();
        closeCallEditor();
        renderSignalAside();
      });
      left.appendChild(del);
    }
  }
  actions.appendChild(left);

  const right = el('div', 'cedit-right');
  const cancel = el('button', 'link-btn', 'Cancel');
  cancel.type = 'button';
  cancel.addEventListener('click', closeCallEditor);
  right.appendChild(cancel);
  const save = el('button', 'btn-primary', 'Save');
  save.type = 'button';
  save.addEventListener('click', async () => {
    const fields = { title: draft.title.trim(), start: draft.start, end: draft.end, link: draft.link };
    const repeat = draft.repeat ? { repeat: draft.repeat, days: draft.repeat === 'weekly' ? draft.days.slice() : [] } : null;

    if (series && repeat) {
      /* Changing a repeating call changes it from this day on; earlier days keep what they had. */
      if (SV.day > series.from) {
        series.until = shiftDay(SV.day, -1);
        repeatingCalls().push(Object.assign({ id: sid(), from: SV.day }, fields, repeat));
      } else {
        Object.assign(series, fields, repeat);
      }
    } else if (series && !repeat) {
      /* No longer repeating: it stays on this day only. */
      if (SV.day > series.from) series.until = shiftDay(SV.day, -1);
      else SV.template.calls = repeatingCalls().filter((r) => r !== series);
      SV.content.calls.push(Object.assign({ id: sid(), done: false }, fields));
      signalChanged();
    } else if (own && repeat) {
      SV.content.calls = SV.content.calls.filter((x) => x !== own);
      repeatingCalls().push(Object.assign({ id: sid(), from: SV.day }, fields, repeat));
      signalChanged();
    } else if (own) {
      Object.assign(own, fields);
      signalChanged();
    } else if (repeat) {
      repeatingCalls().push(Object.assign({ id: sid(), from: SV.day }, fields, repeat));
    } else {
      SV.content.calls.push(Object.assign({ id: sid(), done: false }, fields));
      signalChanged();
    }
    if (repeat || series) await saveTemplateNow();
    closeCallEditor();
    renderSignalAside();
  });
  right.appendChild(save);
  actions.appendChild(right);
  form.appendChild(actions);

  modal.classList.remove('hidden');
  if (!existing) title.focus();
}

function closeCallEditor() {
  $('#callEditor').classList.add('hidden');
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
    SIGNAL_HISTORY.reset();
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

registerUndo({
  label: 'signal list',
  when: () => shellShown('signalShell'),
  undo: () => SIGNAL_HISTORY.undo(),
  redo: () => SIGNAL_HISTORY.redo()
});

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
  $('#callEditor').addEventListener('click', (e) => { if (e.target.id === 'callEditor') closeCallEditor(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#callEditor').classList.contains('hidden')) closeCallEditor(); });
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
