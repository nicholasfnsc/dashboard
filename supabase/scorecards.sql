-- ============================================================
--  Rep Daily Numbers — the scorecard every rep fills in daily
--
--  Run once: Supabase → SQL Editor → New query → paste → Run.
--  Safe to run again.
--
--  Two tables, because two different people write them:
--
--    scorecard_settings  the metric list, the daily KPI and the
--                        weekly and monthly targets — the owner's,
--                        and an admin's who has the offer
--
--    scorecard_numbers   one row per week, holding what each rep
--                        typed on each day — the reps' own, so they
--                        can fill it in every morning
--
--  Everyone who can see the board reads both: the numbers are meant
--  to be seen. A rep can never change a target, and the database is
--  what stops them, not the page.
-- ============================================================

create table if not exists public.scorecard_settings (
  board_id    uuid primary key references public.boards(id) on delete cascade,
  content     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.scorecard_numbers (
  board_id    uuid not null references public.boards(id) on delete cascade,
  week        date not null,                       -- the Monday the week starts on
  content     jsonb not null default '{}'::jsonb,  -- { rep: { metric: { day: value } } }
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (board_id, week)
);

create index if not exists scorecard_numbers_week_idx on public.scorecard_numbers (board_id, week desc);

alter table public.scorecard_settings enable row level security;
alter table public.scorecard_numbers enable row level security;

-- ---------- the targets: read by everyone, written by whoever runs the board ----------
drop policy if exists scorecard_settings_read on public.scorecard_settings;
create policy scorecard_settings_read on public.scorecard_settings
  for select to authenticated
  using (public.can_see_board(board_id));

drop policy if exists scorecard_settings_insert on public.scorecard_settings;
create policy scorecard_settings_insert on public.scorecard_settings
  for insert to authenticated
  with check (public.can_manage_board(board_id));

drop policy if exists scorecard_settings_update on public.scorecard_settings;
create policy scorecard_settings_update on public.scorecard_settings
  for update to authenticated
  using (public.can_manage_board(board_id))
  with check (public.can_manage_board(board_id));

-- ---------- the numbers: read by everyone, written by the reps too ----------
drop policy if exists scorecard_numbers_read on public.scorecard_numbers;
create policy scorecard_numbers_read on public.scorecard_numbers
  for select to authenticated
  using (public.can_see_board(board_id));

drop policy if exists scorecard_numbers_insert on public.scorecard_numbers;
create policy scorecard_numbers_insert on public.scorecard_numbers
  for insert to authenticated
  with check (public.can_log_calls(board_id));

drop policy if exists scorecard_numbers_update on public.scorecard_numbers;
create policy scorecard_numbers_update on public.scorecard_numbers
  for update to authenticated
  using (public.can_log_calls(board_id))
  with check (public.can_log_calls(board_id));
