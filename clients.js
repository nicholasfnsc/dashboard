/* ============================================================
   clients.js — the Client Tracker tab
   ------------------------------------------------------------
   Who did we sign, and who is closest to renewing?

   Nothing is typed in here. Every client is built from the calls
   logged on the Post Call Form, so correcting a call corrects this.

     joined      the day of their first close
     renews      their newest close plus the Program Length bought
     paid        every payment since that newest close
     due         what the contract is worth, less what they have paid

   Signing again starts a fresh term, and the earlier one stays in
   their history. Nothing is ever removed.
   ============================================================ */

const CLIENT_VIEW = { query: '', filter: 'active' };

const CLIENT_FILTERS = [
  { key: 'active',   label: 'Active' },
  { key: 'renewing', label: 'Renewing soon' },
  { key: 'owing',    label: 'Owing' },
  { key: 'ended',    label: 'Ended' },
  { key: 'all',      label: 'Everyone' }
];

const RENEWING_SOON = 30;            // days out that counts as "coming up"

/* ---------- days, in the clock's time zone ---------- */
function clientToday() {
  const zone = typeof mainClockZone === 'function' ? mainClockZone() : '';
  const now = new Date();
  if (!zone) return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const [y, m, d] = parts.split('-').map(Number);
    return new Date(y, m - 1, d);
  } catch (e) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
}

/* A logged day is 'YYYY-MM-DD' — read as a plain day, never UTC. */
function clientDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/* Months, the way a contract counts them: the 31st of a short month
   lands on the last day of the month it reaches. */
function addMonths(date, months) {
  const day = date.getDate();
  const moved = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(moved.getFullYear(), moved.getMonth() + 1, 0).getDate();
  moved.setDate(Math.min(day, lastDay));
  return moved;
}

const daysBetween = (from, to) => Math.round((to - from) / 86400000);

