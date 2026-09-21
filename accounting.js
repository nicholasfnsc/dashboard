/* ============================================================
   accounting.js — Accounting: invoices, and later the P&L
   ------------------------------------------------------------
   Yours alone. The database refuses everyone else, whatever the
   page does.

   Three screens, in the order you think:
     clients   one folder per client you have invoiced
     client    their invoices, newest year first
     invoice   the document itself, edited in place and printed

   Every figure is worked out here, never typed: a revenue share
   row is (collected − fees) × share, an item row is price × qty,
   and the amount due is the sum of every section.
   ============================================================ */

const ACCOUNTING_PATH = '/accounting';

const AC = {
  view: 'clients',      // clients · client · invoice
  client: '',
  invoiceId: '',
  list: [],
  settings: null,
  saveTimer: 0,
  editingFrom: false
};

const AC_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent',  label: 'Sent' },
  { value: 'paid',  label: 'Paid' },
  { value: 'void',  label: 'Void' }
];

const AC_CURRENCIES = ['USD', 'EUR', 'GBP', 'BRL'];
const AC_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', BRL: 'R$' };

const DEFAULT_INVOICE_SETTINGS = {
  from: { name: 'Inevitable Acquisition', address: '', postal: '', email: '' },
  payLink: '',
  currency: 'USD',
  terms: ''
};

const acId = () => 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);

