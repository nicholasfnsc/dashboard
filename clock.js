/* ============================================================
   clock.js — the portal clock
   ------------------------------------------------------------
   Beside the greeting: the time where you are (or wherever you
   choose), with any other places you watch listed next to it.

   Click it to search. The search covers the cities in
   clock-cities.js — every Brazilian capital and the world's main
   cities, accents optional — and, beyond those, every time zone the
   browser knows. Each place is kept with the name you found it by,
   so Rio de Janeiro shows as Rio de Janeiro even though it keeps São
   Paulo time.

   The choice lives on your account, so every device shows the same.
   ============================================================ */

const CLOCK = { places: [], hour12: false, timer: 0, filter: '' };

const deviceZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; }
};

/* "America/Sao_Paulo" → "Sao Paulo", for zones with no city of their own. */
function zoneLabel(zone) {
  const tail = String(zone).split('/').pop() || zone;
  return tail.replace(/_/g, ' ').replace(/^St /, 'St. ');
}

const zoneRegion = (zone) => String(zone).split('/')[0].replace(/_/g, ' ');

/* Accents and underscores should never stop a search finding a city. */
const plain = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_\-.]/g, ' ').toLowerCase().trim();

/* Countries as they are said elsewhere, so searching in Portuguese or
   Spanish finds the same places. */
const COUNTRY_WORDS = {
  brasil: 'brazil', eua: 'united states', 'estados unidos': 'united states', espanha: 'spain',
  'españa': 'spain', alemanha: 'germany', franca: 'france', francia: 'france', italia: 'italy',
  inglaterra: 'united kingdom', 'reino unido': 'united kingdom', suica: 'switzerland',
  suiza: 'switzerland', holanda: 'netherlands', japao: 'japan', mexico: 'mexico',
  emirados: 'united arab emirates', 'emiratos': 'united arab emirates', dubai: 'united arab emirates',
  grecia: 'greece', turquia: 'turkey', egito: 'egypt', marrocos: 'morocco', 'africa do sul': 'south africa',
  australia: 'australia', canada: 'canada', irlanda: 'ireland', escocia: 'scotland', noruega: 'norway',
  suecia: 'sweden', dinamarca: 'denmark', polonia: 'poland', russia: 'russia', china: 'china',
  'coreia': 'south korea', india: 'india', tailandia: 'thailand', singapura: 'singapore',
  'nova zelandia': 'new zealand', colombia: 'colombia', peru: 'peru', chile: 'chile',
  uruguai: 'uruguay', paraguai: 'paraguay', bolivia: 'bolivia', equador: 'ecuador'
};

function queryWords(q) {
  const words = [q];
  Object.keys(COUNTRY_WORDS).forEach((word) => {
    if (word.indexOf(q) === 0 || q.indexOf(word) === 0) words.push(COUNTRY_WORDS[word]);
  });
  return words;
}

function knownZones() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone');
  } catch (e) { /* older browser */ }
  return CLOCK_CITIES.map((c) => c.zone);
}

/* Everything searchable: the cities, then every zone not already covered. */
function searchPlaces(query) {
  const q = plain(query);
  if (!q) return [];
  const words = queryWords(q);
  const hit = (text) => words.some((w) => String(text).indexOf(w) !== -1);
  const hits = [];
  const seen = new Set();

  CLOCK_CITIES.forEach((c) => {
    const name = plain(c.name);
    const country = plain(c.country);
    if (!hit(name) && !hit(country) && !hit(plain(c.zone))) return;
    const key = c.name + '|' + c.zone;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ zone: c.zone, label: c.name, note: c.country, rank: name.indexOf(q) === 0 ? 0 : name.indexOf(q) !== -1 ? 1 : 2 });
  });

  knownZones().forEach((zone) => {
    if (!hit(plain(zone))) return;
    const label = zoneLabel(zone);
    const key = label + '|' + zone;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ zone, label, note: zoneRegion(zone), rank: plain(label).indexOf(q) === 0 ? 1 : 3 });
  });

  return hits.sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label)).slice(0, 80);
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
    day: new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', month: 'short', day: 'numeric' }).format(when)
  };
}

/* How far ahead or behind a place is from the one that leads. */
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

/* ---------- what is shown ----------
   places[0] is the one that leads. Older saved settings kept plain
   zone names, so those are brought across. */
function placeFor(zone) {
  const city = CLOCK_CITIES.find((c) => c.zone === zone);
  return { zone, label: city ? city.name : zoneLabel(zone) };
}

function readClockSettings() {
  const saved = (CACHE.me && CACHE.me.clock) || {};
  const list = [];
  const add = (item) => {
    if (!item) return;
    const place = typeof item === 'string' ? placeFor(item) : { zone: item.zone, label: item.label || zoneLabel(item.zone) };
    if (!place.zone || list.some((x) => x.zone === place.zone && x.label === place.label)) return;
    list.push(place);
  };
  add(saved.primary);
  (Array.isArray(saved.places) ? saved.places : Array.isArray(saved.zones) ? saved.zones : []).forEach(add);
  if (!list.length) add(deviceZone());
  CLOCK.places = list;
  CLOCK.hour12 = saved.hour12 === true;
}

