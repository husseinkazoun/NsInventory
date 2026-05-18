-- =====================================================================
-- 0001_initial.sql — Sanad Inventory initial schema (Commit 2)
-- =====================================================================
-- Tables   : organizations, profiles, organization_members,
--            categories, units, lab_assets, activity_log
-- Enums    : org_role, asset_status, asset_condition, activity_action
-- Helper   : is_org_member(org uuid)
-- RLS      : enabled on every table; gated by organization membership.
--
-- NOTE — activity_log is created in this commit but no code writes to it
--        yet. It will start being populated when Commit 3 brings in scan
--        sessions and event triggers.
-- =====================================================================

-- ── Extensions ────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Enums ─────────────────────────────────────────────────────────────
do $$ begin
  create type public.org_role as enum ('owner', 'admin', 'member', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.asset_status as enum ('active', 'maintenance', 'inactive', 'disposed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.asset_condition as enum ('excellent', 'good', 'fair', 'poor', 'broken');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.activity_action as enum (
    'created', 'updated', 'deleted', 'assigned',
    'scanned', 'condition_changed', 'maintenance'
  );
exception when duplicate_object then null; end $$;

-- ── organizations ─────────────────────────────────────────────────────
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ── profiles ──────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- ── organization_members ──────────────────────────────────────────────
create table if not exists public.organization_members (
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  user_id          uuid not null references public.profiles(id)      on delete cascade,
  role             public.org_role not null default 'member',
  created_at       timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index if not exists organization_members_user_idx
  on public.organization_members(user_id);

-- ── categories ────────────────────────────────────────────────────────
create table if not exists public.categories (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  slug             text not null,
  created_at       timestamptz not null default now(),
  unique (organization_id, slug)
);
create index if not exists categories_org_idx on public.categories(organization_id);

-- ── units ─────────────────────────────────────────────────────────────
create table if not exists public.units (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  short_code       text not null,
  created_at       timestamptz not null default now(),
  unique (organization_id, short_code)
);
create index if not exists units_org_idx on public.units(organization_id);

-- ── lab_assets ────────────────────────────────────────────────────────
-- assigned_to FK is explicitly named so the Supabase embedded-select syntax
-- `profiles!lab_assets_assigned_to_fkey(...)` is deterministic.
create table if not exists public.lab_assets (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  tag                text not null,
  name               text not null,
  manufacturer       text,
  model              text,
  serial             text,
  location           text,
  category_id        uuid references public.categories(id) on delete set null,
  unit_id            uuid references public.units(id) on delete set null,
  assigned_to        uuid,
  status             public.asset_status    not null default 'active',
  condition          public.asset_condition not null default 'good',
  last_maintenance   date,
  next_maintenance   date,
  warranty_expiry    date,
  created_by         uuid references public.profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint lab_assets_assigned_to_fkey
    foreign key (assigned_to) references public.profiles(id) on delete set null,
  unique (organization_id, tag)
);
create index if not exists lab_assets_org_idx
  on public.lab_assets(organization_id);
create index if not exists lab_assets_status_idx
  on public.lab_assets(organization_id, status);
create index if not exists lab_assets_assigned_idx
  on public.lab_assets(assigned_to);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists lab_assets_set_updated_at on public.lab_assets;
create trigger lab_assets_set_updated_at
  before update on public.lab_assets
  for each row execute function public.set_updated_at();

-- ── activity_log (schema-only this commit) ────────────────────────────
create table if not exists public.activity_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type     text not null,
  entity_id       uuid not null,
  action          public.activity_action not null,
  description     text,
  meta            jsonb,
  performed_by    uuid references public.profiles(id),
  performed_at    timestamptz not null default now()
);
create index if not exists activity_log_entity_idx
  on public.activity_log(entity_type, entity_id);
create index if not exists activity_log_org_perf_idx
  on public.activity_log(organization_id, performed_at desc);

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.organizations         enable row level security;
alter table public.profiles              enable row level security;
alter table public.organization_members  enable row level security;
alter table public.categories            enable row level security;
alter table public.units                 enable row level security;
alter table public.lab_assets            enable row level security;
alter table public.activity_log          enable row level security;

-- Helper: is the calling user a member of <org>?
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1
    from public.organization_members om
    where om.organization_id = org
      and om.user_id = auth.uid()
  );
$$;

-- ── organizations ──
drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

-- ── profiles ──
-- A user can always read their own profile.
-- They can also read any other profile in any organization they share with
-- that user (so assignee names appear in lab_assets queries).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    auth.uid() = id
    or exists (
      select 1
      from public.organization_members me
      join public.organization_members them
        on them.organization_id = me.organization_id
      where me.user_id   = auth.uid()
        and them.user_id = public.profiles.id
    )
  );

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (auth.uid() = id);

-- ── organization_members ──
drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select on public.organization_members
  for select to authenticated
  using (public.is_org_member(organization_id));

-- ── categories ──
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories
  for update to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories
  for delete to authenticated
  using (public.is_org_member(organization_id));

-- ── units ──
drop policy if exists units_select on public.units;
create policy units_select on public.units
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists units_insert on public.units;
create policy units_insert on public.units
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists units_update on public.units;
create policy units_update on public.units
  for update to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists units_delete on public.units;
create policy units_delete on public.units
  for delete to authenticated
  using (public.is_org_member(organization_id));

-- ── lab_assets ──
drop policy if exists lab_assets_select on public.lab_assets;
create policy lab_assets_select on public.lab_assets
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists lab_assets_insert on public.lab_assets;
create policy lab_assets_insert on public.lab_assets
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists lab_assets_update on public.lab_assets;
create policy lab_assets_update on public.lab_assets
  for update to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists lab_assets_delete on public.lab_assets;
create policy lab_assets_delete on public.lab_assets
  for delete to authenticated
  using (public.is_org_member(organization_id));

-- ── activity_log ──
-- Read-only for members in Commit 2. Inserts come from the service role until
-- Commit 3 introduces app-side writes for scan / condition events.
drop policy if exists activity_log_select on public.activity_log;
create policy activity_log_select on public.activity_log
  for select to authenticated
  using (public.is_org_member(organization_id));
