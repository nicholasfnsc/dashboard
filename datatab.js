/* ============================================================
   datatab.js — the call log
   ------------------------------------------------------------
   Lists every row logged through the Post Call Form. Editing hands
   the row back to that same form rather than duplicating it, so the
   conditional fields and validation can never drift apart.
   ============================================================ */

const DATA_FILTER = { outcome: '' };

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

function renderDataTab() {
  const tbody = $('#dRows');
  if (!tbody) return;
  tbody.textContent = '';

  const all = loggedCalls().slice().reverse();
  const rows = DATA_FILTER.outcome
    ? all.filter((r) => r.outcome === DATA_FILTER.outcome)
    : all;

  $('#dEmpty').classList.toggle('hidden', all.length > 0);
  $('#dCount').textContent = rows.length
    ? rows.length + (rows.length === 1 ? ' row' : ' rows') + (DATA_FILTER.outcome ? ' of ' + all.length : '')
    : '';

  rows.forEach((r) => {
    const def = outcomeDef(r.outcome) || { label: r.outcome, color: 'var(--muted)' };
    const cash = r.payments.reduce((s, p) => s + p.amount, 0);
    const tr = document.createElement('tr');

    tr.appendChild(cell(r.callDate, 'mono'));
    tr.appendChild(cell(labelFor(FUNNELS, r.funnel)));
    tr.appendChild(cell(r.callName));
    tr.appendChild(cell(r.closer));
    tr.appendChild(cell(r.setter));
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
    del.addEventListener('click', () => {
      const who = r.clientName || 'this call';
      const rows = loggedCalls();
      const index = rows.findIndex((x) => x.id === r.id);
      if (index === -1) return;

      pushUndo({
        kind: 'restoreCall',
        label: 'Deleted the call for ' + who,
        row: rows[index],
        index: index
      });

      rows.splice(index, 1);
      store.write('calls', rows);
      renderDataTab();
      render();
      notify('Deleted the call for ' + who + '. Use Undo to bring it back.');
    });
    actions.appendChild(del);

    tr.appendChild(actions);
    tbody.appendChild(tr);
  });
}

(function initDataTab() {
  const sel = $('#dOutcome');
  if (!sel) return;

  fillSelect(sel, OUTCOMES.map((o) => ({ value: o.key, label: o.label })), 'Outcome');
  sel.addEventListener('change', () => {
    DATA_FILTER.outcome = sel.value;
    sel.parentElement.classList.toggle('is-set', !!sel.value);
    renderDataTab();
  });

  $('#dReset').addEventListener('click', () => {
    DATA_FILTER.outcome = '';
    sel.value = '';
    sel.parentElement.classList.remove('is-set');
    renderDataTab();
  });

  $('#dGoForm').addEventListener('click', () => showTab('postcall'));

  renderDataTab();
})();
