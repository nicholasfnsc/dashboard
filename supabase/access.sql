-- ============================================================
--  Team & Access — what each admin can use
--
--  Run once: Supabase → SQL Editor → New query → paste → Run.
--  Safe to run again; nothing here deletes data.
--
--  An admin is given two things by the owner:
--    sections    which parts of the portal they can open:
--                sales, metrics, funnel, content, signal
--    offers      which offers they see inside the sections that are
--                per offer — every offer ("all_offers"), or the ones
--                listed in memberships.
--
--  Inside a section they are given, an admin can view and edit.
--  Only the owner invites admins, changes access, creates and archives
--  offers. Reps are untouched: a code still opens one sales board.
-- ============================================================

create table if not exists public.admin_access (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  sections    text[] not null default '{}',
  all_offers  boolean not null default false,
  updated_at  timestamptz not null default now()
);

alter table public.admin_access enable row level security;

-- Each admin reads their own access; the owner reads everyone's.
-- Changes are made by the owner through the server only.
drop policy if exists admin_access_read on public.admin_access;
create policy admin_access_read on public.admin_access
  for select to authenticated
  using (user_id = auth.uid() or public.is_owner());


-- ------------------------------------------------------------
--  Admins invited before this existed keep exactly what they had:
--  the sales boards, for the offers they were given.
-- ------------------------------------------------------------
insert into public.admin_access (user_id, sections, all_offers)
select distinct m.user_id, array['sales'], false
  from public.memberships m
 where m.role = 'admin'
on conflict (user_id) do nothing;


-- ============================================================
--  Questions every rule asks
-- ============================================================

-- Can the person signed in open this section of the portal?
create or replace function public.has_section(s text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_owner()
      or exists (select 1 from public.admin_access
                 where user_id = auth.uid() and s = any (sections));
$$;

-- Is this offer one of theirs?
create or replace function public.offer_allowed(b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_owner()
      or exists (select 1 from public.admin_access where user_id = auth.uid() and all_offers)
      or exists (select 1 from public.memberships
                 where user_id = auth.uid() and board_id = b and role = 'admin');
$$;

-- Is this the offer's own team login (a rep)?
create or replace function public.is_rep_of(b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.memberships
                 where user_id = auth.uid() and board_id = b and role = 'rep');
$$;

-- See an offer and its calls: the owner; its reps; an admin with the
-- offer and either the sales boards or metrics (metrics reads calls).
create or replace function public.can_see_board(b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_owner()
      or public.is_rep_of(b)
      or (public.offer_allowed(b) and (public.has_section('sales') or public.has_section('metrics')));
$$;

-- Run an offer's sales board (name, team, code, Rep Hub values):
-- the owner, or an admin with the offer and the sales boards.
create or replace function public.can_manage_board(b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_owner()
      or (public.offer_allowed(b) and public.has_section('sales'));
$$;

-- Log, edit and delete calls: its reps, and whoever runs its sales board.
create or replace function public.can_log_calls(b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_rep_of(b) or public.can_manage_board(b);
$$;

drop policy if exists calls_insert on public.calls;
create policy calls_insert on public.calls
  for insert to authenticated
  with check (public.can_log_calls(board_id));

drop policy if exists calls_update on public.calls;
create policy calls_update on public.calls
  for update to authenticated
  using (public.can_log_calls(board_id))
  with check (public.can_log_calls(board_id));

drop policy if exists calls_delete on public.calls;
create policy calls_delete on public.calls
  for delete to authenticated
  using (public.can_log_calls(board_id));
