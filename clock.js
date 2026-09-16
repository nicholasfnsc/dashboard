/* ============================================================
   clock.js — the portal clock
   ------------------------------------------------------------
   Beside the greeting: the time where you are (or wherever you
   choose), with any other cities you want to watch underneath.

   Click it to pick time zones: search any city in the world, tick
   the ones to show, and star the one that leads. Your choice is kept
   on your account, so it is the same on every device.
   ============================================================ */

const CLOCK = { zones: [], primary: '', hour12: false, timer: 0, filter: '' };

const deviceZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; }
};

/* The browser gives "America/Sao_Paulo", so the last part is tidied up. */
function zoneLabel(zone) {
  const tail = String(zone).split('/').pop() || zone;
  return tail.replace(/_/g, ' ').replace(/^St /, 'St. ');
}

const zoneRegion = (zone) => String(zone).split('/')[0].replace(/_/g, ' ');

function allZones() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone');
  } catch (e) { /* older browser */ }
  return ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Sao_Paulo', 'America/Mexico_City', 'Europe/London', 'Europe/Lisbon', 'Europe/Madrid',
    'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'];
}

function clockParts(zone, when) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: CLOCK.hour12
  }).formatToParts(when);
  const get = (type) => (parts.find((p) => p.type === type) || {}).value || '';
  return {
    hhmm: get('hour') + ':' + get('minute'),
    suffix: (get('dayPeriod') || '').toLowerCase(),
    seconds: new Intl.DateTimeFormat('en-GB', { timeZone: zone, second: '2-digit' }).format(when),
    day: new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', month: 'short', day: 'numeric' }).format(when),
    label: zoneLabel(zone)
  };
}

/* How far ahead or behind a zone is from the one that leads. */
function clockOffset(zone, from, when) {
  const minutes = (z) => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: z, hour: '2-digit', minute: '2-digit', hour12: false, day: '2-digit' }).formatToParts(when);
    const get = (type) => Number((parts.find((p) => p.type === type) || {}).value || 0);
    return get('day') * 1440 + get('hour') * 60 + get('minute');
  };
  let diff = minutes(zone) - minutes(from);
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  if (!diff) return 'same time';
  const abs = Math.abs(diff);
  const mins = abs % 60;
  return (diff > 0 ? '+' : '−') + Math.floor(abs / 60) + (mins ? ':' + String(mins).padStart(2, '0') : '') + 'h';
}

/* ---------- what is shown ---------- */
function readClockSettings() {
  const saved = (CACHE.me && CACHE.me.clock) || {};
  CLOCK.primary = saved.primary || deviceZone();
  CLOCK.zones = Array.isArray(saved.zones) ? saved.zones.slice() : [];
  CLOCK.hour12 = saved.hour12 === true;
}

async function saveClockSettings() {
  const clock = { primary: CLOCK.primary, zones: CLOCK.zones, hour12: CLOCK.hour12 };
  CACHE.me.clock = clock;
  try {
    const { error } = await sb.auth.updateUser({ data: { clock } });
    if (error) throw error;
  } catch (err) {
    console.error(err);
    notify("Couldn't save your clock — check your connection.");
  }
}

function paintClock() {
  const shell = $('#portalShell');
  if (!shell || shell.classList.contains('hidden')) return;
  const now = new Date();
  const main = clockParts(CLOCK.primary, now);

  $('#clockTime').textContent = main.hhmm;
  $('#clockSeconds').textContent = main.seconds;
  $('#clockSuffix').textContent = main.suffix;
  $('#clockZone').textContent = main.label;
  $('#clockDay').textContent = main.day;

  const others = $('#clockOthers');
  const wanted = CLOCK.zones.filter((z) => z !== CLOCK.primary);
  if (others.childElementCount !== wanted.length) {
    others.textContent = '';
    wanted.forEach((zone) => {
      const row = el('div', 'clock-row');
      row.dataset.zone = zone;
      row.appendChild(el('span', 'clock-row-city'));
      row.appendChild(el('span', 'clock-row-time'));
      row.appendChild(el('span', 'clock-row-diff'));
      others.appendChild(row);
    });
  }
  wanted.forEach((zone, i) => {
    const row = others.children[i];
    const parts = clockParts(zone, now);
    row.querySelector('.clock-row-city').textContent = parts.label;
    row.querySelector('.clock-row-time').textContent = parts.hhmm + (parts.suffix ? ' ' + parts.suffix : '');
    row.querySelector('.clock-row-diff').textContent = clockOffset(zone, CLOCK.primary, now);
  });
}

