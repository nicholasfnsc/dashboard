-- ============================================================
--  Metrics Tracking
--
--  Run once: Supabase → SQL Editor → New query → paste → Run.
--  Safe to run again; nothing here deletes data.
--  Needs access.sql to have been run first.
--
--  Two tables, both per offer and per funnel (vsl or webinar):
--    metric_settings   the metric list: groups, names, how each one is
--                      worked out, its target, and the funnel stages
--    metric_entries    the numbers typed in, one per metric per day
--
--  Numbers that come from the sales board (calls, cash, close rate…)
--  are never stored here — they are read live from the calls.
--
--  Who can use it: the owner, and admins given Metrics Tracking for
--  that offer. Inside it they can view and edit. Reps never can.
-- ============================================================

create or replace function public.can_use_metrics(b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_owner()
      or (public.offer_allowed(b) and public.has_section('metrics'));
$$;

create table if not exists public.metric_settings (
  board_id    uuid not null references public.boards (id) on delete restrict,
  funnel      text not null check (funnel in ('vsl', 'webinar')),
  config      jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (board_id, funnel)
);

create table if not exists public.metric_entries (
  board_id    uuid not null references public.boards (id) on delete restrict,
  funnel      text not null check (funnel in ('vsl', 'webinar')),
  metric_id   text not null,
  day         date not null,
  value       numeric not null,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  primary key (board_id, funnel, metric_id, day)
);

create index if not exists metric_entries_board_day_idx on public.metric_entries (board_id, funnel, day);

alter table public.metric_settings enable row level security;
alter table public.metric_entries  enable row level security;

drop policy if exists metric_settings_read on public.metric_settings;
create policy metric_settings_read on public.metric_settings
  for select to authenticated using (public.can_use_metrics(board_id));

drop policy if exists metric_settings_insert on public.metric_settings;
create policy metric_settings_insert on public.metric_settings
  for insert to authenticated with check (public.can_use_metrics(board_id));

drop policy if exists metric_settings_update on public.metric_settings;
create policy metric_settings_update on public.metric_settings
  for update to authenticated
  using (public.can_use_metrics(board_id)) with check (public.can_use_metrics(board_id));

drop policy if exists metric_entries_read on public.metric_entries;
create policy metric_entries_read on public.metric_entries
  for select to authenticated using (public.can_use_metrics(board_id));

drop policy if exists metric_entries_insert on public.metric_entries;
create policy metric_entries_insert on public.metric_entries
  for insert to authenticated with check (public.can_use_metrics(board_id));

drop policy if exists metric_entries_update on public.metric_entries;
create policy metric_entries_update on public.metric_entries
  for update to authenticated
  using (public.can_use_metrics(board_id)) with check (public.can_use_metrics(board_id));

-- Clearing a typed-in number removes that one entry.
drop policy if exists metric_entries_delete on public.metric_entries;
create policy metric_entries_delete on public.metric_entries
  for delete to authenticated using (public.can_use_metrics(board_id));
