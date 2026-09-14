-- ============================================================
--  Signal List
--
--  Run once: Supabase → SQL Editor → New query → paste → Run.
--  Safe to run again; nothing here deletes data.
--  Needs access.sql to have been run first.
--
--  Private to each person: a Signal List can only ever be read or
--  changed by the person it belongs to — not by admins, not by the
--  owner. You need Signal List access to use it at all.
--
--    signal_days       one row per person per day
--    signal_settings   each person's defaults for new days
-- ============================================================

create table if not exists public.signal_days (
  user_id     uuid not null references auth.users (id) on delete cascade,
  day         date not null,
  content     jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, day)
);

create table if not exists public.signal_settings (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  template    jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.signal_days     enable row level security;
alter table public.signal_settings enable row level security;

drop policy if exists signal_days_own on public.signal_days;
create policy signal_days_own on public.signal_days
  for all to authenticated
  using (user_id = auth.uid() and public.has_section('signal'))
  with check (user_id = auth.uid() and public.has_section('signal'));

drop policy if exists signal_settings_own on public.signal_settings;
create policy signal_settings_own on public.signal_settings
  for all to authenticated
  using (user_id = auth.uid() and public.has_section('signal'))
  with check (user_id = auth.uid() and public.has_section('signal'));
