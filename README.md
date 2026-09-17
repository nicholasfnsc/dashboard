# Inevitable Acquisition Portal

`portal.inevitableacq.com` — one sign-in for every section of the company. Today that is
Sales Team Boards; new sections are added as cards on the portal page.

## The one rule

**You either have an account or you have a code.** An account (owner or admin) gets the
portal and the offers it is allowed. A code gets one offer's board and nothing else.

| Who | Goes to | Enters | Sees |
|---|---|---|---|
| Owner | `portal.inevitableacq.com` | email + password | the whole portal, every offer, Team & Access |
| Admin | `portal.inevitableacq.com` | email + password | the sections and offers the owner ticked |
| Rep | `portal.inevitableacq.com/sales-team` | the offer's code | that offer's board only |

## Addresses

| Address | What it is |
|---|---|
| `/` | the portal: total revenue generated, Signal List, and one card per section |
| `/metrics/<offer>` | Metrics Tracking for that offer: VSL or Webinar, week by week |
| `/projections` | Funnel Revenue Projections: a VSL or Webinar calculator from ad spend to profit |
| `/signal-list` | your own Signal List, one page per day (private) |
| `/team-access` | owner only: invite admins, choose their sections and offers |
| `/sales-dashboard` | Sales Team Boards: agency summary and offer cards |
| `/sales-dashboard/<offer>` | one offer's board, e.g. `/sales-dashboard/alex` |
| `/sales-team` | where reps enter their code |
| `/board/<id>` | old links; forwarded to the new address |

An offer's address follows its name. The server picks it so no two offers share one (a
second "Alex" becomes `alex-2`), and every earlier address is remembered in
`boards.directory.oldSlugs`, so links sent before a rename keep working. Addresses only
point at an offer; calls are tied to the offer's id, so renaming never touches data.

Every board has the same tabs: Dashboard, Post Call Form, Data, Rep Hub, and Add Team (owner
and admins only). The offer's name is set at the top of Add Team. Offers differ only by name and data — one board, rendered per offer.

## Where things live

```
index.html        every screen: sign-in, code page, portal, sales boards, board
config.js         Supabase address and publishable key (both public by design)
db.js             every read and write to Supabase
boot.js           decides which screen each person gets
portal.js         the portal page: greeting, total revenue, Signal List, section cards
hub.js            Sales Team Boards: agency summary, offer cards, new offer
access.js         Team & Access: invite admins, sections and offers for each
metrics-model.js  Metrics Tracking: starting metric lists, and how every metric is worked out
metrics.js        Metrics Tracking page: cards, funnel, charts, daily tables, editing
projections.js    Funnel Revenue Projections: both funnel models, cascading boxes, industry standards
signal.js         Signal List: daily page, carry-over to tomorrow, defaults
clock.js          the portal clock: search, chosen places, kept on the account
clock-cities.js   cities you can search for, mapped to their time zone
app.js            dashboard metrics, charts, filters, undo
form.js           Post Call Form
datatab.js        Data tab
team.js           Add Team: offer name, team with roles and commission, login page, code
rephub.js         Rep Hub: onboarding, standards, assets and SOPs, as a template
transcriber.js    Audio Transcriber tab: drop a call recording, copy it with the handoff form
profile.js        the name, role and photo at the top right, and the rep name picker
data.js           outcomes, funnels, commission rates
api/enter.js      team code -> that offer's team account
api/boards.js     create an offer, make a new code, archive, offer addresses
api/people.js     invite admins, change their offers, remove them
api/transcribe.js one-time upload address, then Groq transcription; the recording is deleted after
api/profile.js    save or remove your own profile picture (Storage bucket "avatars")
supabase/schema.sql   tables and access rules
supabase/rep-hub.sql  the shared Rep Hub template table
supabase/access.sql   admin sections and offers, and the access rules that use them
supabase/metrics.sql  metric lists and typed-in numbers per offer and funnel
supabase/signal.sql   Signal List days and defaults, private to each person
```

## Metrics Tracking

One board per offer, with a VSL / Webinar switch and weeks from Monday to Sunday. Every metric is
one of three kinds:

- **Typed in** each day (ad spend, clicks, attendees…), saved in `metric_entries`.
- **From the sales board**: read live from that offer's calls logged under the same funnel, using
  the day a call was held and the day money came in. Nothing is copied.
- **Calculated**: one metric divided by another (cost per lead, show rate, ROAS), ×100 for percents.

