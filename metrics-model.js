/* ============================================================
   metrics-model.js — what Metrics Tracking measures, and how
   ------------------------------------------------------------
   Every metric is one of three kinds:

     input     typed in each day (ad spend, clicks, attendees…)
     sales     read live from the offer's Post Call Form, only the
               calls logged under this funnel (VSL or Webinar)
     formula   one metric divided by another (cost per lead,
               show rate, ROAS…), optionally × 100 for a percent

   Days are the day a call was held and the day money came in —
   the same rules as the sales board. Weeks run Monday to Sunday.

   The lists below are only the starting point for each offer. Once
   anyone edits an offer's metrics, that offer keeps its own copy.
   ============================================================ */

const METRIC_FUNNELS = [
  { key: 'vsl', label: 'VSL' },
  { key: 'webinar', label: 'Webinar' }
];

const METRIC_UNITS = {
  count:   { label: 'Number',   agg: 'sum' },
  money:   { label: 'Money ($)', agg: 'sum' },
  percent: { label: 'Percent (%)', agg: 'avg' },
  score:   { label: 'Score',    agg: 'avg' },
  ratio:   { label: 'Multiple (x)', agg: 'avg' }
};

/* Everything the sales board can answer, for any day or week. */
const SALES_SOURCES = {
  callsOnCalendar: { label: 'Calls scheduled',     unit: 'count' },
  callsBooked:     { label: 'Calls booked',        unit: 'count' },
  callsShown:      { label: 'Calls shown',         unit: 'count' },
  noShows:         { label: 'No-shows',            unit: 'count' },
  cancelled:       { label: 'Cancelled calls',     unit: 'count' },
  showRate:        { label: 'Show rate',           unit: 'percent' },
  totalShowRate:   { label: 'Total show rate',     unit: 'percent' },
  dqRate:          { label: 'DQ rate',             unit: 'percent' },
  closeRate:       { label: 'Close rate',          unit: 'percent' },
  deals:           { label: 'Deals closed',        unit: 'count' },
  depos:           { label: 'Deposits',            unit: 'count' },
  cash:            { label: 'Cash collected',      unit: 'money' },
  revenue:         { label: 'Revenue generated',   unit: 'money' },
  aov:             { label: 'Average order value', unit: 'money' },
  cashPerLiveCall: { label: 'Cash per live call',  unit: 'money' }
};

const GROUP_COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#06b6d4'];

/* ---------- starting templates ---------- */
const tplInput = (id, name, unit, target, good) => ({ id, name, source: 'input', unit, target: target == null ? null : target, good: good || 'up' });
const tplSales = (id, name, key, target, good) => ({ id, name, source: 'sales', key, unit: SALES_SOURCES[key].unit, target: target == null ? null : target, good: good || 'up' });
const tplFormula = (id, name, a, b, unit, target, good) => ({ id, name, source: 'formula', a, b, unit, target: target == null ? null : target, good: good || 'up' });

