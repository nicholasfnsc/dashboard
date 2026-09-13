-- ============================================================
--  IA Dashboard — shared storage
--
--  OPTIONAL. Only needed when you want your team's calls to reach
--  your dashboard instead of staying on their own machine.
--
--  Run this once: Supabase → SQL Editor → paste → Run.
--  Then paste your project URL and anon key into config.js.
--
--  Who may open the board is decided before any of this, by
--  middleware.js on Vercel. Everyone who gets through that door is
--  someone you gave the password to, so the tables below simply
--  serve them.
-- ============================================================

-- ---------- the call log ----------
-- `data` holds the whole Post Call Form record exactly as the app
-- builds it. The columns beside it are copies pulled out for filtering
-- and sorting, so queries stay fast without the app having to care.
create table if not exists public.calls (
  id          text primary key,
  call_date   date not null,
  booked_date date,
  outcome     text not null,
  funnel      text,
  closer      text,
  setter      text,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists calls_call_date_idx on public.calls (call_date);
create index if not exists calls_outcome_idx   on public.calls (outcome);

-- ---------- the roster ----------
create table if not exists public.team (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text not null check (role in ('closer', 'setter')),
  rate       numeric not null,
  created_at timestamptz not null default now(),
  unique (name, role)
);

-- ---------- small shared settings (team login URL, etc.) ----------
create table if not exists public.settings (
  key   text primary key,
  value jsonb
);

-- ---------- access ----------
alter table public.calls    enable row level security;
alter table public.team     enable row level security;
alter table public.settings enable row level security;

drop policy if exists calls_all on public.calls;
create policy calls_all on public.calls
  for all to anon, authenticated using (true) with check (true);

drop policy if exists team_all on public.team;
create policy team_all on public.team
  for all to anon, authenticated using (true) with check (true);

drop policy if exists settings_all on public.settings;
create policy settings_all on public.settings
  for all to anon, authenticated using (true) with check (true);

-- ---------- keep updated_at honest ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists calls_touch on public.calls;
create trigger calls_touch before update on public.calls
  for each row execute function public.touch_updated_at();

-- ---------- live updates ----------
-- Lets every open board refresh itself the moment anyone logs a call.
alter publication supabase_realtime add table public.calls;
alter publication supabase_realtime add table public.team;