Week values add up typed counts and money, average typed rates and scores, and divide the week's
totals for calculated metrics. Each metric can have a target and a direction (higher or lower is
better). **Edit metrics** lets anyone with access rename, add, remove and reorder metrics and
groups, and set the funnel stages; each offer keeps its own copy in `metric_settings`. The
starting lists live in `metrics-model.js`.

## Funnel Revenue Projections

A what-if calculator for VSL or Webinar, not tied to any offer or its data. Numbers are
remembered in the browser. Everything is worked out from a few inputs (ad spend,
cost per click, each stage's rate, AOV). Editing a rate moves every count after it; editing a
count works the rate beside it out backwards. Counts of people are rounded up. The industry
standard under a rate turns green when the rate beats it, and is changed by clicking it. VSL
profit, ROAS and earnings use Cash Collected; Webinar uses Total Revenue. The example numbers
and standards live in `projections.js`.

## Signal List

The owner's own daily page; it is never offered to admins. Beside the day, always in view, are **Daily calls** (title, time, Meet link with a Join button; the next call is highlighted) and a **Daily brain dump** that starts blank each day. The page follows the portal clock's main time zone for what counts as today and for call times. A month calendar at the top shows every
day written (green: all signal actions done, amber: some, grey: started); click any day to open
everything written that day. Quotes are edited right at the top. Each day has the morning
checklist, what broke your speed yesterday, the focus line, goals and limiting factors, highest
signal actions (with why), sub-priority tasks for after the signals, a 30-minute schedule,
evening reflection and journal. Everything saves as you type. **Plan tomorrow** carries goals over,
resets the checklist, and turns today's reflection into tomorrow's watch list. **Customize** sets
the focus line, checklist, questions and day length.

## Audio Transcriber

A tab on every sales board for handoffs. A setter drops a call recording (MP3, M4A, WAV, up to
25 MB); the browser uploads it to a private Storage bucket (`call-audio`) through a one-time
address, the server sends it to Groq (Whisper Large v3) and returns the text in paragraphs, and
the recording is deleted straight away whether it worked or not. The Groq key lives only in
Vercel as `GROQ_API_KEY`. The owner can paste a Loom at the top of the tab; it shows on every
offer. Groq's free plan allows about 8 hours of audio a day.

Below the transcriber sits the **handoff form**. Everyone sees it and can copy it; **Copy for
Claude** copies an instruction, the form and the transcript in one paste. Only the owner edits
it, choosing **All offers** (saved in `rep_hub` content as `handoffForm`) or **This offer only**
(saved on the offer in `directory.repHub['handoff-form']`, which wins over the shared form).

## Team & Access

The owner invites admins from **Team & Access** and ticks, for each one, the **sections** they
can use (Sales Team Boards, Metrics Tracking, Funnel Revenue Projections, Weekly Content Hub,
Signal List) and the **offers** they see inside per-offer sections — every offer, or chosen ones.
Inside a section they have, an admin can view and edit. Only the owner invites, changes access,
creates and archives offers. Reps are unaffected: a code opens one sales board.

The rules live in the database (`supabase/access.sql`): calls are readable with the sales boards
or metrics, and writable by the offer's reps or whoever has its sales board.

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
in the period. They live as `CLOSER_RATE` / `SETTER_RATE` in `data.js` and are what a new
person starts on. Each person's own rate is edited on Add Team.

On Add Team each person is a **Closer**, a **Setter** or **Full cycle**. Full cycle is stored
as the same name in both roles, so they appear in both Post Call Form dropdowns and have a
closing rate and a setting rate, each applied to the deals where they played that part.

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

### Dates

The form asks for the Call Date and an optional **Date Booked**. Left empty, booked is the
same day as the call. Calls logged before Date Booked existed have both on the call date.

## Data tab

Lists every row logged through the form, newest first, filterable by period and outcome.
A call belongs to a period if it happened in it or money from it landed in it.

**Export CSV** downloads exactly the rows on screen: every form field, the payments, and
each row's closer and setter commission at their current rates, using cash that landed
inside the chosen period — the same figures as Commission Tracking. Cells that a
spreadsheet would run as a formula are made plain text. The
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

## Rep Hub

A template shown on every board. Each row is either **All offers** (filled in once, stored in
the `rep_hub` table) or **This offer only** (stored on the offer, in `boards.directory.repHub`).

- The owner edits everything: values, labels, row types, which rows are shared, sections.
- An offer's admins fill in that offer's "This offer only" rows.
- Reps read and click. Empty rows, and headings with nothing under them, are hidden from reps.

Loom and YouTube links play inside the page; anything else opens in a new tab.