const METRIC_TEMPLATES = {
  vsl: {
    groups: [
      { id: 'tofu-awareness', name: 'TOFU Awareness', color: '#f59e0b', metrics: [
        tplInput('ad_spend', 'Ad Spend (Meta)', 'money'),
        tplInput('link_clicks', 'Link Clicks', 'count'),
        tplFormula('cpc', 'Cost Per Click', 'ad_spend', 'link_clicks', 'money', 1, 'down'),
        tplFormula('cpl', 'Cost Per Lead', 'ad_spend', 'apps_submitted', 'money', 100, 'down'),
        tplFormula('cpbc', 'Cost Per Booked Call', 'ad_spend', 'sales.callsBooked', 'money', null, 'down'),
        tplFormula('roas', 'ROAS', 'sales.revenue', 'ad_spend', 'ratio', 7),
        tplInput('ctr_link', 'CTR Link', 'percent', 2),
        tplInput('hook_rate', 'Hook Rate', 'percent', 40)
      ] },
      { id: 'tofu-capture', name: 'TOFU Capture', color: '#3b82f6', metrics: [
        tplInput('lp_connect', 'LP Connect Rate', 'percent', 80),
        tplInput('lp_to_app', 'LP Click → App Rate', 'percent', 4),
        tplInput('vsl_visits', 'VSL Page Visits', 'count'),
        tplInput('vsl_play', 'VSL Play Rate', 'percent'),
        tplInput('vsl_engagement', 'VSL Engagement Rate', 'percent', 40),
        tplInput('apps_submitted', 'Apps Submitted', 'count'),
        tplInput('app_completion', 'App Completion Rate', 'percent', 50),
        tplFormula('app_to_booking', 'App → Booking Rate', 'sales.callsBooked', 'apps_submitted', 'percent', 80),
        tplInput('email_open', 'Email Open Rate', 'percent', 40),
        tplInput('email_ctr', 'Email CTR', 'percent', 3),
        tplInput('app_quality', 'App Quality (1–5)', 'score', 4)
      ] },
      { id: 'sales-setting', name: 'Sales Setting', color: '#22c55e', metrics: [
        tplInput('dials', 'Dials', 'count'),
        tplSales('calls_on_calendar', 'Calls Scheduled', 'callsOnCalendar'),
        tplSales('calls_show', 'Calls Show', 'callsShown'),
        tplSales('show_rate', 'Show Up Rate', 'showRate', 80)
      ] },
      { id: 'bofu-closing', name: 'BOFU Closing', color: '#ef4444', metrics: [
        tplSales('dq_rate', 'DQ Rate', 'dqRate', 15, 'down'),
        tplSales('close_rate', 'Close Rate', 'closeRate', 60),
        tplSales('cash_per_live', 'Cash / Live Call', 'cashPerLiveCall'),
        tplSales('aov', 'AOV', 'aov', 7000),
        tplSales('sales_units', 'Sales Units', 'deals'),
        tplSales('depos', 'Depos', 'depos'),
        tplSales('cash_collected', 'Cash Collected', 'cash'),
        tplSales('revenue', 'Revenue Generated', 'revenue')
      ] }
    ],
    stages: [
      { name: 'Clicks', sub: 'From Meta ads', metric: 'link_clicks' },
      { name: 'Applications', sub: 'Applications submitted', metric: 'apps_submitted' },
      { name: 'Calls scheduled', sub: 'On the calendar this week', metric: 'sales.callsOnCalendar' },
      { name: 'Calls shown', sub: 'Actually attended', metric: 'sales.callsShown' },
      { name: 'Closed', sub: 'Deals won', metric: 'sales.deals' }
    ]
  },

  webinar: {
    groups: [
      { id: 'pre-webinar', name: 'Pre-Webinar', color: '#f59e0b', metrics: [
        tplInput('ad_spend', 'Ad Spend (Meta)', 'money'),
        tplInput('clicks', 'Clicks', 'count'),
        tplFormula('cpc', 'Cost Per Click', 'ad_spend', 'clicks', 'money', 1, 'down'),
        tplInput('registrants', 'Registrants', 'count'),
        tplFormula('optin_rate', 'Opt-in Rate', 'registrants', 'clicks', 'percent', 20),
        tplFormula('cost_per_optin', 'Cost Per Opt-in', 'ad_spend', 'registrants', 'money', null, 'down')
      ] },
      { id: 'webinar-conversion', name: 'Webinar Conversion', color: '#3b82f6', metrics: [
        tplInput('attendees', 'Attendees', 'count'),
        tplFormula('show_rate_webinar', 'Show Rate To Webinar', 'attendees', 'registrants', 'percent', 40),
        tplFormula('cost_per_attendee', 'Cost Per Attendee', 'ad_spend', 'attendees', 'money', null, 'down'),
        tplInput('retained_1', 'Retained Attendees – Section 1', 'count'),
        tplFormula('retention_1', 'Retention Rate – Section 1', 'retained_1', 'attendees', 'percent'),
        tplInput('retained_2', 'Retained Attendees – Section 2', 'count'),
        tplFormula('retention_2', 'Retention Rate – Section 2', 'retained_2', 'attendees', 'percent'),
        tplInput('retained_3', 'Retained Attendees – Section 3', 'count'),
        tplFormula('retention_3', 'Retention Rate – Section 3', 'retained_3', 'attendees', 'percent'),
        tplInput('retained_pitch', 'Retained Attendees At Pitch', 'count'),
        tplFormula('retention_pitch', 'Retention Rate At Pitch', 'retained_pitch', 'attendees', 'percent')
      ] },
      { id: 'sales-conversion', name: 'Sales Conversion', color: '#22c55e', metrics: [
        tplInput('leads', 'Leads', 'count'),
        tplSales('calls_booked', 'Calls Booked', 'callsBooked'),
        tplFormula('pitch_to_apply', 'Retained Attendees → Apply Rate', 'leads', 'retained_pitch', 'percent'),
        tplFormula('cpbc', 'CPBC (Cost Per Booked Call)', 'ad_spend', 'sales.callsBooked', 'money', null, 'down'),
        tplSales('calls_shown', 'Calls Shown', 'callsShown'),
        tplSales('show_rate_call', 'Show Rate To Call', 'showRate', 80),
        tplFormula('cost_per_shown', 'Cost Per Shown Call', 'ad_spend', 'sales.callsShown', 'money', null, 'down'),
        tplSales('deals_closed', 'Deals Closed', 'deals'),
        tplSales('close_rate', 'Close Rate', 'closeRate', 60),
        tplSales('aov', 'AOV', 'aov', 7000)
      ] },
      { id: 'revenue', name: 'Revenue', color: '#ef4444', metrics: [
        tplSales('total_revenue', 'Total Revenue', 'revenue'),
        tplFormula('roas', 'ROAS', 'sales.revenue', 'ad_spend', 'ratio', 7)
      ] }
    ],
    stages: [
      { name: 'Registrants', sub: 'Opted in to the webinar', metric: 'registrants' },
      { name: 'Attendees', sub: 'Showed up live', metric: 'attendees' },
      { name: 'Applications', sub: 'Applied after the pitch', metric: 'leads' },
      { name: 'Calls scheduled', sub: 'On the calendar this week', metric: 'sales.callsOnCalendar' },
      { name: 'Calls shown', sub: 'Actually attended', metric: 'sales.callsShown' },
      { name: 'Closed', sub: 'Deals won', metric: 'sales.deals' }
    ]
  }
};

