-- ============================================================
--  Daily Huddles — the morning run-through, one page per offer
--
--  Run once: Supabase → SQL Editor → New query → paste → Run.
--  Safe to run again.
--
--  One row per offer holding the whole huddle: the meeting, who filled
--  in their post-call forms, the marketing debrief day by day, the two
--  bottleneck spot-checks, the pipeline and who is due to close.
--
--  Everyone who can see the offer's board can read it — the reps are
--  looking at it while it is filled in. Only whoever runs that board
--  (the owner, or an admin with the offer) can write.
-- ============================================================

create table if not exists public.huddles (
  board_id    uuid primary key references public.boards(id) on delete cascade,
  content     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

alter table public.huddles enable row level security;

drop policy if exists huddles_read on public.huddles;
create policy huddles_read on public.huddles
  for select to authenticated
  using (public.can_see_board(board_id));

drop policy if exists huddles_insert on public.huddles;
create policy huddles_insert on public.huddles
  for insert to authenticated
  with check (public.can_manage_board(board_id));

drop policy if exists huddles_update on public.huddles;
create policy huddles_update on public.huddles
  for update to authenticated
  using (public.can_manage_board(board_id))
  with check (public.can_manage_board(board_id));
