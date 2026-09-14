/* ============================================================
   form.js — Post Call Form
   ------------------------------------------------------------
   Every submission becomes one row in the same store the Dashboard
   reads, so the numbers move the moment a call is logged. Which
   fields appear depends entirely on the outcome picked.
   ============================================================ */

function initPostCallForm() {
  const form = $('#postCallForm');
  if (!form) return;

  const groups = {
    closed:    $('#grpClosed'),
    dq:        $('#grpDq'),
    remainder: $('#grpRemainder'),
    notes:     $('#grpNotes')
  };

  /* editingId is set while correcting a row from the Data tab; null means
     this submission creates a new row. */
  const pcState = { funnel: 'vsl', outcome: 'closed', editingId: null };

  /* ---------- choice pills ---------- */
  function buildPills(host, items, selected, onPick) {
    host.textContent = '';
    items.forEach((item) => {
      const b = el('button', 'pill');
      b.type = 'button';
      b.textContent = item.label;
      b.dataset.value = item.value;
      b.setAttribute('aria-pressed', String(item.value === selected));
      if (item.color) {
        b.style.setProperty('--pill-hue', item.color);
        b.classList.add('pill-hued');
      }
      b.addEventListener('click', () => onPick(item.value));
      host.appendChild(b);
    });
  }

  function paintPills(host, selected) {
    host.querySelectorAll('.pill').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.value === selected));
    });
  }

  /* ---------- which fields this outcome needs ---------- */
  function applyOutcome(key) {
    pcState.outcome = key;
    paintPills($('#pcOutcome'), key);

    groups.closed.classList.toggle('hidden', key !== 'closed');
    groups.dq.classList.toggle('hidden', key !== 'disqualified');
    groups.remainder.classList.toggle('hidden', key !== 'remainder');

    /* A balance payment was never on the calendar, so it has no booked day. */
    $('#pcBookedField').classList.toggle('hidden', key === 'remainder');
    $('#pcDateLabel').textContent = key === 'remainder' ? 'Date Paid' : 'Call Date';
    $('#pcDateHelp').textContent = key === 'remainder' ? 'The day the payment came in.' : 'The day the call happened.';

    const prompt = OUTCOME_PROMPT[key];
    groups.notes.classList.toggle('hidden', !prompt);
    if (prompt) $('#pcNotesLabel').textContent = prompt;

    clearErrors();
  }

  /* ---------- validation ---------- */
  function clearErrors() {
    form.querySelectorAll('.invalid').forEach((n) => n.classList.remove('invalid'));
    const box = $('#pcErrors');
    box.textContent = '';
    box.classList.add('hidden');
  }

  function fail(messages) {
    const box = $('#pcErrors');
    box.textContent = messages.length === 1
      ? messages[0]
      : messages.length + ' fields need attention: ' + messages.join(' · ');
    box.classList.remove('hidden');
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function need(id, label, errors) {
    const node = $('#' + id);
    const value = (node.value || '').trim();
    if (!value) {
      node.classList.add('invalid');
      errors.push(label);
      return null;
    }
    return value;
  }

  function needPositive(id, label, errors) {
    const node = $('#' + id);
    const value = parseFloat(node.value);
    if (!Number.isFinite(value) || value <= 0) {
      node.classList.add('invalid');
      errors.push(label);
      return 0;
    }
    return value;
  }

  /* ---------- submit ---------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const errors = [];

    const date       = need('pcDate', pcState.outcome === 'remainder' ? 'Date Paid' : 'Call Date', errors);
    const booked     = ($('#pcBooked').value || '').trim();
    if (booked && date && booked > date && pcState.outcome !== 'remainder') {
      $('#pcBooked').classList.add('invalid');
      errors.push('Date Booked can’t be after the Call Date');
    }
    const closer     = need('pcCloser', 'Closer', errors);
    const setter     = need('pcSetter', 'Setter', errors);
    const clientName = need('pcName', 'Client Full Name', errors);

    const row = {
      id: 'L-' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      funnel: pcState.funnel,
      outcome: pcState.outcome,
      callName: ($('#pcCall').value || '').trim(),
      /* Booked is when it went on the calendar; left empty, it is the
         same day as the call. */
      bookedDate: pcState.outcome !== 'remainder' && booked ? booked : date,
      callDate: date,
      closer, setter,
      clientName,
      clientEmail: ($('#pcEmail').value || '').trim(),
      clientPhone: ($('#pcPhone').value || '').trim(),
      fathomUrl: ($('#pcFathom').value || '').trim(),
      contractValue: 0,
      payments: [],
      notes: ($('#pcNotes').value || '').trim(),
      loggedAt: new Date().toISOString(),
      /* Owners and admins are named; reps share their team's account, and
         the Closer and Setter fields already record who did the work. */
      loggedBy: currentLogger()
    };

    if (pcState.outcome === 'closed') {
      const method = need('pcPaymentMethod', 'Payment Method', errors);
      const revenue = needPositive('pcRevenue', 'Revenue Generated', errors);
      const cash = parseFloat($('#pcCash').value);

      row.paymentMethod = method;
      row.contractValue = revenue;
      if (Number.isFinite(cash) && cash > 0) {
        const type = method === 'paid_in_full' ? 'full'
          : method === 'financing' ? 'financing' : 'deposit';
        row.payments.push({ date, amount: cash, type });
      }
    }

    if (pcState.outcome === 'disqualified') {
      const wasCall = need('pcWasCall', 'Was this a call?', errors);
      need('pcDqType', 'Disqualification Type', errors);
      row.wasCall = wasCall === 'yes';
      row.dqType = $('#pcDqType').value;
    }

    if (pcState.outcome === 'remainder') {
      const amount = needPositive('pcRemainder', 'Remainder Cash Paid Today', errors);
      if (amount > 0) row.payments.push({ date, amount, type: 'remainder' });
    }

    if (errors.length) { fail(errors); return; }

    const rows = loggedCalls();

    if (pcState.editingId) {
      const i = rows.findIndex((x) => x.id === pcState.editingId);
      if (i !== -1) {
        pushUndo({
          kind: 'restoreCall',
          label: 'Edited the call for ' + (rows[i].clientName || 'a client'),
          row: rows[i],
          index: i
        });
        row.id = rows[i].id;
        row.loggedAt = rows[i].loggedAt;
        row.editedAt = new Date().toISOString();
        rows[i] = row;
      } else {
        rows.push(row);           // row was deleted while being edited
      }
      try {
        await saveCall(row);
      } catch (err) {
        console.error(err);
        fail(["Couldn't save those changes — check your connection and try again."]);
        return;
      }
      endEdit();
      render();
      renderDataTab();
      showTab('data');
      notify('Changes saved. Everyone on the board sees them.');
      return;
    }

    const button = $('#pcSubmit');
    button.disabled = true;
    try {
      await saveCall(row);
    } catch (err) {
      console.error(err);
      fail(["Couldn't log that call — check your connection and try again."]);
      return;
    } finally {
      button.disabled = false;
    }

    resetForm();
    render();
    renderDataTab();
    notify('Call logged — the dashboard has been updated for everyone.');
  });

  /* ---------- editing an existing row ---------- */
  function setSelectValue(sel, value) {
    if (!value) { sel.value = ''; return; }
    const known = Array.prototype.some.call(sel.options, (o) => o.value === value);
    if (!known) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value + ' (no longer on the team)';
      sel.appendChild(opt);
    }
    sel.value = value;
  }

  function startEdit(id) {
    const row = loggedCalls().find((r) => r.id === id);
    if (!row) return;

    pcState.editingId = id;
    pcState.funnel = row.funnel;
    paintPills($('#pcFunnel'), row.funnel);
    applyOutcome(row.outcome);

    $('#pcCall').value = row.callName || '';
    $('#pcDate').value = row.callDate || '';
    $('#pcBooked').value = row.bookedDate && row.bookedDate !== row.callDate ? row.bookedDate : '';
    /* Someone may have left the team since this call was logged — keep
       their name on the row rather than silently blanking it. */
    setSelectValue($('#pcCloser'), row.closer);
    setSelectValue($('#pcSetter'), row.setter);
    $('#pcName').value = row.clientName || '';
    $('#pcEmail').value = row.clientEmail || '';
    $('#pcPhone').value = row.clientPhone || '';
    $('#pcFathom').value = row.fathomUrl || '';
    $('#pcNotes').value = row.notes || '';

    const cash = row.payments.reduce((s, p) => s + p.amount, 0);
    $('#pcPaymentMethod').value = row.paymentMethod || '';
    $('#pcCash').value = row.outcome === 'closed' ? String(cash) : '0';
    $('#pcRevenue').value = String(row.contractValue || 0);
    $('#pcWasCall').value = row.wasCall === undefined ? '' : (row.wasCall ? 'yes' : 'no');
    $('#pcDqType').value = row.dqType || '';
    $('#pcRemainder').value = row.outcome === 'remainder' ? String(cash) : '0';

    const banner = $('#pcEditBanner');
    banner.textContent = 'Editing the call logged for ' + (row.clientName || 'this client') +
      ' on ' + row.callDate + '. Saving overwrites that row.';
    banner.classList.remove('hidden');
    $('#pcSubmit').textContent = 'Save Changes';
    $('#pcCancelEdit').classList.remove('hidden');

    showTab('postcall');
  }

  function endEdit() {
    pcState.editingId = null;
    $('#pcEditBanner').classList.add('hidden');
    $('#pcSubmit').textContent = 'Log Call';
    $('#pcCancelEdit').classList.add('hidden');
    pcState.funnel = 'vsl';
    paintPills($('#pcFunnel'), 'vsl');
    applyOutcome('closed');
    resetForm();
  }

  $('#pcCancelEdit').addEventListener('click', () => {
    endEdit();
    showTab('data');
  });

  function resetForm() {
    $('#pcBooked').value = '';
    ['pcCall', 'pcName', 'pcEmail', 'pcPhone', 'pcFathom', 'pcCash', 'pcRevenue', 'pcRemainder', 'pcNotes']
      .forEach((id) => { $('#' + id).value = id === 'pcCash' || id === 'pcRevenue' || id === 'pcRemainder' ? '0' : ''; });
    $('#pcPaymentMethod').value = '';
    $('#pcWasCall').value = '';
    $('#pcDqType').value = '';
    clearErrors();
  }

  /* With no roster, Closer and Setter are empty dropdowns and the form is a
     dead end — point at the fix instead of letting someone stall. */
  function paintRosterHint() {
    $('#pcRosterHint').classList.toggle('hidden', roster().length > 0);
  }

  $('#pcGoTeam').addEventListener('click', () => showTab('team'));

  /* The Data tab drives editing through this — one form, one set of rules. */
  window.PostCallForm = { startEdit: startEdit, paintRosterHint: paintRosterHint };

  /* ---------- boot ---------- */
  /* Closer and Setter are filled by fillTeamSelects() in app.js — the
     Add Team roster is their single source. */
  fillSelect($('#pcPaymentMethod'), PAYMENT_METHODS, 'Select...');
  fillSelect($('#pcDqType'), DQ_TYPES, 'Select...');
  fillSelect($('#pcWasCall'), [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], 'Select...');

  const FUNNEL_HUES = { vsl: '#3b82f6', webinar: '#a855f7' };
  buildPills($('#pcFunnel'),
    FUNNELS.map((f) => ({ value: f.value, label: f.label, color: FUNNEL_HUES[f.value] })),
    pcState.funnel, (v) => {
      pcState.funnel = v;
      paintPills($('#pcFunnel'), v);
    });

  buildPills($('#pcOutcome'),
    OUTCOMES.map((o) => ({ value: o.key, label: o.label, color: o.color })),
    pcState.outcome, applyOutcome);

  const now = new Date();
  $('#pcDate').value = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  applyOutcome('closed');
  paintRosterHint();
}

/* ---------- who is logging ---------- */
function currentLogger() {
  if (CACHE.me && CACHE.me.kind === 'person') return CACHE.me.name || CACHE.me.email;
  return 'Team';
}
