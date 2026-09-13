-- ============================================================
--  IA Dashboard — database schema
--  Run this once in the Supabase SQL Editor.
--  See README.md → "Backend setup" for the steps around it.
-- ============================================================

-- ---------- who is who ----------
-- Every signed-in account gets a row here. 'owner' is you; 'team' is the
-- shared sales account. Roles are what the policies below check, so this
-- is the one table that decides who may change the roster or the key.
create table if not exists public.profiles (
  id   uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'team' check (role in ('owner', 'team'))
);

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- ---------- the call log ----------
-- `data` holds the whole Post Call Form record exactly as the app builds
-- it. The columns beside it are copies pulled out for filtering and
-- sorting, so queries stay fast without the app having to care.
create table if not exists public.calls (
  id          text primary key,
  call_date   date not null,
  booked_date date,
  outcome     text not null,
  funnel      text,
  closer      text,
  setter      text,
  data        jsonb not null,
  logged_by   uuid references auth.users (id) on delete set null,
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

-- ============================================================
--  Row Level Security
--  Nothing is readable without a signed-in session. Everyone who is
--  signed in sees the same board; only the owner changes the roster
--  and settings.
-- ============================================================
alter table public.profiles enable row level security;
alter table public.calls    enable row level security;
alter table public.team     enable row level security;
alter table public.settings enable row level security;

-- profiles: you can read your own row
drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self on public.profiles
  for select to authenticated using (id = auth.uid());

-- calls: any signed-in person may read and log; that is the whole point
drop policy if exists calls_read on public.calls;
create policy calls_read on public.calls
  for select to authenticated using (true);

drop policy if exists calls_insert on public.calls;
create policy calls_insert on public.calls
  for insert to authenticated with check (true);

drop policy if exists calls_update on public.calls;
create policy calls_update on public.calls
  for update to authenticated using (true) with check (true);

drop policy if exists calls_delete on public.calls;
create policy calls_delete on public.calls
  for delete to authenticated using (true);

-- team: everyone reads, owner writes
drop policy if exists team_read on public.team;
create policy team_read on public.team
  for select to authenticated using (true);

drop policy if exists team_write on public.team;
create policy team_write on public.team
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- settings: everyone reads, owner writes
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings
  for select to authenticated using (true);

drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

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
