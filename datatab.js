/* ============================================================
   datatab.js — the call log
   ------------------------------------------------------------
   Lists every row logged through the Post Call Form. Editing hands
   the row back to that same form rather than duplicating it, so the
   conditional fields and validation can never drift apart.
   ============================================================ */

const DATA_FILTER = { outcome: '', period: 'all' };

/* Cells carry user-entered text, so set it as text, never as markup. */
function cell(text, cls) {
  const td = document.createElement('td');
  if (cls) td.className = cls;
  td.textContent = text == null || text === '' ? '—' : String(text);
  return td;
}

function labelFor(list, value) {
  const hit = list.find((x) => x.value === value);
  return hit ? hit.label : value;
}

/* The Details column answers "what else do I need to know about this
   outcome?" — different question per outcome, so different content. */
function detailsFor(r) {
  if (r.outcome === 'closed') {
    return labelFor(PAYMENT_METHODS, r.paymentMethod) + ' · Revenue ' + money(r.contractValue);
  }
  if (r.outcome === 'disqualified') {
    return labelFor(DQ_TYPES, r.dqType) + ' · ' + (r.wasCall ? 'On a call' : 'Before a call');
  }
  if (r.outcome === 'remainder') return 'Balance payment — not a call';
  return '';
}

/* 'new' is cash from a fresh close, 'remainder' is a balance payment —
   the same split the dashboard reports. */
function cashTypeFor(r) {
  const total = r.payments.reduce((s, p) => s + p.amount, 0);
  if (total <= 0) return '';
  if (r.outcome === 'remainder') return 'remainder';
  if (r.outcome === 'closed') return 'new';
  return '';
}

/* A row belongs to a period if its call was in it, or money landed in it —
   a balance paid this month counts this month, like on the dashboard. */
function inPeriod(r, range) {
  return (r.callDate && within(r.callDate, range)) || r.payments.some((p) => within(p.date, range));
}

function filteredCalls(all) {
  const range = rangeFor(DATA_FILTER.period);
  return all.filter((r) =>
    (!DATA_FILTER.outcome || r.outcome === DATA_FILTER.outcome) &&
    (DATA_FILTER.period === 'all' || inPeriod(r, range)));
}

/* ---------- export ----------
   Exactly the rows on screen, one line per call, ready for a spreadsheet
   or for reconciling commission at the end of the month. Cash is what
   landed inside the chosen period — the same rule the dashboard uses —
   and commission uses the rates chosen on the call itself. */
