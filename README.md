# IA Dashboard

Sales & commission dashboard for the team. **Dashboard**, **Post Call Form**, **Data** and
**Add Team** are the four tabs. Zero-build static site — open `index.html`
in a browser and it runs, and Vercel deploys it as-is with no build step.

```
index.html    markup for all four tabs
config.js     your Supabase URL and anon key (safe to publish)
db.js         shared storage, sign-in, and live updates
boot.js       start-up: confirm a session, then start the board
supabase-schema.sql   run once in the Supabase SQL editor
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

## Backend setup

Do this once. It takes about ten minutes and turns the board from
one-browser-at-a-time into something the whole team shares.

**1. Create a Supabase project** at supabase.com — the free tier is plenty.

**2. Build the database.** Open **SQL Editor**, paste the whole of
`supabase-schema.sql`, and run it.

**3. Turn off public sign-ups.** **Authentication → Providers → Email** and switch
**Enable sign ups** off. Without this, anyone could create themselves an account and
walk in.

**4. Create the two accounts.** **Authentication → Users → Add user**, twice. Tick
**Auto Confirm User** both times.

| Account | Email | Password |
|---|---|---|
| You | your own email | a strong password, **new** — not one you have used elsewhere |
| The team | `team@inevitableacq.com` | the secret key you hand out |

Nobody types these into a file. Supabase hashes them and checks them on its server.

**5. Say which one is the owner.** Back in the SQL Editor, with your own email
substituted:

```sql
insert into public.profiles (id, role)
select id, 'owner' from auth.users where email = 'YOUR-EMAIL-HERE'
on conflict (id) do update set role = 'owner';

insert into public.profiles (id, role)
select id, 'team' from auth.users where email = 'team@inevitableacq.com'
on conflict (id) do update set role = 'team';
```

**6. Connect the site.** **Project Settings → API** gives you a **Project URL** and an
**anon public** key. Paste both into `config.js`, then commit and push — Vercel
redeploys on its own.

Those two values are meant to be public. On their own they open nothing: every table
refuses to answer without a signed-in session, which is what Row Level Security in the
schema enforces.

**7. Point the domain at it.** In Vercel, add `sales.inevitableacq.com` under
**Settings → Domains**.

### How access works afterwards

| Address | Who | What they type |
|---|---|---|
| `sales.inevitableacq.com` | you | your email and password |
| `sales.inevitableacq.com/sales-access` | the sales team | the secret key |

Both land on the same board with the same numbers. The roster and the team login link
are owner-only; everything else is shared.

To change the key, edit the `team@inevitableacq.com` user's password under
**Authentication → Users**. To cut someone off entirely, change it and hand the new one
only to the people who should still have it.

### Why no secret lives in this repo

Everything in these files is downloaded by every visitor's browser — that is what a
website is. So nothing secret can be kept here, and nothing secret is: passwords and the
team key exist only inside Supabase, stored as hashes, compared on their server. The
browser only ever learns yes or no.


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
`https://sales.inevitableacq.com/sales-access`, and `vercel.json` rewrites that path to
`index.html` so the link resolves.

Sign-in is handled by Supabase Auth. The key is the password on the shared
`team@inevitableacq.com` account, so this page never holds it and cannot reveal it.

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
