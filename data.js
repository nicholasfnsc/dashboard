/* ============================================================
   data.js — record shape and shared vocabulary
   ------------------------------------------------------------
   One row = one Post Call Form submission. Every dashboard number
   is derived from these rows; nothing is stored twice.

   A row looks like this:

   {
     id: 'L-abc123',
     funnel:     'vsl',          // vsl | webinar
     outcome:    'closed',       // see OUTCOMES below
     callName:   'Call 1',
     bookedDate: '2026-09-01',   // when the call was set
     callDate:   '2026-09-08',   // when the call was scheduled
     closer:     'Marcus Hill',
     setter:     'Aisha Khan',
     clientName: 'Jamie Smith',
     clientEmail: '', clientPhone: '', fathomUrl: '',
     contractValue: 9000,        // Revenue Generated — closed rows only
     paymentMethod: 'deposit',   // financing | paid_in_full | deposit
     wasCall: true,              // disqualified rows only
     dqType: 'financial',        // financial | icp
     payments: [{ date: '2026-09-08', amount: 3000, type: 'deposit' }],
     notes: ''
   }

   Payments carry their own dates, so cash counts in the month it
   landed rather than the month the deal closed.
   ============================================================ */

/* What each side earns is chosen on the call itself, because it depends
   on the work done, not on the person. A setter who called a lead that
   was already booked triaged it, not set it. A closer who booked the
   lead as well did both jobs. The usual case is the default. */
const CLOSER_RATE = 0.10;
const SETTER_RATE = 0.05;

const SETTER_RATES = [
  { value: String(0.05), label: 'Set the call (5%)', rate: 0.05 },
  { value: String(0.03), label: 'Triaged the lead (3%)', rate: 0.03 }
];

const CLOSER_RATES = [
  { value: String(0.10), label: 'Closed the call (10%)', rate: 0.10 },
  { value: String(0.13), label: 'Triaged and closed (13%)', rate: 0.13 },
  { value: String(0.15), label: 'Booked and closed (15%)', rate: 0.15 }
];

const FUNNELS = [
  { value: 'vsl',     label: 'VSL' },
  { value: 'webinar', label: 'Webinar' }
];

const PAYMENT_METHODS = [
  { value: 'financing',    label: 'Financing' },
  { value: 'paid_in_full', label: 'Paid in Full' },
  { value: 'deposit',      label: 'Deposit' }
];

/* How long a client bought for. Their renewal date is the close plus this. */
const PROGRAM_TERMS = [
  { value: '3',  label: '3 months', months: 3 },
  { value: '6',  label: '6 months', months: 6 }
];

const DQ_TYPES = [
  { value: 'financial', label: 'Financial Disqualification' },
  { value: 'icp',       label: 'ICP Disqualification' }
];

/* ------------------------------------------------------------
   Outcomes.
     isCall — was this a booked slot on the calendar? Remainder
              collections are not, so they never touch show rate,
              close rate or any call count.
     isLive — did the prospect actually attend?
   A Disqualified row overrides isCall with its own `wasCall`
   field: a lead disqualified before a call ever happened was
   never on the calendar either.
   ------------------------------------------------------------ */
const OUTCOMES = [
  { key: 'closed',       label: 'Closed/Won/Deposit',           short: 'Closed',       color: '#22c55e', isCall: true,  isLive: true  },
  { key: 'no_close',     label: 'No Close',                     short: 'No Close',     color: '#3b82f6', isCall: true,  isLive: true  },
  { key: 'disqualified', label: 'Disqualified',                 short: 'Disqualified', color: '#ef4444', isCall: true,  isLive: true  },
  { key: 'no_show',      label: 'No-Show',                      short: 'No-Show',      color: '#f59e0b', isCall: true,  isLive: false },
  { key: 'cancelled',    label: 'Cancelled',                    short: 'Cancelled',    color: '#a855f7', isCall: true,  isLive: false },
  { key: 'rescheduled',  label: 'Rescheduled',                  short: 'Rescheduled',  color: '#94a3b8', isCall: true,  isLive: false },
  { key: 'remainder',    label: 'Remainder Collection (no call)', short: 'Remainder',  color: '#14b8a6', isCall: false, isLive: false },
  { key: 'second_call',  label: '2nd CC Call Booked',           short: '2nd Call',     color: '#06b6d4', isCall: true,  isLive: true  }
];

const outcomeDef = (key) => OUTCOMES.find((o) => o.key === key);

/* The question each outcome asks in the notes box. Remainder asks nothing. */
const OUTCOME_PROMPT = {
  closed:       'Why did this close?',
  no_close:     'Why did you not close this?',
  disqualified: 'Why was this person disqualified?',
  no_show:      'What was the reason this call no-showed?',
  cancelled:    'What was the reason this was cancelled?',
  rescheduled:  'What was the reason for this reschedule?',
  second_call:  "Why couldn't you close on this call, and why was a second call booked instead?"
};

/* Did this row occupy a slot on the calendar? */
function isCallRecord(r) {
  const def = outcomeDef(r.outcome);
  if (!def || !def.isCall) return false;
  if (r.outcome === 'disqualified' && r.wasCall === false) return false;
  return true;
}

/* Did the prospect actually show up? */
function isLiveRecord(r) {
  if (!isCallRecord(r)) return false;
  const def = outcomeDef(r.outcome);
  return !!def.isLive;
}