function csvCell(value) {
  let text = value == null ? '' : String(value);
  /* A spreadsheet must never run a cell as a formula. Phone numbers and
     amounts like "+1 555 0100" are left exactly as typed. */
  if (/^[=@\t\r]/.test(text) || (/^[+\-]/.test(text) && !/^[+\-][\d\s().\-]*$/.test(text))) text = "'" + text;
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

/* The rate a call was logged at. Calls logged before commission was
   chosen per call carry none, and are left blank rather than guessed. */
function callRate(row, role) {
  const rate = role === 'closer' ? row.closerRate : row.setterRate;
  return Number.isFinite(rate) ? rate : null;
}

function exportCsv() {
  const range = rangeFor(DATA_FILTER.period);
  const rows = filteredCalls(loggedCalls().slice());
  if (!rows.length) { notify('Nothing to export for this selection.'); return; }

  const fixed = (n) => (Math.round(n * 100) / 100).toFixed(2);
  const percent = (rate) => Math.round(rate * 10000) / 100 + '%';
  const header = ['Call date', 'Booked date', 'Funnel', 'Call', 'Outcome', 'Closer', 'Setter',
    'Client', 'Email', 'Phone', 'Fathom', 'Payment method', 'Revenue', 'Cash collected', 'Cash type',
    'Payments', 'Closer rate', 'Closer commission', 'Setter rate', 'Setter commission',
    'Disqualification', 'Was a call', 'Notes', 'Logged by'];

  const lines = rows.map((r) => {
    const paid = r.payments.filter((p) => DATA_FILTER.period === 'all' || within(p.date, range));
    const cash = paid.reduce((s, p) => s + p.amount, 0);
    const closerRate = r.closer ? callRate(r, 'closer') : null;
    const setterRate = r.setter ? callRate(r, 'setter') : null;
    const def = outcomeDef(r.outcome);
    const closed = r.outcome === 'closed';
    const dq = r.outcome === 'disqualified';
    return [
      r.callDate, r.bookedDate, labelFor(FUNNELS, r.funnel), r.callName, def ? def.label : r.outcome,
      r.closer, r.setter, r.clientName, r.clientEmail, r.clientPhone, r.fathomUrl,
      closed ? labelFor(PAYMENT_METHODS, r.paymentMethod) : '',
      closed ? fixed(r.contractValue || 0) : '',
      fixed(cash), cashTypeFor(r),
      paid.map((p) => p.date + ' ' + fixed(p.amount) + (p.type ? ' ' + p.type : '')).join('; '),
      closerRate == null ? '' : percent(closerRate),
      closerRate == null ? '' : fixed(cash * closerRate),
      setterRate == null ? '' : percent(setterRate),
      setterRate == null ? '' : fixed(cash * setterRate),
      dq ? labelFor(DQ_TYPES, r.dqType) : '',
      dq ? (r.wasCall ? 'Yes' : 'No') : '',
      r.notes, r.loggedBy
    ].map(csvCell).join(',');
  });

  /* The byte-order mark makes Excel read accents and symbols correctly. */
  const csv = '﻿' + [header.map(csvCell).join(',')].concat(lines).join('\r\n');
  const offer = slugify((CACHE.board && CACHE.board.name) || 'offer');
  const period = $('#dPeriod').selectedOptions[0].textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const d = new Date();
  const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = offer + '-calls-' + period + '-' + stamp + '.csv';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
  notify('Exported ' + rows.length + (rows.length === 1 ? ' call.' : ' calls.'));
}

/* Shown as the percentage, with what it pays on this call behind it. */
function rateCell(row, role) {
  const td = document.createElement('td');
  td.className = 'num';
  const who = role === 'closer' ? row.closer : row.setter;
  const earns = row.outcome === 'closed' || row.outcome === 'remainder';
  if (!who || !earns) { td.textContent = '—'; return td; }

  const rate = callRate(row, role);
  if (rate == null) {
    td.textContent = 'Not set';
    td.className = 'num is-unsetrate';
    td.title = 'Logged before commission was chosen per call. Open the call to set it.';
    return td;
  }
  const cash = row.payments.reduce((s, p) => s + p.amount, 0);
  td.textContent = Math.round(rate * 10000) / 100 + '%';
  td.title = money(cash * rate) + ' on ' + money(cash) + ' collected';
  return td;
}

function renderDataTab() {
  const tbody = $('#dRows');
  if (!tbody) return;
  tbody.textContent = '';

  const all = loggedCalls().slice().reverse();
  const rows = filteredCalls(all);

  $('#dEmpty').classList.toggle('hidden', all.length > 0);
  $('#dCount').textContent = rows.length
    ? rows.length + (rows.length === 1 ? ' row' : ' rows') + (rows.length !== all.length ? ' of ' + all.length : '')
    : '';

  rows.forEach((r) => {
    const def = outcomeDef(r.outcome) || { label: r.outcome, color: 'var(--muted)' };
    const cash = r.payments.reduce((s, p) => s + p.amount, 0);
    const tr = document.createElement('tr');

    tr.appendChild(cell(r.callDate, 'mono'));
    tr.appendChild(cell(labelFor(FUNNELS, r.funnel)));
    tr.appendChild(cell(r.callName));
    tr.appendChild(cell(r.closer));
    tr.appendChild(rateCell(r, 'closer'));
    tr.appendChild(cell(r.setter));
    tr.appendChild(rateCell(r, 'setter'));
    tr.appendChild(cell(r.clientName, 'strong'));
    tr.appendChild(cell(r.clientEmail));
    tr.appendChild(cell(r.clientPhone, 'mono'));

    const fathom = document.createElement('td');
    if (r.fathomUrl) {
      const a = document.createElement('a');
      a.href = r.fathomUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'cell-link';
      a.textContent = 'Open';
      fathom.appendChild(a);
    } else {
      fathom.textContent = '—';
    }
    tr.appendChild(fathom);

    const outcome = document.createElement('td');
    outcome.className = 'nowrap';
    const dot = el('span', 'swatch');
    dot.style.background = def.color;
    outcome.appendChild(dot);
    outcome.appendChild(document.createTextNode(' ' + def.label));
    tr.appendChild(outcome);

    tr.appendChild(cell(detailsFor(r)));
    tr.appendChild(cell(r.notes, 'notes-cell'));
    tr.appendChild(cell(cash > 0 ? money(cash) : '', 'num mono'));
    tr.appendChild(cell(cashTypeFor(r)));

    const actions = document.createElement('td');
    actions.className = 'row-actions';

    const edit = el('button', 'link-btn', 'Edit');
    edit.type = 'button';
    edit.addEventListener('click', () => PostCallForm.startEdit(r.id));
    actions.appendChild(edit);

    const del = el('button', 'link-btn danger', 'Delete');
    del.type = 'button';
    del.addEventListener('click', async () => {
      const who = r.clientName || 'this call';
      if (!window.confirm('Delete the logged call for ' + who + ' on ' + r.callDate +
          '?\n\nThis removes it for the whole team. You can undo it.')) return;

      pushUndo({ kind: 'restoreCall', label: 'Deleted the call for ' + who, row: r });

      try {
        await deleteCall(r.id);
      } catch (err) {
        console.error(err);
        notify("Couldn't delete that — check your connection and try again.");
        return;
      }
      renderDataTab();
      render();
      notify('Deleted the call for ' + who + '. Use Undo to bring it back.');
    });
    actions.appendChild(del);

    tr.appendChild(actions);
    tbody.appendChild(tr);
  });
}

function initDataTab() {
  const sel = $('#dOutcome');
  if (!sel) return;

  fillSelect(sel, OUTCOMES.map((o) => ({ value: o.key, label: o.label })), 'Outcome');
  sel.addEventListener('change', () => {
    DATA_FILTER.outcome = sel.value;
    sel.parentElement.classList.toggle('is-set', !!sel.value);
    renderDataTab();
  });

  const period = $('#dPeriod');
  period.addEventListener('change', () => {
    DATA_FILTER.period = period.value;
    period.parentElement.classList.toggle('is-set', period.value !== 'all');
    renderDataTab();
  });

  $('#dReset').addEventListener('click', () => {
    DATA_FILTER.outcome = '';
    DATA_FILTER.period = 'all';
    sel.value = '';
    period.value = 'all';
    sel.parentElement.classList.remove('is-set');
    period.parentElement.classList.remove('is-set');
    renderDataTab();
  });

  $('#dExport').addEventListener('click', exportCsv);

  $('#dGoForm').addEventListener('click', () => showTab('postcall'));

  renderDataTab();
}
