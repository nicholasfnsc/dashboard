# IA Dashboard

Sales & commission dashboard for the team. **Dashboard**, **Post Call Form**, **Data** and
**Add Team** are the four tabs. Zero-build static site — open `index.html`
in a browser and it runs, and Vercel deploys it as-is with no build step.

```
index.html    markup for all four tabs
middleware.js the front door — Vercel checks the password before sending anything
config.js     optional Supabase URL and anon key (safe to publish)
db.js         storage: this browser alone, or shared, same interface either way
boot.js       start-up
supabase-schema.sql   optional, run once in the Supabase SQL editor
logo.png      the IA mark — brand mark in the header and the favicon
styles.css    design tokens + all styling (black ground, steel-blue accent)
data.js       record shape and shared vocabulary (outcomes, funnels, rates)
app.js        metric definitions, filtering, charts, drag-to-reorder, pinning
form.js       Post Call Form — conditional fields, validation, submission, editing
datatab.js    Data tab — the call log, with edit and delete per row
team.js       Add Team — roster, secret key, and the key gate
```

## Run it locally

Double-click `index.html`. That's it — no Node, no install.

## Deploy to Vercel

Push this folder to a GitHub repo, then import it in Vercel as a project with
**Framework Preset: Other** and no build command. The output directory is the repo root.

## The data model

One row per Post Call Form submission. Every row on the board is real — there is no
sample or seed data.

```js
{
  id: 'C-1042',
  funnel:     'vsl',          // vsl | webinar
  outcome:    'closed',       // see the outcome table below
  callName:   'Call 1',
  bookedDate: '2026-09-01',   // when the call was set
  callDate:   '2026-09-08',   // when the call was scheduled to happen
  closer:     'Marcus Hill',
  setter:     'Aisha Khan',
  clientName: 'Jamie Smith',
  clientEmail: '', clientPhone: '', fathomUrl: '',

  contractValue: 9000,        // Revenue Generated — closed rows only
  paymentMethod: 'deposit',   // financing | paid_in_full | deposit
  wasCall: true,              // disqualified rows only
  dqType: 'financial',        // financial | icp

  payments: [                 // cash actually received, each on its own date
    { date: '2026-09-08', amount: 3000, type: 'deposit' }
  ],
  notes: ''
}
```

Payments carry their own dates so "cash collected in September" counts money that
*landed* in September, not deals that closed in September. That's what separates
**Total Cash Collected** from **New Cash Collected**. Payment `type` is one of
`deposit`, `full`, `financing` or `remainder`.

### Outcomes

| Outcome | On the calendar? | Attended? |
|---|---|---|
| Closed/Won/Deposit | yes | yes |
| No Close | yes | yes |
| Disqualified | **depends on `wasCall`** | yes, when it was a call |
| No-Show | yes | no |
| Cancelled | yes | no |
| Rescheduled | yes | no |
| Remainder Collection (no call) | **no** | no |
| 2nd CC Call Booked | yes | yes |

Two rows never touch a call count:

- **Remainder Collection** was never a booked slot — it's a balance payment being
  chased. Counting it as a call would inflate volume and crush show rate.
- **Disqualified with "Was this a call?" = No** means the lead was disqualified before
  a call ever happened, so it was never on the calendar either.

Their money still lands in the cash and commission figures. That's the point of
separating the two.

## How each KPI is calculated

Within the selected date range, `scheduled` = calendar rows whose `callDate` falls in
range, `booked` = calendar rows whose `bookedDate` falls in range.

| Metric | Formula |
|---|---|
| Total Cash Collected | sum of payments dated in range |
| New Cash Collected | payments in range on rows that **closed** in range |
| Remainder Cash Collected | payments in range of type `remainder` |
| Cash Collected from Deposits | payments in range of type `deposit` |
| Live Calls | scheduled rows where the prospect attended |
| Cash per Live Call / per Booking | total cash ÷ live calls / ÷ booked |
| AOV | total contract value ÷ deals |
| Close Rate | deals ÷ live calls |
| Total Show Rate | live calls ÷ scheduled (DQs on a call count as shown) |
| Show Rate | (closed + no close + 2nd call) ÷ scheduled (DQs excluded) |
| DQ Rate | disqualified-on-a-call ÷ live calls |
| Commission | each person's rate × cash collected in range on their rows |

House rates are **10% for closers, 5% for setters**, applied to cash actually collected
in the period. They live as `CLOSER_RATE` / `SETTER_RATE` in `data.js`, with a per-person
`rate` on each `TEAM` entry so someone can be put on a different deal — the Add Team tab
will edit these.

## Post Call Form

Funnel and Outcome are always asked. Everything after that depends on the outcome:

| Outcome | Extra fields | Notes prompt |
|---|---|---|
| Closed/Won/Deposit | Payment Method, Cash Collected, Revenue Generated | Why did this close? |
| No Close | — | Why did you not close this? |
| Disqualified | Was this a call?, Disqualification Type | Why was this person disqualified? |
| No-Show | — | What was the reason this call no-showed? |
| Cancelled | — | What was the reason this was cancelled? |
| Rescheduled | — | What was the reason for this reschedule? |
| Remainder Collection | Remainder Cash Paid Today | *none* |
| 2nd CC Call Booked | — | Why couldn't you close, and why was a second call booked? |

