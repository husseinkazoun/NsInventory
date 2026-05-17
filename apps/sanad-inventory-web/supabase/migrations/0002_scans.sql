-- =====================================================================
-- 0002_scans.sql — Sanad Inventory scan tables, storage, and policies
-- =====================================================================
-- New tables    : scan_sessions, photo_scans, missing_components
-- New enums     : scan_type, scan_session_status, photo_type,
--                 processing_status, missing_severity, missing_status
-- Storage       : lab-asset-scans bucket + RLS helpers and policies
-- Policy change : widen activity_log insert so members can record events
-- =====================================================================

-- ── Enums ─────────────────────────────────────────────────────────────
do $$ begin
  create type public.scan_type as enum ('intake', 'condition', 'missing');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.scan_session_status as enum (
    'in_progress', 'completed', 'failed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.photo_type as enum (
    'overview', 'serial_label', 'components', 'condition'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.processing_status as enum (
    'pending', 'processing', 'completed', 'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.missing_severity as enum ('minor', 'medium', 'critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.missing_status as enum ('missing', 'resolved', 'dismissed');
exception when duplicate_object then null; end $$;

-- ── scan_sessions ─────────────────────────────────────────────────────
create table if not exists public.scan_sessions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lab_asset_id    uuid references public.lab_assets(id) on delete set null,
  scan_type       public.scan_type not null,
  status          public.scan_session_status not null default 'in_progress',
  summary         jsonb,
  notes           text,
  created_by      uuid references public.profiles(id),
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists scan_sessions_org_idx
  on public.scan_sessions(organization_id, started_at desc);
create index if not exists scan_sessions_asset_idx
  on public.scan_sessions(lab_asset_id);

drop trigger if exists scan_sessions_set_updated_at on public.scan_sessions;
create trigger scan_sessions_set_updated_at
  before update on public.scan_sessions
  for each row execute function public.set_updated_at();

-- ── photo_scans ───────────────────────────────────────────────────────
create table if not exists public.photo_scans (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  scan_session_id   uuid not null references public.scan_sessions(id) on delete cascade,
  lab_asset_id      uuid references public.lab_assets(id) on delete set null,
  image_path        text not null,
  photo_type        public.photo_type not null default 'overview',
  processing_status public.processing_status not null default 'pending',
  confidence        numeric(4,3),
  extracted         jsonb,
  error_message     text,
  created_at        timestamptz not null default now(),
  processed_at      timestamptz
);
create index if not exists photo_scans_session_idx
  on public.photo_scans(scan_session_id);
create index if not exists photo_scans_org_idx
  on public.photo_scans(organization_id, created_at desc);
create index if not exists photo_scans_asset_idx
  on public.photo_scans(lab_asset_id);

-- ── missing_components ────────────────────────────────────────────────
create table if not exists public.missing_components (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lab_asset_id    uuid not null references public.lab_assets(id) on delete cascade,
  scan_session_id uuid references public.scan_sessions(id) on delete set null,
  component_name  text not null,
  severity        public.missing_severity not null,
  status          public.missing_status not null default 'missing',
  detected_at     timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references public.profiles(id),
  notes           text
);
create index if not exists missing_components_asset_idx
  on public.missing_components(lab_asset_id, status);
create index if not exists missing_components_org_idx
  on public.missing_components(organization_id, detected_at desc);

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.scan_sessions       enable row level security;
alter table public.photo_scans         enable row level security;
alter table public.missing_components  enable row level security;

-- ── scan_sessions ──
drop policy if exists scan_sessions_select on public.scan_sessions;
create policy scan_sessions_select on public.scan_sessions
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists scan_sessions_insert on public.scan_sessions;
create policy scan_sessions_insert on public.scan_sessions
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists scan_sessions_update on public.scan_sessions;
create policy scan_sessions_update on public.scan_sessions
  for update to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists scan_sessions_delete on public.scan_sessions;
create policy scan_sessions_delete on public.scan_sessions
  for delete to authenticated
  using (public.is_org_member(organization_id));

-- ── photo_scans ──
drop policy if exists photo_scans_select on public.photo_scans;
create policy photo_scans_select on public.photo_scans
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists photo_scans_insert on public.photo_scans;
create policy photo_scans_insert on public.photo_scans
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists photo_scans_update on public.photo_scans;
create policy photo_scans_update on public.photo_scans
  for update to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists photo_scans_delete on public.photo_scans;
create policy photo_scans_delete on public.photo_scans
  for delete to authenticated
  using (public.is_org_member(organization_id));

-- ── missing_components ──
drop policy if exists missing_components_select on public.missing_components;
create policy missing_components_select on public.missing_components
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists missing_components_insert on public.missing_components;
create policy missing_components_insert on public.missing_components
  for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists missing_components_update on public.missing_components;
create policy missing_components_update on public.missing_components
  for update to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists missing_components_delete on public.missing_components;
create policy missing_components_delete on public.missing_components
  for delete to authenticated
  using (public.is_org_member(organization_id));

-- =====================================================================
-- Activity log: widen so authenticated members can insert
-- =====================================================================
drop policy if exists activity_log_insert on public.activity_log;
create policy activity_log_insert on public.activity_log
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and (performed_by is null or performed_by = auth.uid())
  );

-- =====================================================================
-- Storage bucket bootstrap + policies
-- =====================================================================
-- NOTE: this requires permission to write to storage.buckets and
-- storage.objects. On hosted Supabase the service role can run this via
-- the SQL editor or CLI. If a deployment environment forbids it, create
-- the bucket via the dashboard (name 'lab-asset-scans', private) and the
-- ON CONFLICT clauses below will no-op.

insert into storage.buckets (id, name, public)
values ('lab-asset-scans', 'lab-asset-scans', false)
on conflict (id) do nothing;

-- Object path convention: '{organization_id}/{scan_session_id}/{filename}'.
-- The first 36 characters before the first slash are the org UUID.
create or replace function public.scan_object_org(name text)
returns uuid
language sql
immutable
as $$
  select case
    when name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/'
    then (substring(name from 1 for 36))::uuid
    else null
  end;
$$;

drop policy if exists lab_asset_scans_select on storage.objects;
create policy lab_asset_scans_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'lab-asset-scans'
    and public.is_org_member(public.scan_object_org(name))
  );

drop policy if exists lab_asset_scans_insert on storage.objects;
create policy lab_asset_scans_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lab-asset-scans'
    and public.is_org_member(public.scan_object_org(name))
  );

drop policy if exists lab_asset_scans_update on storage.objects;
create policy lab_asset_scans_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'lab-asset-scans'
    and public.is_org_member(public.scan_object_org(name))
  );

drop policy if exists lab_asset_scans_delete on storage.objects;
create policy lab_asset_scans_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'lab-asset-scans'
    and public.is_org_member(public.scan_object_org(name))
  );
