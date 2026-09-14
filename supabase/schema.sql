-- ============================================================
--  Inevitable Acquisition Portal — database
--
--  Run once: Supabase → SQL Editor → New query → paste → Run.
--  Safe to run again; nothing here deletes data.
--  Then run rep-hub.sql and access.sql (in that order) — access.sql
--  sets the final access rules, so run it again after this file.
--
--  The whole model:
--    You either have an account or you have a code.
--    An account (owner or admin) sees the hub and the offers it is
--    allowed. A code signs a rep into one offer's team account and
--    nothing else.
--
--  Every rule below is enforced by the database itself, so a request
--  for data a person may not see comes back empty — whether it comes
--  from the site, a browser console, or anywhere else.
-- ============================================================

create extension if not exists pgcrypto;


-- ------------------------------------------------------------
--  People
--  One row per sign-in. 'person' is you or an admin; 'team' is an
--  offer's shared account, whose password is that offer's code.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  is_owner    boolean not null default false,
  kind        text not null default 'person' check (kind in ('person', 'team')),
  created_at  timestamptz not null default now()
);


-- ------------------------------------------------------------
--  Offers
--  The name is edited on the Onboarding tab and shown everywhere
--  else. Offers are archived, never deleted, so no call is ever lost.
-- ------------------------------------------------------------
create table if not exists public.boards (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default 'Untitled offer',
  directory     jsonb not null default '{}'::jsonb,
  team_user_id  uuid references auth.users (id) on delete set null,
  archived_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- Kept apart from boards so a rep can read their offer without ever
-- being able to read its code.
create table if not exists public.board_codes (
  board_id    uuid primary key references public.boards (id) on delete cascade,
  code        text not null unique,
  rotated_at  timestamptz not null default now()
);


-- ------------------------------------------------------------
--  Who can reach which offer
--  admin: a person managing that offer
--  rep:   the offer's team account
--  The owner needs no rows here — the owner reaches everything.
-- ------------------------------------------------------------
create table if not exists public.memberships (
  user_id     uuid not null references auth.users (id) on delete cascade,
  board_id    uuid not null references public.boards (id) on delete cascade,
  role        text not null check (role in ('admin', 'rep')),
  created_at  timestamptz not null default now(),
  primary key (user_id, board_id)
);


-- ------------------------------------------------------------
--  Closers and setters, per offer
--  Removing someone switches them off rather than deleting them, so
--  their history and commission still add up.
-- ------------------------------------------------------------
create table if not exists public.roster (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.boards (id) on delete restrict,
  name        text not null,
  role        text not null check (role in ('closer', 'setter')),
  rate        numeric not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (board_id, name, role)
);


-- ------------------------------------------------------------
--  Every Post Call Form submission
--  `data` is the whole form exactly as the app builds it. The columns
--  beside it are copies for sorting and filtering.
--  'restrict' means an offer holding calls cannot be deleted at all.
-- ------------------------------------------------------------
create table if not exists public.calls (
  id          text primary key,
  board_id    uuid not null references public.boards (id) on delete restrict,
  call_date   date,
  outcome     text,
  logged_by   text,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists calls_board_date_idx on public.calls (board_id, call_date);
create index if not exists roster_board_idx     on public.roster (board_id);


-- ============================================================
--  Questions every rule asks
-- ============================================================
create or replace function public.is_owner()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_owner);
$$;

create or replace function public.can_see_board(b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_owner()
      or exists (select 1 from public.memberships where user_id = auth.uid() and board_id = b);
$$;

create or replace function public.can_manage_board(b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_owner()
      or exists (select 1 from public.memberships
                 where user_id = auth.uid() and board_id = b and role = 'admin');
$$;


-- ============================================================
--  Every new sign-in gets a profile automatically
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists calls_touch on public.calls;
create trigger calls_touch before update on public.calls
  for each row execute function public.touch_updated_at();


-- ============================================================
--  You
--  Sign-ups are switched off, so the only account that exists right
--  now is the one you created. It becomes the owner. This only acts
--  while no owner exists, so running this file again changes nothing.
-- ============================================================
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

update public.profiles
   set is_owner = true
 where kind = 'person'
   and not exists (select 1 from public.profiles where is_owner);


-- ============================================================
--  Access rules
--  No rule grants anything to a visitor who is not signed in.
--  Creating offers, rotating codes and inviting admins run on the
--  server with the secret key, so they need no rule here.
-- ============================================================
alter table public.profiles    enable row level security;
alter table public.boards      enable row level security;
alter table public.board_codes enable row level security;
alter table public.memberships enable row level security;
alter table public.roster      enable row level security;
alter table public.calls       enable row level security;

-- profiles: yourself; the owner sees everyone
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_owner());

-- boards: see the offers you belong to; managers rename and edit the directory
drop policy if exists boards_read on public.boards;
create policy boards_read on public.boards
  for select to authenticated
  using (public.can_see_board(id));

drop policy if exists boards_update on public.boards;
create policy boards_update on public.boards
  for update to authenticated
  using (public.can_manage_board(id))
  with check (public.can_manage_board(id));

-- codes: only the owner and that offer's admins
drop policy if exists codes_read on public.board_codes;
create policy codes_read on public.board_codes
  for select to authenticated
  using (public.can_manage_board(board_id));

-- memberships: your own, plus those on offers you manage
drop policy if exists memberships_read on public.memberships;
create policy memberships_read on public.memberships
  for select to authenticated
  using (user_id = auth.uid() or public.can_manage_board(board_id));

-- roster: everyone on the offer reads it; managers change it
drop policy if exists roster_read on public.roster;
create policy roster_read on public.roster
  for select to authenticated
  using (public.can_see_board(board_id));

drop policy if exists roster_insert on public.roster;
create policy roster_insert on public.roster
  for insert to authenticated
  with check (public.can_manage_board(board_id));

drop policy if exists roster_update on public.roster;
create policy roster_update on public.roster
  for update to authenticated
  using (public.can_manage_board(board_id))
  with check (public.can_manage_board(board_id));

-- calls: everyone on the offer logs, reads, edits
drop policy if exists calls_read on public.calls;
create policy calls_read on public.calls
  for select to authenticated
  using (public.can_see_board(board_id));

drop policy if exists calls_insert on public.calls;
create policy calls_insert on public.calls
  for insert to authenticated
  with check (public.can_see_board(board_id));

drop policy if exists calls_update on public.calls;
create policy calls_update on public.calls
  for update to authenticated
  using (public.can_see_board(board_id))
  with check (public.can_see_board(board_id));

drop policy if exists calls_delete on public.calls;
create policy calls_delete on public.calls
  for delete to authenticated
  using (public.can_see_board(board_id));