function startClock() {
  readClockSettings();
  paintClock();
  clearInterval(CLOCK.timer);
  CLOCK.timer = setInterval(paintClock, 1000);
}

/* ---------- choosing zones ---------- */
function renderZoneList() {
  const host = $('#zoneList');
  host.textContent = '';
  const now = new Date();
  const search = CLOCK.filter.trim().toLowerCase().replace(/_/g, ' ');
  const chosen = [CLOCK.primary].concat(CLOCK.zones.filter((z) => z !== CLOCK.primary));
  const pool = search
    ? allZones().filter((z) => z.toLowerCase().replace(/_/g, ' ').indexOf(search) !== -1).slice(0, 60)
    : chosen;

  if (!search) host.appendChild(el('p', 'zone-hint', 'On your portal now. Search above to add a city.'));
  if (search && !pool.length) host.appendChild(el('p', 'zone-hint', 'No city matches that search.'));

  pool.forEach((zone) => {
    const row = el('div', 'zone-row' + (zone === CLOCK.primary ? ' is-primary' : ''));

    const star = el('button', 'zone-star' + (zone === CLOCK.primary ? ' is-on' : ''));
    star.type = 'button';
    star.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"/></svg>';
    star.title = 'Make this the main clock';
    star.setAttribute('aria-label', 'Make ' + zoneLabel(zone) + ' the main clock');
    star.addEventListener('click', async () => {
      if (CLOCK.primary === zone) return;
      const old = CLOCK.primary;
      CLOCK.primary = zone;
      CLOCK.zones = CLOCK.zones.filter((z) => z !== zone);
      if (old && CLOCK.zones.indexOf(old) === -1) CLOCK.zones.push(old);
      await saveClockSettings();
      paintClock();
      renderZoneList();
    });
    row.appendChild(star);

    const text = el('div', 'zone-text');
    const name = el('span', 'zone-city');
    name.textContent = zoneLabel(zone);
    text.appendChild(name);
    const region = el('span', 'zone-region');
    region.textContent = zoneRegion(zone);
    text.appendChild(region);
    row.appendChild(text);

    const parts = clockParts(zone, now);
    row.appendChild(el('span', 'zone-time', parts.hhmm + (parts.suffix ? ' ' + parts.suffix : '')));

    const shown = zone === CLOCK.primary || CLOCK.zones.indexOf(zone) !== -1;
    const toggle = el('button', 'zone-toggle' + (shown ? ' is-on' : ''), shown ? 'Shown' : 'Show');
    toggle.type = 'button';
    toggle.disabled = zone === CLOCK.primary;
    toggle.title = zone === CLOCK.primary ? 'This is your main clock' : shown ? 'Hide from the portal' : 'Show on the portal';
    toggle.addEventListener('click', async () => {
      CLOCK.zones = shown ? CLOCK.zones.filter((z) => z !== zone) : CLOCK.zones.concat([zone]);
      await saveClockSettings();
      paintClock();
      renderZoneList();
    });
    row.appendChild(toggle);
    host.appendChild(row);
  });
}

function openClockPicker() {
  CLOCK.filter = '';
  $('#zoneSearch').value = '';
  document.querySelectorAll('#clockFormat button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.format === '12') === CLOCK.hour12)));
  renderZoneList();
  $('#viewClock').classList.remove('hidden');
  $('#zoneSearch').focus();
}

function initClock() {
  startClock();
  const open = $('#clockMain');
  if (open.dataset.wired) return;
  open.dataset.wired = '1';
  open.addEventListener('click', openClockPicker);
  $('#clockClose').addEventListener('click', () => $('#viewClock').classList.add('hidden'));
  $('#zoneSearch').addEventListener('input', (e) => { CLOCK.filter = e.target.value; renderZoneList(); });
  document.querySelectorAll('#clockFormat button').forEach((b) => b.addEventListener('click', async () => {
    CLOCK.hour12 = b.dataset.format === '12';
    document.querySelectorAll('#clockFormat button').forEach((x) => x.setAttribute('aria-pressed', String((x.dataset.format === '12') === CLOCK.hour12)));
    await saveClockSettings();
    paintClock();
    renderZoneList();
  }));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#viewClock').classList.contains('hidden')) $('#viewClock').classList.add('hidden');
  });
}