const templateFor = (funnel) => JSON.parse(JSON.stringify(METRIC_TEMPLATES[funnel]));

/* Offers saved before a rename keep working with today's names. */
function upgradeMetricConfig(config) {
  if (!config || !Array.isArray(config.groups)) return config;
  config.groups.forEach((g) => g.metrics.forEach((m) => {
    if (m.source === 'sales' && m.key === 'callsOnCalendar' && m.name === 'Calls On Calendar') m.name = 'Calls Scheduled';
  }));
  (config.stages || []).forEach((s) => {
    if (s.metric === 'sales.callsOnCalendar' && s.name === 'Calls on calendar') { s.name = 'Calls scheduled'; s.sub = 'On the calendar this week'; }
  });
  return config;
}

/* ---------- dates ---------- */
const isoDay = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function weekDays(monday) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/* ---------- the sales board, for any span of days ---------- */
const metricRate = (a, b, mult) => (b > 0 ? (a / b) * (mult || 1) : null);

function salesFigures(rows, from, to) {
  const inSpan = (iso) => !!iso && iso >= from && iso <= to;
  const calendar = rows.filter(isCallRecord);
  const scheduled = calendar.filter((c) => inSpan(c.callDate));
  const live = scheduled.filter(isLiveRecord);
  const deals = scheduled.filter((c) => c.outcome === 'closed');
  /* The sales dashboard's Show Rate: closed, no close and 2nd call count as
     showing; disqualified calls do not. Total Show Rate counts every live call. */
  const showed = scheduled.filter((c) => c.outcome === 'closed' || c.outcome === 'no_close' || c.outcome === 'second_call').length;
  const dq = scheduled.filter((c) => c.outcome === 'disqualified').length;
  const revenue = deals.reduce((s, c) => s + (c.contractValue || 0), 0);
  let cash = 0;
  rows.forEach((c) => (c.payments || []).forEach((p) => { if (inSpan(p.date)) cash += p.amount; }));

  return {
    callsOnCalendar: scheduled.length,
    callsBooked: calendar.filter((c) => inSpan(c.bookedDate || c.callDate)).length,
    callsShown: live.length,
    noShows: scheduled.filter((c) => c.outcome === 'no_show').length,
    cancelled: scheduled.filter((c) => c.outcome === 'cancelled').length,
    showRate: metricRate(showed, scheduled.length, 100),
    totalShowRate: metricRate(live.length, scheduled.length, 100),
    dqRate: metricRate(dq, live.length, 100),
    closeRate: metricRate(deals.length, live.length, 100),
    deals: deals.length,
    depos: deals.filter((c) => c.paymentMethod === 'deposit').length,
    cash,
    revenue,
    aov: metricRate(revenue, deals.length),
    cashPerLiveCall: metricRate(cash, live.length),
    /* for the charts */
    outcomes: scheduled.reduce((m, c) => { m[c.outcome] = (m[c.outcome] || 0) + 1; return m; }, {}),
    activity: scheduled.length + (cash > 0 ? 1 : 0)
  };
}

/* ---------- working a metric out ----------
   A calculator for one offer, one funnel. It remembers what it has
   already worked out, so a table of 30 metrics × 7 days stays quick. */
