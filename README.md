# Inevitable Acquisition Portal

`portal.inevitableacq.com` — the home of every offer and every sales team.

## The one rule

**You either have an account or you have a code.** An account (owner or admin) gets the
Main Hub and the offers it is allowed. A code gets one offer's board and nothing else.

| Who | Goes to | Enters | Sees |
|---|---|---|---|
| Owner | `portal.inevitableacq.com` | email + password | Main Hub, every offer, admins |
| Admin | `portal.inevitableacq.com` | email + password | Main Hub, only their offers |
| Rep | `portal.inevitableacq.com/sales-team` | the offer's code | that offer's board only |

Every board has the same tabs: Dashboard, Post Call Form, Data, Add Team (owner and admins
only) and Onboarding. Offers differ only by name and data — one board, rendered per offer.

## Where things live

```
index.html        every screen: sign-in, code page, hub, board
config.js         Supabase address and publishable key (both public by design)
db.js             every read and write to Supabase
boot.js           decides which screen each person gets
hub.js            Main Hub: offer cards, new offer, admins and invites
app.js            dashboard metrics, charts, filters, undo
form.js           Post Call Form
datatab.js        Data tab
team.js           Add Team: roster, team login page, code, new code
onboarding.js     Onboarding: the offer's name and Directory links
data.js           outcomes, funnels, commission rates
api/enter.js      team code -> that offer's team account
api/boards.js     create an offer, make a new code, archive
api/people.js     invite admins, change their offers, remove them
supabase/schema.sql   tables and access rules
```

## Security

Access is enforced by Row Level Security in the database, not by the page. A request for
an offer's data that the person may not see comes back empty wherever it comes from.

- **Sign-ups are off** in Supabase. Admins exist only because the owner invited them.
- **A code is the password of that offer's team account.** Supabase checks it.
- **Making a new code** creates a fresh team account and deletes the old one, signing
  every rep on that offer out at once. Calls belong to the offer, so none are touched.
- **The secret key** lives only in Vercel as `SUPABASE_SERVICE_ROLE_KEY`, read by the
  functions in `api/`. It is never in this repository and never reaches a browser.
- **Nothing is deleted.** Offers are archived; the database refuses to delete an offer
  that holds calls; removing a rep switches them off and keeps their history.

## Deploying

Deploy from this folder with `vercel deploy --prod`. There is no build step.

Database changes: edit `supabase/schema.sql` and run it in the Supabase SQL Editor. It is
written to be safe to run again.

## Before inviting admins

In Supabase → **Authentication → URL Configuration**, set **Site URL** to
`https://portal.inevitableacq.com` and add `https://portal.inevitableacq.com/**` under
**Redirect URLs**. Otherwise invitation links point somewhere else.

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

Submissions are saved to the `calls` table in Supabase against the offer's board and picked
up by every open board within 15 seconds. Each call records who logged it.

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