async function saveClockSettings() {
  const clock = { primary: CLOCK.places[0], places: CLOCK.places, hour12: CLOCK.hour12 };
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
  if (!shell || shell.classList.contains('hidden') || !CLOCK.places.length) return;
  const now = new Date();
  const lead = CLOCK.places[0];
  const main = clockParts(lead.zone, now);

  $('#clockTime').textContent = main.hhmm;
  $('#clockSeconds').textContent = main.seconds;
  $('#clockSuffix').textContent = main.suffix;
  $('#clockZone').textContent = lead.label;
  $('#clockDay').textContent = main.day;

  const others = $('#clockOthers');
  const rest = CLOCK.places.slice(1);
  if (others.childElementCount !== rest.length) {
    others.textContent = '';
    rest.forEach(() => {
      const row = el('div', 'clock-row');
      row.appendChild(el('span', 'clock-row-city'));
      row.appendChild(el('span', 'clock-row-time'));
      row.appendChild(el('span', 'clock-row-diff'));
      others.appendChild(row);
    });
  }
  rest.forEach((place, i) => {
    const row = others.children[i];
    const parts = clockParts(place.zone, now);
    row.querySelector('.clock-row-city').textContent = place.label;
    row.querySelector('.clock-row-time').textContent = parts.hhmm + (parts.suffix ? ' ' + parts.suffix : '');
    row.querySelector('.clock-row-diff').textContent = clockOffset(place.zone, lead.zone, now);
  });
}

function startClock() {
  readClockSettings();
  paintClock();
  clearInterval(CLOCK.timer);
  CLOCK.timer = setInterval(paintClock, 1000);
}

/* ---------- choosing places ---------- */
function zoneRow(place, note, shown) {
  const now = new Date();
  const lead = CLOCK.places[0];
  const isLead = shown && lead && lead.zone === place.zone && lead.label === place.label;
  const row = el('div', 'zone-row' + (isLead ? ' is-primary' : ''));

  const star = el('button', 'zone-star' + (isLead ? ' is-on' : ''));
  star.type = 'button';
  star.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"/></svg>';
  star.title = 'Make this the main clock';
  star.setAttribute('aria-label', 'Make ' + place.label + ' the main clock');
  star.addEventListener('click', async () => {
    CLOCK.places = [place].concat(CLOCK.places.filter((x) => !(x.zone === place.zone && x.label === place.label)));
    await saveClockSettings();
    paintClock();
    renderZoneList();
  });
  row.appendChild(star);

  const text = el('div', 'zone-text');
  const name = el('span', 'zone-city');
  name.textContent = place.label;
  text.appendChild(name);
  const region = el('span', 'zone-region');
  region.textContent = note + (note !== zoneLabel(place.zone) ? ' · ' + zoneLabel(place.zone) + ' time' : '');
  text.appendChild(region);
  row.appendChild(text);

  const parts = clockParts(place.zone, now);
  row.appendChild(el('span', 'zone-time', parts.hhmm + (parts.suffix ? ' ' + parts.suffix : '')));

  const toggle = el('button', 'zone-toggle' + (shown ? ' is-on' : ''), shown ? 'Shown' : 'Show');
  toggle.type = 'button';
  toggle.disabled = isLead && CLOCK.places.length === 1;
  toggle.title = toggle.disabled ? 'Your only clock' : shown ? 'Take off the portal' : 'Show on the portal';
  toggle.addEventListener('click', async () => {
    CLOCK.places = shown
      ? CLOCK.places.filter((x) => !(x.zone === place.zone && x.label === place.label))
      : CLOCK.places.concat([place]);
    await saveClockSettings();
    paintClock();
    renderZoneList();
  });
  row.appendChild(toggle);
  return row;
}

function renderZoneList() {
  const host = $('#zoneList');
  host.textContent = '';
  const search = CLOCK.filter.trim();

  if (!search) {
    host.appendChild(el('p', 'zone-hint', 'On your portal now. Search above for any city — Rio de Janeiro, Manaus, Dubai.'));
    CLOCK.places.forEach((place) => {
      const city = CLOCK_CITIES.find((c) => c.name === place.label && c.zone === place.zone);
      host.appendChild(zoneRow(place, city ? city.country : zoneRegion(place.zone), true));
    });
    return;
  }

  const hits = searchPlaces(search);
  if (!hits.length) {
    host.appendChild(el('p', 'zone-hint', 'Nothing found. Try the nearest big city, or the country.'));
    return;
  }
  hits.forEach((hit) => {
    const place = { zone: hit.zone, label: hit.label };
    const shown = CLOCK.places.some((x) => x.zone === place.zone && x.label === place.label);
    host.appendChild(zoneRow(place, hit.note, shown));
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

/* ---------- what "now" means to you ----------
   The place your clock leads with. Other pages ask this so a day
   turns over where you are, not where the device thinks it is.
   Before the clock has been set up, the device is the answer. */
function mainClockZone() {
  if (!CLOCK.places.length) readClockSettings();
  const lead = CLOCK.places[0];
  if (lead && lead.zone) return { zone: lead.zone, label: lead.label || lead.zone };
  return { zone: Intl.DateTimeFormat().resolvedOptions().timeZone, label: 'This device' };
}

/* Every place you watch, the leading one first. */
function clockPlaces() {
  if (!CLOCK.places.length) readClockSettings();
  return CLOCK.places.slice();
}
