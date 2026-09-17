-- ============================================================
--  Rep Hub — the shared template
--
--  Run once: Supabase → SQL Editor → New query → paste → Run.
--  Safe to run again.
--
--  One row holds the Rep Hub template that every offer shares: its
--  sections, its rows, and the values of rows marked "All offers".
--  Values marked "This offer only" are stored on each offer instead.
--
--  Everyone signed in can read it — reps need it to see the hub.
--  It shows on every offer, so it is changed by the owner and by admins
--  who have the sales boards and every offer. An admin with only some
--  offers fills in those offers' own rows, which live on each offer.
-- ============================================================

create table if not exists public.rep_hub (
  id          int primary key default 1 check (id = 1),
  content     jsonb,
  updated_at  timestamptz not null default now()
);

insert into public.rep_hub (id) values (1) on conflict (id) do nothing;

alter table public.rep_hub enable row level security;

drop policy if exists rep_hub_read on public.rep_hub;
create policy rep_hub_read on public.rep_hub
  for select to authenticated
  using (true);

-- Someone whose offers are all of them: the owner, or an admin ticked
-- "Every offer" in Team & Access.
create or replace function public.has_every_offer()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_owner()
      or exists (select 1 from public.admin_access
                 where user_id = auth.uid() and all_offers);
$$;

drop policy if exists rep_hub_update on public.rep_hub;
create policy rep_hub_update on public.rep_hub
  for update to authenticated
  using (public.is_owner() or (public.has_section('sales') and public.has_every_offer()))
  with check (public.is_owner() or (public.has_section('sales') and public.has_every_offer()));

drop policy if exists rep_hub_insert on public.rep_hub;
create policy rep_hub_insert on public.rep_hub
  for insert to authenticated
  with check (public.is_owner() or (public.has_section('sales') and public.has_every_offer()));