Always required: Date, Closer, Setter, Client Full Name. Closed also requires Payment
Method and a Revenue Generated above zero; Disqualified requires both of its selects;
Remainder requires a cash amount above zero.

Submissions are written to `localStorage` under `ia-dash:calls` and picked up by the
Dashboard immediately. With no roster yet, the form points at the Add Team tab instead of
offering two empty dropdowns.

### Known gap

The form captures one date, so for logged rows `bookedDate` and `callDate` are the same
day. That makes **Calls On Calendar** equal to calls held rather than calls set. Adding a
"Date Booked" field to the form fixes it; the metric code already reads the two
separately.

## Data tab

Lists every row logged through the form, newest first, filterable by outcome. The
**Details** and **Cash Type** columns are derived, not stored:

- **Details** answers whatever the outcome makes relevant — payment method and revenue
  for a close, DQ type and whether it was a call for a disqualification.
- **Cash Type** is `new` for cash from a fresh close and `remainder` for a balance
  payment, the same split the dashboard reports.

**Edit** hands the row back to the Post Call Form in editing mode rather than opening a
second form, so the conditional fields and validation can never drift apart. Saving
overwrites the row in place, keeping its `id` and original `loggedAt`, and stamps
`editedAt`. **Delete** asks first and cannot be undone.

Deleting a row asks first and is undoable from the top strip.

## Locking the board

`middleware.js` runs on Vercel's servers and checks the password **before a single file
is sent**. Someone without it never receives the dashboard — not the HTML, not the
scripts, not one number. There is nothing on their machine to inspect.

Two doors, two secrets, both held by Vercel:

| Address | Who | Environment variable |
|---|---|---|
| `sales.inevitableacq.com` | you | `OWNER_PASSWORD` |
| `sales.inevitableacq.com/sales-team` | the sales team | `TEAM_KEY` |

Set them in **Vercel → Settings → Environment Variables**, then redeploy. Until
`OWNER_PASSWORD` exists the board refuses to open at all, so it can never be public by
accident.

Neither value is in this repo, and neither is ever sent to a browser. The sign-in page
posts what was typed; Vercel compares it server-side and answers with a cookie holding
only a hash. Changing a password invalidates every cookie issued under the old one.

To change the team key, edit `TEAM_KEY` and redeploy. To take the door off entirely,
delete `middleware.js`.

`package.json` exists only so Vercel can install the one package the middleware imports.
Nothing is installed on your machine and the site still has no build step.

## Sharing data with the team

**Optional.** Without it, the board works immediately and saves everything in whichever
browser you are using — fine for you alone, but your team's calls stay on their machines.

To put everyone on the same rows:

1. Create a free project at supabase.com
2. **SQL Editor** → paste all of `supabase-schema.sql` → Run
3. **Project Settings → API** → paste the **Project URL** and **anon public** key into
   `config.js`, then push

That is the whole setup. No accounts to create, no roles to assign — who may open the
board was already settled at the door.

Once connected, open boards refresh themselves within a second of anyone logging a call.

Those two values in `config.js` are meant to be public, but they are only reachable by
someone already past the password, since the middleware gates every file including that
one.


## Add Team

The roster here is the single source for the Closer and Setter dropdowns everywhere else,
and for who the Commission Tracking panels pay. Stored in `localStorage` under
`ia-dash:team` as `{ name, role, rate }`; new closers get `CLOSER_RATE`, setters
`SETTER_RATE`.

Removing someone takes them out of the dropdowns and out of Commission Tracking and
**never touches a call they already logged** — fire someone and the history stays exactly
as it was. If you later edit one of their rows, the form keeps their name and marks it
"no longer on the team" rather than blanking it. A removal is undoable.

### The secret key

Five random uppercase letters (I and O are excluded; they read as 1 and 0). Generated on
first load and stored under `ia-dash:teamKey`.

**Only the owner can rotate it.** The browser that first created the key is stamped
`ia-dash:owner`; anyone who arrives later and types the key in is a team member and never
gets that flag, so the "Generate a new key" button does not render for them.

An inline script at the top of the page checks the lock *before* the board paints, so a
locked visitor never catches a frame of the figures.

**Preview the login screen** locks this browser so the gate can be tried end to end. The
gate shows the key and an exit route while the key is held in this browser, so previewing
can never strand the owner. The team login page URL is editable and saved; it defaults to
`https://sales.inevitableacq.com/sales-team`, and `vercel.json` rewrites that path to
`index.html` so the link resolves.

The key is checked by Vercel before this page is sent, so it is never part of the site
and cannot be read from it. See "Locking the board" above.

## Interactions already wired

- **Filters** — date range, funnel, outcome, closer, setter; active ones turn blue.
- **Pin a metric** — click a card's icon chip. Pinned cards get the blue treatment.
- **Reorder** — drag any card by its grip. Order and pins persist in `localStorage`.
- **Charts** — hover any donut segment, bar, or commission bar for exact figures.
- **Undo** — a small button in the top strip, appearing only when there is something to
  undo. Covers deleting a call, editing a call, and removing a team member. History is
  kept as small deltas under `ia-dash:undo` (last 25), so it survives a reload.

## Next

1. A **Date Booked** field on the form, so Calls On Calendar measures calls set rather
   than calls held (see "Known gap" above).
2. Per-person logins, if you ever want the board to know who logged each row. The
   `logged_by` column is already recorded against every call, waiting for it.