function metricCalculator(config, calls, entries) {
  const all = new Map();
  config.groups.forEach((g) => g.metrics.forEach((m) => all.set(m.id, m)));
  const salesCache = new Map();
  const valueCache = new Map();

  const sales = (from, to) => {
    const key = from + '|' + to;
    if (!salesCache.has(key)) salesCache.set(key, salesFigures(calls, from, to));
    return salesCache.get(key);
  };

  const entry = (id, iso) => {
    const v = entries.get(id + '|' + iso);
    return v == null ? null : v;
  };

  /* A span is a list of ISO days in order. */
  function value(ref, days, depth) {
    if ((depth || 0) > 6) return null;
    const cacheKey = ref + '@' + days[0] + '|' + days[days.length - 1];
    if (valueCache.has(cacheKey)) return valueCache.get(cacheKey);

    let result = null;
    if (ref.indexOf('sales.') === 0) {
      const key = ref.slice(6);
      result = SALES_SOURCES[key] ? sales(days[0], days[days.length - 1])[key] : null;
      if (result === 0 && SALES_SOURCES[key].unit !== 'percent' && days.length === 1 && !sales(days[0], days[0]).activity) result = null;
    } else {
      const m = all.get(ref);
      if (!m) result = null;
      else if (m.source === 'sales') result = value('sales.' + m.key, days, (depth || 0) + 1);
      else if (m.source === 'formula') {
        const a = value(m.a, days, (depth || 0) + 1);
        const b = value(m.b, days, (depth || 0) + 1);
        result = a == null || b == null ? null : metricRate(a, b, m.unit === 'percent' ? 100 : 1);
      } else {
        const got = days.map((iso) => entry(m.id, iso)).filter((v) => v != null);
        if (!got.length) result = null;
        else {
          const sum = got.reduce((s, v) => s + v, 0);
          result = (METRIC_UNITS[m.unit] || METRIC_UNITS.count).agg === 'sum' ? sum : sum / got.length;
        }
      }
    }
    valueCache.set(cacheKey, result);
    return result;
  }

  /* The average of the days that have a number — the "Avg" column. */
  function dailyAverage(ref, days) {
    const got = days.map((iso) => value(ref, [iso])).filter((v) => v != null);
    return got.length ? got.reduce((s, v) => s + v, 0) / got.length : null;
  }

  /* on target, behind, or nothing to judge */
  function status(m, v) {
    if (v == null || m.target == null || m.target === '') return null;
    return m.good === 'down' ? (v <= m.target ? 'on' : 'behind') : (v >= m.target ? 'on' : 'behind');
  }

  const describe = (m) => {
    if (m.source === 'sales') return 'From the sales board';
    if (m.source === 'formula') return nameOf(m.a) + ' ÷ ' + nameOf(m.b);
    return METRIC_UNITS[m.unit] && METRIC_UNITS[m.unit].agg === 'sum' ? 'Week total of daily entries' : 'Average of daily entries';
  };

  function nameOf(ref) {
    if (ref && ref.indexOf('sales.') === 0) return SALES_SOURCES[ref.slice(6)] ? SALES_SOURCES[ref.slice(6)].label : 'missing';
    const m = all.get(ref);
    return m ? m.name : 'a removed metric';
  }

  return { value, dailyAverage, status, describe, nameOf, find: (id) => all.get(id), sales };
}

/* ---------- showing a value ---------- */
function formatMetric(unit, v, short) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (unit === 'money') return short ? money0(v) : '$' + v.toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  if (unit === 'percent') return (Math.round(v * 10) / 10) + '%';
  if (unit === 'ratio') return (Math.round(v * 100) / 100) + 'x';
  if (unit === 'score') return String(Math.round(v * 10) / 10);
  return (Math.round(v * 10) / 10).toLocaleString('en-US');
}

/* Axis labels: short, but never so rounded that two lines read the same. */
function axisLabel(unit, v, top) {
  const small = top < 10;
  if (unit === 'money') return v >= 1000 ? '$' + Math.round(v / 100) / 10 + 'k' : '$' + (small ? Math.round(v * 100) / 100 : Math.round(v));
  if (unit === 'percent') return Math.round(v) + '%';
  if (unit === 'ratio') return (Math.round(v * 10) / 10) + 'x';
  return String(small ? Math.round(v * 10) / 10 : Math.round(v));
}

const unitPrefix = (unit) => (unit === 'money' ? '$' : '');
const unitSuffix = (unit) => (unit === 'percent' ? '%' : unit === 'ratio' ? 'x' : '');
