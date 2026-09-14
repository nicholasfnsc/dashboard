-- ============================================================
--  Funnel Revenue Projections
--
--  Run once: Supabase → SQL Editor → New query → paste → Run.
--  Safe to run again; nothing here deletes data.
--  Needs access.sql to have been run first.
--
--  One saved model per offer and funnel (vsl or webinar): the numbers
--  typed in and the industry standards shown beside them.
--
--  Who can use it: the owner, and admins given Funnel Revenue
--  Projections for that offer. Reps never can.
-- ============================================================

create or replace function public.can_use_projections(b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_owner()
      or (public.offer_allowed(b) and public.has_section('funnel'));
$$;

-- Someone with only Funnel Revenue Projections still needs to see the
-- offer's name to pick it. This lets them list offers without being
-- able to read any calls.
create or replace function public.can_list_board(b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.can_see_board(b) or public.can_use_projections(b);
$$;

drop policy if exists boards_read on public.boards;
create policy boards_read on public.boards
  for select to authenticated
  using (public.can_list_board(id));

create table if not exists public.funnel_projections (
  board_id    uuid not null references public.boards (id) on delete restrict,
  funnel      text not null check (funnel in ('vsl', 'webinar')),
  model       jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (board_id, funnel)
);

alter table public.funnel_projections enable row level security;

drop policy if exists funnel_projections_read on public.funnel_projections;
create policy funnel_projections_read on public.funnel_projections
  for select to authenticated using (public.can_use_projections(board_id));

drop policy if exists funnel_projections_insert on public.funnel_projections;
create policy funnel_projections_insert on public.funnel_projections
  for insert to authenticated with check (public.can_use_projections(board_id));

drop policy if exists funnel_projections_update on public.funnel_projections;
create policy funnel_projections_update on public.funnel_projections
  for update to authenticated
  using (public.can_use_projections(board_id)) with check (public.can_use_projections(board_id));