/* ---------- money and dates ---------- */
function acMoney(n, currency) {
  const value = Number.isFinite(n) ? n : 0;
  return (AC_SYMBOLS[currency] || '$') + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function acDay(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y) return '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const acToday = () => {
  try { return zoneNow(mainClockZone().zone).day; } catch (e) {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
};

/* "2026-08" → "August 2026", the way the folder reads */
function acPeriodLabel(period) {
  if (!period) return 'No period set';
  const [y, m] = String(period).split('-').map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const acShiftMonth = (period, by) => {
  const [y, m] = String(period || acToday().slice(0, 7)).split('-').map(Number);
  const d = new Date(y, (m - 1) + by, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
};

/* ---------- what an invoice adds up to ---------- */
function acRowTotal(kind, row) {
  if (kind === 'items') return (Number(row.price) || 0) * (Number(row.qty) || 0);
  const net = (Number(row.collected) || 0) - (Number(row.fees) || 0);
  return net * ((Number(row.share) || 0) / 100);
}

const acSectionTotal = (section) => (section.rows || []).reduce((sum, r) => sum + acRowTotal(section.kind, r), 0);
const acInvoiceTotal = (invoice) => (invoice.sections || []).reduce((sum, s) => sum + acSectionTotal(s), 0);

const acOverdue = (invoice) => invoice.status === 'sent' && invoice.due_date && invoice.due_date < acToday();

function acStatusLabel(invoice) {
  if (acOverdue(invoice)) {
    const days = Math.round((new Date(acToday()) - new Date(invoice.due_date)) / 86400000);
    return 'Overdue · ' + days + (days === 1 ? ' day' : ' days');
  }
  const hit = AC_STATUSES.find((s) => s.value === invoice.status);
  return hit ? hit.label : invoice.status;
}

/* ---------- saving ---------- */
function acInvoice() {
  return AC.list.find((x) => x.id === AC.invoiceId) || null;
}

function acTouch(patch) {
  const invoice = acInvoice();
  if (!invoice) return;
  Object.assign(invoice, patch);
  clearTimeout(AC.saveTimer);
  AC.saveTimer = setTimeout(async () => {
    try {
      await saveInvoice(invoice.id, {
        status: invoice.status, client: invoice.client, period: invoice.period,
        issue_date: invoice.issue_date || null, due_date: invoice.due_date || null,
        paid_date: invoice.paid_date || null, currency: invoice.currency,
        sections: invoice.sections, pay_link: invoice.pay_link, notes: invoice.notes
      });
      acMark('Saved');
    } catch (err) {
      console.error(err);
      acMark("Couldn't save");
    }
  }, 700);
}

function acMark(text) {
  const mark = $('#acSaved');
  if (!mark) return;
  mark.textContent = text;
  mark.classList.remove('hidden');
  clearTimeout(acMark.timer);
  acMark.timer = setTimeout(() => mark.classList.add('hidden'), 1800);
}

async function acSaveSettings() {
  try {
    await saveInvoiceSettings(AC.settings);
    acMark('Saved');
  } catch (err) {
    console.error(err);
    notify("Couldn't save your details — check your connection.");
  }
}

/* ---------- small building blocks ---------- */
function acInput(value, placeholder, onChange, opts) {
  const input = document.createElement('input');
  input.type = (opts && opts.type) || 'text';
  input.className = 'ac-in' + (opts && opts.cls ? ' ' + opts.cls : '');
  input.value = value == null ? '' : value;
  input.placeholder = placeholder || '';
  if (opts && opts.label) input.setAttribute('aria-label', opts.label);
  if (input.type === 'number') { input.step = '0.01'; input.inputMode = 'decimal'; }
  input.addEventListener('change', () => onChange(input.type === 'number' ? Number(input.value) || 0 : input.value));
  return input;
}

function acPrinted(text, cls) {
  const span = el('span', 'ac-printed' + (cls ? ' ' + cls : ''));
  span.textContent = text;
  return span;
}

/* ============================================================
   Screen 1 — the clients you invoice
   ============================================================ */
function acClients() {
  const byName = new Map();
  AC.list.forEach((invoice) => {
    const name = (invoice.client && invoice.client.name) || 'No name yet';
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(invoice);
  });
  return [...byName.entries()].map(([name, invoices]) => ({
    name,
    invoices,
    outstanding: invoices.filter((i) => i.status === 'sent').reduce((s, i) => s + acInvoiceTotal(i), 0),
    overdue: invoices.filter(acOverdue).length,
    last: invoices[0]
  })).sort((a, b) => (a.name < b.name ? -1 : 1));
}

function renderAccountingClients() {
  const host = $('#acBody');
  host.textContent = '';
  const clients = acClients();

  if (!clients.length) {
    const empty = el('div', 'ac-empty');
    empty.appendChild(el('p', null, 'No invoices yet.'));
    empty.appendChild(el('p', 'ac-empty-sub', 'Make the first one — your details are filled in for you, and the number is assigned automatically.'));
    host.appendChild(empty);
    return;
  }

  const grid = el('div', 'ac-folders');
  clients.forEach((c) => {
    const card = el('button', 'ac-folder');
    card.type = 'button';
    card.addEventListener('click', () => { AC.view = 'client'; AC.client = c.name; renderAccounting(); });

    const top = el('div', 'ac-folder-top');
    top.appendChild(el('h2', 'ac-folder-name', c.name));
    top.appendChild(el('span', 'ac-folder-count', c.invoices.length + (c.invoices.length === 1 ? ' invoice' : ' invoices')));
    card.appendChild(top);

    const foot = el('div', 'ac-folder-foot');
    if (c.outstanding > 0) {
      foot.appendChild(el('span', 'ac-owing', acMoney(c.outstanding, c.last.currency) + ' outstanding'));
    } else {
      foot.appendChild(el('span', 'ac-clear', 'Nothing outstanding'));
    }
    if (c.overdue) foot.appendChild(el('span', 'ac-late', c.overdue + ' overdue'));
    card.appendChild(foot);

    grid.appendChild(card);
  });
  host.appendChild(grid);
}

/* ============================================================
   Screen 2 — one client, their invoices by year
   ============================================================ */
function renderAccountingClient() {
  const host = $('#acBody');
  host.textContent = '';
  const mine = AC.list.filter((i) => ((i.client && i.client.name) || 'No name yet') === AC.client);

  const years = new Map();
  mine.forEach((invoice) => {
    const year = (invoice.period || invoice.issue_date || '').slice(0, 4) || 'No date';
    if (!years.has(year)) years.set(year, []);
    years.get(year).push(invoice);
  });

  [...years.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).forEach(([year, invoices]) => {
    const block = el('section', 'ac-year');
    const head = el('div', 'ac-year-head');
    head.appendChild(el('h2', 'ac-year-name', year));
    const paid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + acInvoiceTotal(i), 0);
    head.appendChild(el('span', 'ac-year-sum', acMoney(paid, invoices[0].currency) + ' paid'));
    block.appendChild(head);

    invoices.sort((a, b) => (a.number < b.number ? 1 : -1)).forEach((invoice) => {
      const row = el('button', 'ac-row');
      row.type = 'button';
      row.addEventListener('click', () => { AC.view = 'invoice'; AC.invoiceId = invoice.id; renderAccounting(); });

      row.appendChild(el('span', 'ac-row-no', '#' + String(invoice.number).padStart(3, '0')));
      row.appendChild(el('span', 'ac-row-period', acPeriodLabel(invoice.period)));
      row.appendChild(el('span', 'ac-row-dates', invoice.due_date ? 'due ' + acDay(invoice.due_date) : 'no due date'));
      row.appendChild(el('span', 'ac-row-total', acMoney(acInvoiceTotal(invoice), invoice.currency)));

      const pill = el('span', 'ac-pill is-' + (acOverdue(invoice) ? 'overdue' : invoice.status));
      pill.textContent = acStatusLabel(invoice);
      row.appendChild(pill);

      block.appendChild(row);
    });
    host.appendChild(block);
  });
}

/* ============================================================
   Screen 3 — the invoice itself
   ============================================================ */
/* The headings a section starts with, and whatever they were renamed to. */
function acColumns(section) {
  const base = section.kind === 'items'
    ? ['Title', 'Price', 'Quantity', 'Total']
    : ['Title', 'Total Cash Collected', 'Processing Fees', 'Net Collected', 'Revenue Share', 'Total'];
  return base.map((label, i) => ((section.labels && section.labels[i]) || label));
}

function acSectionTable(invoice, section) {
  const table = el('table', 'ac-table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const columns = acColumns(section);
  columns.forEach((c, i) => {
    const th = document.createElement('th');
    if (i > 0) th.className = 'num';
    th.appendChild(acInput(c, c, (v) => {
      section.labels = Object.assign({}, section.labels);
      section.labels[i] = v.trim();
      acTouch({});
    }, { label: 'Column name', cls: 'ac-col-name' }));
    headRow.appendChild(th);
  });
  headRow.appendChild(el('th', 'ac-col-x'));
  head.appendChild(headRow);
  table.appendChild(head);

  const body = document.createElement('tbody');
  (section.rows || []).forEach((row) => {
    const tr = document.createElement('tr');

    const title = document.createElement('td');
    title.appendChild(acInput(row.title, 'What it is', (v) => { row.title = v; acTouch({}); }, { label: 'Row title', cls: 'ac-row-title' }));
    tr.appendChild(title);

    const cell = (node) => { const td = document.createElement('td'); td.className = 'num'; td.appendChild(node); return td; };

    if (section.kind === 'items') {
      tr.appendChild(cell(acInput(row.price, '0.00', (v) => { row.price = v; acRepaintTotals(); acTouch({}); }, { type: 'number', label: 'Price' })));
      tr.appendChild(cell(acInput(row.qty, '1', (v) => { row.qty = v; acRepaintTotals(); acTouch({}); }, { type: 'number', label: 'Quantity' })));
    } else {
      tr.appendChild(cell(acInput(row.collected, '0.00', (v) => { row.collected = v; acRepaintTotals(); acTouch({}); }, { type: 'number', label: 'Total cash collected' })));
      tr.appendChild(cell(acInput(row.fees, '0.00', (v) => { row.fees = v; acRepaintTotals(); acTouch({}); }, { type: 'number', label: 'Processing fees' })));
      const net = el('td', 'num ac-derived');
      net.textContent = acMoney((Number(row.collected) || 0) - (Number(row.fees) || 0), invoice.currency);
      net.dataset.net = row.id;
      tr.appendChild(net);
      const share = document.createElement('td');
      share.className = 'num ac-share-cell';
      share.appendChild(acInput(row.share, '35', (v) => { row.share = v; acRepaintTotals(); acTouch({}); }, { type: 'number', label: 'Revenue share percent' }));
      share.appendChild(acPrinted('%', 'ac-pct'));
      tr.appendChild(share);
    }

    const total = el('td', 'num ac-row-sum');
    total.textContent = acMoney(acRowTotal(section.kind, row), invoice.currency);
    total.dataset.rowSum = row.id;
    tr.appendChild(total);

    const x = el('td', 'ac-col-x');
    const remove = el('button', 'ac-x', '×');
    remove.type = 'button';
    remove.title = 'Remove this line';
    remove.setAttribute('aria-label', 'Remove ' + (row.title || 'this line'));
    remove.addEventListener('click', () => {
      section.rows = section.rows.filter((r) => r.id !== row.id);
      acTouch({});
      renderAccounting();
    });
    x.appendChild(remove);
    tr.appendChild(x);

    body.appendChild(tr);
  });
  table.appendChild(body);
  return table;
}

function acSectionBlock(invoice, section) {
  const block = el('section', 'ac-section');

  const head = el('div', 'ac-section-head');
  head.appendChild(acInput(section.title, 'Section name', (v) => { section.title = v; acTouch({}); }, { label: 'Section name', cls: 'ac-section-title' }));

  const tools = el('div', 'ac-section-tools');
  const addRow = el('button', 'link-btn', '+ Line');
  addRow.type = 'button';
  addRow.addEventListener('click', () => {
    section.rows = (section.rows || []).concat([section.kind === 'items'
      ? { id: acId(), title: '', price: 0, qty: 1 }
      : { id: acId(), title: '', collected: 0, fees: 0, share: 35 }]);
    acTouch({});
    renderAccounting();
  });
  tools.appendChild(addRow);

  const dropSection = el('button', 'link-btn danger', 'Remove');
  dropSection.type = 'button';
  dropSection.addEventListener('click', () => {
    if (!window.confirm('Remove "' + (section.title || 'this section') + '" from this invoice?')) return;
    invoice.sections = invoice.sections.filter((s) => s.id !== section.id);
    acTouch({});
    renderAccounting();
  });
  tools.appendChild(dropSection);
  head.appendChild(tools);
  block.appendChild(head);

  const scroller = el('div', 'ac-table-wrap');
  scroller.appendChild(acSectionTable(invoice, section));
  block.appendChild(scroller);

  const foot = el('div', 'ac-section-foot');
  const sum = el('span', 'ac-section-sum');
  sum.dataset.sectionSum = section.id;
  sum.textContent = acMoney(acSectionTotal(section), invoice.currency);
  foot.appendChild(el('span', 'ac-section-sum-label', 'Subtotal'));
  foot.appendChild(sum);
  block.appendChild(foot);

  return block;
}

/* Only the figures change as you type — the boxes keep their cursor. */
function acRepaintTotals() {
  const invoice = acInvoice();
  if (!invoice) return;
  (invoice.sections || []).forEach((section) => {
    (section.rows || []).forEach((row) => {
      const net = document.querySelector('[data-net="' + row.id + '"]');
      if (net) net.textContent = acMoney((Number(row.collected) || 0) - (Number(row.fees) || 0), invoice.currency);
      const sum = document.querySelector('[data-row-sum="' + row.id + '"]');
      if (sum) sum.textContent = acMoney(acRowTotal(section.kind, row), invoice.currency);
    });
    const sectionSum = document.querySelector('[data-section-sum="' + section.id + '"]');
    if (sectionSum) sectionSum.textContent = acMoney(acSectionTotal(section), invoice.currency);
  });
  const due = $('#acDue');
  if (due) due.textContent = acMoney(acInvoiceTotal(invoice), invoice.currency);
}

function acPartyBlock(title, party, onChange, opts) {
  const box = el('div', 'ac-party');
  box.appendChild(el('p', 'ac-party-label', title));
  const fields = [
    ['name', 'Name'],
    ['address', 'Address'],
    ['postal', 'Postal code'],
    ['email', 'Email']
  ];
  fields.forEach(([key, label], i) => {
    const line = acInput(party[key], label, (v) => { party[key] = v; onChange(); },
      { label: title + ' ' + label.toLowerCase(), cls: i === 0 ? 'ac-party-name' : 'ac-party-line' });
    box.appendChild(line);
  });
  if (opts && opts.note) box.appendChild(el('p', 'ac-party-note', opts.note));
  return box;
}

function renderInvoice() {
  const host = $('#acBody');
  host.textContent = '';
  const invoice = acInvoice();
  if (!invoice) { AC.view = 'clients'; renderAccounting(); return; }

  const doc = el('article', 'ac-doc');

  /* ---- head: logo, number, dates ---- */
  const top = el('div', 'ac-doc-top');
  const mark = el('div', 'ac-mark');
  const logo = document.createElement('img');
  logo.src = '/logo.png';
  logo.alt = '';
  mark.appendChild(logo);
  top.appendChild(mark);

  const facts = el('div', 'ac-facts');
  const fact = (label, node) => {
    const box = el('div', 'ac-fact');
    box.appendChild(el('p', 'ac-fact-label', label));
    box.appendChild(node);
    return box;
  };
  facts.appendChild(fact('Invoice Number', acPrinted('#' + String(invoice.number).padStart(3, '0'), 'ac-number')));
  facts.appendChild(fact('Invoice Date', acInput(invoice.issue_date, '', (v) => acTouch({ issue_date: v }), { type: 'date', label: 'Invoice date' })));
  facts.appendChild(fact('Due Date', acInput(invoice.due_date, '', (v) => acTouch({ due_date: v }), { type: 'date', label: 'Due date' })));
  top.appendChild(facts);
  doc.appendChild(top);

  /* ---- from and to ---- */
  const parties = el('div', 'ac-parties');
  parties.appendChild(acPartyBlock('From', AC.settings.from, () => acSaveSettings(), { note: 'Saved for every invoice.' }));
  parties.appendChild(acPartyBlock('To', invoice.client, () => acTouch({ client: invoice.client })));
  doc.appendChild(parties);

  /* ---- what it covers ---- */
  const period = el('div', 'ac-period');
  period.appendChild(el('span', 'ac-period-label', 'For'));
  const periodInput = acInput(invoice.period, '', (v) => { acTouch({ period: v }); renderAccounting(); }, { type: 'month', label: 'Period covered' });
  period.appendChild(periodInput);
  doc.appendChild(period);

  /* ---- the sections ---- */
  (invoice.sections || []).forEach((section) => doc.appendChild(acSectionBlock(invoice, section)));

  const add = el('div', 'ac-add-section');
  const addShare = el('button', 'btn-export', '+ Revenue share section');
  addShare.type = 'button';
  addShare.addEventListener('click', () => {
    invoice.sections = (invoice.sections || []).concat([{ id: acId(), kind: 'share', title: 'New section', rows: [{ id: acId(), title: '', collected: 0, fees: 0, share: 35 }] }]);
    acTouch({});
    renderAccounting();
  });
  const addItems = el('button', 'btn-export', '+ Expenses section');
  addItems.type = 'button';
  addItems.addEventListener('click', () => {
    invoice.sections = (invoice.sections || []).concat([{ id: acId(), kind: 'items', title: 'Software Expenses', rows: [{ id: acId(), title: '', price: 0, qty: 1 }] }]);
    acTouch({});
    renderAccounting();
  });
  add.appendChild(addShare);
  add.appendChild(addItems);
  doc.appendChild(add);

  /* ---- pay, and what is owed ---- */
  const close = el('div', 'ac-close');

  const pay = el('div', 'ac-pay');
  pay.appendChild(el('p', 'ac-fact-label', 'Pay now with one click'));
  const link = (invoice.pay_link || '').trim();
  if (link) {
    const a = document.createElement('a');
    a.className = 'ac-pay-btn';
    a.href = link;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = 'Pay this invoice';
    pay.appendChild(a);
    pay.appendChild(acPrinted(link, 'ac-pay-url'));
  }
  pay.appendChild(acInput(invoice.pay_link, 'Paste your Wise or payment link', (v) => { acTouch({ pay_link: v }); renderAccounting(); }, { type: 'url', label: 'Payment link', cls: 'ac-pay-input' }));
  close.appendChild(pay);

  const totals = el('div', 'ac-totals');
  totals.appendChild(el('p', 'ac-fact-label', 'Total'));
  const due = el('p', 'ac-due');
  due.id = 'acDue';
  due.textContent = acMoney(acInvoiceTotal(invoice), invoice.currency);
  totals.appendChild(due);
  const currency = document.createElement('select');
  currency.className = 'ac-currency';
  currency.setAttribute('aria-label', 'Currency');
  AC_CURRENCIES.forEach((code) => {
    const o = document.createElement('option');
    o.value = code;
    o.textContent = code;
    currency.appendChild(o);
  });
  currency.value = invoice.currency || 'USD';
  currency.addEventListener('change', () => {
    acTouch({ currency: currency.value });
    AC.settings.currency = currency.value;          // what the next invoice starts on
    acSaveSettings();
    renderAccounting();
  });
  totals.appendChild(currency);
  close.appendChild(totals);
  doc.appendChild(close);

  /* ---- a line of terms, if there is one ---- */
  const notes = el('div', 'ac-notes');
  notes.appendChild(acInput(invoice.notes, 'Notes or terms — payment due on receipt, what this covers…', (v) => acTouch({ notes: v }), { label: 'Notes', cls: 'ac-notes-input' }));
  doc.appendChild(notes);

  host.appendChild(doc);
}

/* ============================================================
   The page around it
   ============================================================ */
function acCrumbs() {
  const host = $('#acCrumbs');
  host.textContent = '';
  const step = (label, onClick) => {
    const b = el('button', 'ac-crumb', label);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    else b.disabled = true;
    return b;
  };

  host.appendChild(step('All clients', AC.view === 'clients' ? null : () => { AC.view = 'clients'; renderAccounting(); }));
  if (AC.view === 'client' || AC.view === 'invoice') {
    const invoice = acInvoice();
    const name = AC.view === 'invoice' && invoice ? ((invoice.client && invoice.client.name) || 'No name yet') : AC.client;
    host.appendChild(el('span', 'ac-crumb-sep', '/'));
    host.appendChild(step(name, AC.view === 'client' ? null : () => { AC.view = 'client'; AC.client = name; renderAccounting(); }));
  }
  if (AC.view === 'invoice') {
    const invoice = acInvoice();
    host.appendChild(el('span', 'ac-crumb-sep', '/'));
    host.appendChild(step('#' + String(invoice.number).padStart(3, '0'), null));
  }
}

function acTools() {
  const host = $('#acTools');
  host.textContent = '';

  if (AC.view === 'invoice') {
    const invoice = acInvoice();

    const status = document.createElement('select');
    status.className = 'role-select';
    status.setAttribute('aria-label', 'Invoice status');
    AC_STATUSES.forEach((s) => {
      const o = document.createElement('option');
      o.value = s.value;
      o.textContent = s.label;
      status.appendChild(o);
    });
    status.value = invoice.status;
    status.addEventListener('change', () => {
      const paid = status.value === 'paid';
      acTouch({ status: status.value, paid_date: paid ? (invoice.paid_date || acToday()) : null });
      renderAccounting();
    });
    host.appendChild(status);

    const copy = el('button', 'btn-export', 'Next month');
    copy.type = 'button';
    copy.title = 'A new invoice for the month after this one, with the same lines';
    copy.addEventListener('click', () => acDuplicate(invoice));
    host.appendChild(copy);

    const print = el('button', 'btn-primary', 'Download PDF');
    print.type = 'button';
    print.addEventListener('click', () => window.print());
    host.appendChild(print);
    return;
  }

  const fresh = el('button', 'btn-primary', 'New invoice');
  fresh.type = 'button';
  fresh.addEventListener('click', () => acNew(AC.view === 'client' ? AC.client : ''));
  host.appendChild(fresh);
}

function acSummary() {
  const host = $('#acSummary');
  host.textContent = '';
  if (AC.view === 'invoice' || !AC.list.length) { host.classList.add('hidden'); return; }
  host.classList.remove('hidden');

  const live = AC.view === 'client'
    ? AC.list.filter((i) => ((i.client && i.client.name) || 'No name yet') === AC.client)
    : AC.list;
  const currency = (live[0] && live[0].currency) || 'USD';
  const outstanding = live.filter((i) => i.status === 'sent').reduce((s, i) => s + acInvoiceTotal(i), 0);
  const overdue = live.filter(acOverdue);
  const thisYear = live.filter((i) => i.status === 'paid' && (i.paid_date || '').slice(0, 4) === acToday().slice(0, 4));
  const paid = thisYear.reduce((s, i) => s + acInvoiceTotal(i), 0);

  [
    ['Outstanding', acMoney(outstanding, currency), live.filter((i) => i.status === 'sent').length + ' sent, unpaid'],
    ['Overdue', String(overdue.length), overdue.length ? 'chase these' : 'nothing late'],
    ['Paid this year', acMoney(paid, currency), thisYear.length + (thisYear.length === 1 ? ' invoice' : ' invoices')]
  ].forEach(([label, value, sub]) => {
    const card = el('div', 'ac-card');
    card.appendChild(el('p', 'ac-card-label', label));
    card.appendChild(el('p', 'ac-card-value', value));
    card.appendChild(el('p', 'ac-card-sub', sub));
    host.appendChild(card);
  });
}

function renderAccounting() {
  if (!$('#acBody')) return;
  acCrumbs();
  acTools();
  acSummary();
  document.body.classList.toggle('printing-invoice', AC.view === 'invoice');
  if (AC.view === 'invoice') renderInvoice();
  else if (AC.view === 'client') renderAccountingClient();
  else renderAccountingClients();
}

/* ---------- making one ---------- */
function acBlankSections() {
  return [
    { id: acId(), kind: 'share', title: 'Coaching Program Sales', rows: [{ id: acId(), title: 'High Ticket Coaching Program Sales', collected: 0, fees: 0, share: 35 }] },
    { id: acId(), kind: 'items', title: 'Software Expenses', rows: [{ id: acId(), title: '', price: 0, qty: 1 }] }
  ];
}

async function acNew(clientName) {
  const known = AC.list.find((i) => ((i.client && i.client.name) || '') === clientName);
  const period = acShiftMonth(acToday().slice(0, 7), 0);
  const row = {
    status: 'draft',
    client: known ? Object.assign({}, known.client) : { name: clientName || '', address: '', postal: '', email: '' },
    period: period,
    issue_date: acToday(),
    due_date: null,
    currency: (AC.settings && AC.settings.currency) || 'USD',
    sections: acBlankSections(),
    pay_link: (AC.settings && AC.settings.payLink) || '',
    notes: (AC.settings && AC.settings.terms) || ''
  };
  try {
    const made = await createInvoice(row);
    AC.list.unshift(made);
    AC.view = 'invoice';
    AC.invoiceId = made.id;
    renderAccounting();
    notify('Invoice #' + String(made.number).padStart(3, '0') + ' created.');
  } catch (err) {
    console.error(err);
    notify(acSetupHint(err));
  }
}

/* The same invoice, a month on — how a revenue share is billed. */
async function acDuplicate(invoice) {
  const next = acShiftMonth(invoice.period, 1);
  const row = {
    status: 'draft',
    client: Object.assign({}, invoice.client),
    period: next,
    issue_date: acToday(),
    due_date: null,
    currency: invoice.currency,
    sections: JSON.parse(JSON.stringify(invoice.sections || [])).map((s) => {
      s.id = acId();
      (s.rows || []).forEach((r) => {
        r.id = acId();
        if (s.kind === 'share') { r.collected = 0; r.fees = 0; }   // the work stays, the figures are new
      });
      return s;
    }),
    pay_link: invoice.pay_link,
    notes: invoice.notes
  };
  try {
    const made = await createInvoice(row);
    AC.list.unshift(made);
    AC.invoiceId = made.id;
    renderAccounting();
    notify('Invoice #' + String(made.number).padStart(3, '0') + ' for ' + acPeriodLabel(next) + '.');
  } catch (err) {
    console.error(err);
    notify(acSetupHint(err));
  }
}

function acSetupHint(err) {
  const text = String((err && err.message) || '');
  return /relation|does not exist|schema cache/i.test(text)
    ? 'One setup step first: run supabase/accounting.sql in Supabase → SQL Editor.'
    : "Couldn't save that — check your connection.";
}

/* ---------- opening the page ---------- */
async function initAccounting() {
  AC.view = 'clients';
  AC.client = '';
  AC.invoiceId = '';
  $('#acNotReady').classList.add('hidden');

  try {
    AC.settings = Object.assign(JSON.parse(JSON.stringify(DEFAULT_INVOICE_SETTINGS)), (await loadInvoiceSettings()) || {});
    AC.list = await loadInvoices();
  } catch (err) {
    console.error(err);
    AC.settings = JSON.parse(JSON.stringify(DEFAULT_INVOICE_SETTINGS));
    AC.list = [];
    $('#acNotReady').classList.remove('hidden');
  }
  renderAccounting();
}