function clientDay(date) {
  return date ? MONTHS[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear() : '—';
}

/* ---------- one person, however many calls ---------- */
/* Someone is the same client if any of their email, phone or name
   matches — a balance payment logged later rarely repeats all three. */
function clientIdentifiers(row) {
  const ids = [];
  const email = (row.clientEmail || '').trim().toLowerCase();
  const phone = (row.clientPhone || '').replace(/\D/g, '');
  const name = (row.clientName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (email) ids.push('e:' + email);
  if (phone.length >= 7) ids.push('p:' + phone.slice(-10));
  if (name) ids.push('n:' + name);
  return ids;
}

function groupByClient(rows) {
  const groups = [];
  const where = {};                                   // identifier -> group index

  rows.forEach((row) => {
    const ids = clientIdentifiers(row);
    if (!ids.length) return;

    const found = [];
    ids.forEach((id) => { if (where[id] != null && found.indexOf(where[id]) === -1) found.push(where[id]); });

    let at;
    if (!found.length) {
      at = groups.length;
      groups.push([]);
    } else {
      /* This row bridges people we had filed apart — put them together. */
      at = found[0];
      found.slice(1).forEach((other) => {
        groups[at] = groups[at].concat(groups[other]);
        groups[other] = [];
        Object.keys(where).forEach((id) => { if (where[id] === other) where[id] = at; });
      });
    }
    ids.forEach((id) => { where[id] = at; });
    groups[at].push(row);
  });

  return groups.filter((g) => g.length);
}

/* Everything the tab shows about one client. */
function clientFrom(rows) {
  const closes = rows.filter((r) => r.outcome === 'closed' && r.callDate)
    .sort((a, b) => (a.callDate < b.callDate ? -1 : a.callDate > b.callDate ? 1 : 0));
  if (!closes.length) return null;                    // never signed: not a client

  const latest = closes[closes.length - 1];
  const first = closes[0];
  const months = Number(latest.termMonths) || 0;
  const start = clientDate(latest.callDate);
  const ends = months ? addMonths(start, months) : null;
  const daysLeft = ends ? daysBetween(clientToday(), ends) : null;

  /* Money for the term they are in now: the close, plus every balance
     payment logged since. Earlier terms stay in their total paid. */
  const paidNow = rows.reduce((sum, r) => sum + r.payments
    .filter((p) => p.date && p.date >= latest.callDate)
    .reduce((s, p) => s + p.amount, 0), 0);
  const paidEver = rows.reduce((sum, r) => sum + r.payments.reduce((s, p) => s + p.amount, 0), 0);
  const contract = Number(latest.contractValue) || 0;

  return {
    id: latest.id,
    name: latest.clientName || first.clientName || 'Unnamed client',
    email: latest.clientEmail || first.clientEmail || '',
    phone: latest.clientPhone || first.clientPhone || '',
    joined: clientDate(first.callDate),
    started: start,
    ends: ends,
    months: months,
    daysLeft: daysLeft,
    contract: contract,
    paid: paidNow,
    paidEver: paidEver,
    due: Math.max(0, contract - paidNow),
    closer: latest.closer || '',
    setter: latest.setter || '',
    fathom: latest.fathomUrl || '',
    funnel: latest.funnel,
    signings: closes.length,
    ended: daysLeft != null && daysLeft < 0
  };
}

function allClients() {
  return groupByClient(loggedCalls()).map(clientFrom).filter(Boolean).sort((a, b) => {
    /* Whoever needs you soonest, first. A client with no Program Length
       yet comes before everyone, because nobody can see their renewal. */
    if (a.ended !== b.ended) return a.ended ? 1 : -1;
    if (a.ended && b.ended) return b.ends - a.ends;
    const left = (c) => (c.daysLeft == null ? -1e9 : c.daysLeft);
    return left(a) - left(b);
  });
}

function clientMatches(c, filter) {
  if (filter === 'all') return true;
  if (filter === 'ended') return c.ended;
  if (filter === 'owing') return c.due > 0 && !c.ended;
  if (filter === 'renewing') return !c.ended && c.daysLeft != null && c.daysLeft <= RENEWING_SOON;
  return !c.ended;                                     // active
}

function clientSearched(c, query) {
  if (!query) return true;
  const hay = [c.name, c.email, c.phone, c.closer, c.setter].join(' ').toLowerCase();
  return hay.indexOf(query.toLowerCase().trim()) !== -1;
}

/* ---------- the pieces on screen ---------- */
function renewalPill(c) {
  const pill = el('span', 'ct-pill');
  if (c.daysLeft == null) {
    pill.classList.add('is-unset');
    pill.textContent = 'Program length not set';
    pill.title = 'Open the call on the Post Call Form and pick 3 or 6 months.';
    return pill;
  }
  if (c.ended) {
    pill.classList.add('is-ended');
    pill.textContent = 'Ended ' + clientDay(c.ends);
    return pill;
  }
  pill.classList.add(c.daysLeft <= 14 ? 'is-urgent' : c.daysLeft <= RENEWING_SOON ? 'is-soon' : 'is-calm');
  pill.textContent = c.daysLeft === 0 ? 'Renews today' : c.daysLeft === 1 ? '1 day left' : c.daysLeft + ' days left';
  pill.title = 'Renews ' + clientDay(c.ends);
  return pill;
}

function moneyLine(label, value, cls) {
  const box = el('div', 'ct-money' + (cls ? ' ' + cls : ''));
  box.appendChild(el('span', 'ct-money-label', label));
  box.appendChild(el('span', 'ct-money-value', money0(value)));
  return box;
}

function contactLine(c) {
  const line = el('div', 'ct-contact');
  if (c.email) {
    const a = document.createElement('a');
    a.href = 'mailto:' + c.email;
    a.textContent = c.email;
    line.appendChild(a);
  }
  if (c.phone) {
    const a = document.createElement('a');
    a.href = 'tel:' + c.phone.replace(/[^\d+]/g, '');
    a.textContent = c.phone;
    line.appendChild(a);
  }
  if (!c.email && !c.phone) line.appendChild(el('span', 'ct-muted', 'No contact on the call'));
  return line;
}

function clientRow(c) {
  const row = el('div', 'ct-row' + (c.ended ? ' is-ended' : ''));

  const who = el('div', 'ct-who');
  const name = el('p', 'ct-name');
  name.textContent = c.name;
  who.appendChild(name);
  who.appendChild(contactLine(c));
  row.appendChild(who);

  const when = el('div', 'ct-when');
  when.appendChild(renewalPill(c));
  const dates = el('p', 'ct-dates');
  dates.textContent = 'Joined ' + clientDay(c.joined) + (c.months ? ' · ' + c.months + ' months' : '');
  when.appendChild(dates);
  if (c.signings > 1) {
    const again = el('p', 'ct-dates', 'Signed ' + c.signings + ' times · current term from ' + clientDay(c.started));
    when.appendChild(again);
  }
  row.appendChild(when);

  const cash = el('div', 'ct-cash');
  cash.appendChild(moneyLine('Paid', c.paid));
  cash.appendChild(moneyLine('Due', c.due, c.due > 0 ? 'is-owing' : ''));
  cash.appendChild(moneyLine('Contract', c.contract, 'is-quiet'));
  row.appendChild(cash);

  const team = el('div', 'ct-team');
  team.appendChild(el('p', 'ct-team-line', 'Closer · ' + (c.closer || '—')));
  team.appendChild(el('p', 'ct-team-line', 'Setter · ' + (c.setter || '—')));
  row.appendChild(team);

  const act = el('div', 'ct-actions');
  if (c.fathom) act.appendChild(openButton(c.fathom));
  const open = el('button', 'link-btn', 'Open the call');
  open.type = 'button';
  open.addEventListener('click', () => PostCallForm.startEdit(c.id));
  act.appendChild(open);
  row.appendChild(act);

  return row;
}

function renderClientSummary(clients) {
  const host = $('#ctSummary');
  host.textContent = '';
  const live = clients.filter((c) => !c.ended);
  const soon = live.filter((c) => c.daysLeft != null && c.daysLeft <= RENEWING_SOON);
  const owing = live.reduce((s, c) => s + c.due, 0);
  const collected = clients.reduce((s, c) => s + c.paidEver, 0);

  [
    ['Active clients', int(live.length), live.length === 1 ? '1 signed and running' : 'signed and running'],
    ['Renewing in ' + RENEWING_SOON + ' days', int(soon.length), soon.length ? 'reach out to these first' : 'nothing due yet'],
    ['Cash collected', money0(collected), 'from every client here'],
    ['Still owed', money0(owing), owing > 0 ? 'across active contracts' : 'everyone is paid up']
  ].forEach(([label, value, sub]) => {
    const card = el('div', 'ct-card');
    card.appendChild(el('p', 'ct-card-label', label));
    card.appendChild(el('p', 'ct-card-value', value));
    card.appendChild(el('p', 'ct-card-sub', sub));
    host.appendChild(card);
  });
}

function renderClientFilters(clients) {
  const host = $('#ctFilters');
  host.textContent = '';
  CLIENT_FILTERS.forEach((f) => {
    const count = clients.filter((c) => clientMatches(c, f.key)).length;
    const b = el('button', 'ct-filter' + (CLIENT_VIEW.filter === f.key ? ' is-on' : ''));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(CLIENT_VIEW.filter === f.key));
    b.textContent = f.label;
    b.appendChild(el('span', 'ct-count', String(count)));
    b.addEventListener('click', () => { CLIENT_VIEW.filter = f.key; renderClients(); });
    host.appendChild(b);
  });
}

function renderClients() {
  if (!$('#ctList')) return;
  const clients = allClients();
  renderClientSummary(clients);
  renderClientFilters(clients);

  const shown = clients.filter((c) => clientMatches(c, CLIENT_VIEW.filter) && clientSearched(c, CLIENT_VIEW.query));
  const list = $('#ctList');
  list.textContent = '';
  shown.forEach((c) => list.appendChild(clientRow(c)));

  const empty = $('#ctEmpty');
  empty.classList.toggle('hidden', shown.length > 0);
  if (!shown.length) {
    empty.textContent = !clients.length
      ? 'No clients yet. Every closed call on the Post Call Form shows up here.'
      : CLIENT_VIEW.query
        ? 'Nobody matches “' + CLIENT_VIEW.query + '”.'
        : 'Nobody in this list right now.';
  }
}

function initClientTracker() {
  const search = $('#ctSearch');
  if (!search || search.dataset.wired) { renderClients(); return; }
  search.dataset.wired = '1';
  search.addEventListener('input', () => { CLIENT_VIEW.query = search.value; renderClients(); });
  renderClients();
}
