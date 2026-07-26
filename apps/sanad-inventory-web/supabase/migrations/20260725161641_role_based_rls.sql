-- =====================================================================
-- 20260725161641_role_based_rls.sql — role-aware RLS security slice
-- =====================================================================
-- Until now every policy was a bare `public.is_org_member(organization_id)`:
-- membership alone granted read, write AND delete, so a `viewer` had exactly
-- the same rights as an `owner`. The `org_role` enum existed purely as a
-- label. This migration makes the database enforce the role matrix:
--
--   role     | read | create/update | delete
--   ---------|------|---------------|-------
--   owner    | yes  | yes           | yes
--   admin    | yes  | yes           | yes
--   member   | yes  | yes           | no
--   viewer   | yes  | no            | no
--
-- Additional rules enforced here:
--   * `anon` receives no inventory data at all (privileges revoked, and no
--     policy targets it).
--   * No role may reach another organization's rows.
--   * `activity_log` is append-only for owner/admin/member; nothing in the
--     Data API may update or delete an activity row.
--   * organizations / profiles / organization_members are read-only from the
--     frontend. Membership administration is a later slice.
--
-- RLS is the security boundary. Frontend role checks are UX only.
-- =====================================================================

-- =====================================================================
-- 1. Authorization helpers, in a schema the Data API does not expose
-- =====================================================================
-- `public.is_org_member()` was SECURITY DEFINER in `public`, which Postgres
-- grants EXECUTE on to PUBLIC by default — so it was reachable by `anon` at
-- /rest/v1/rpc (confirmed by the live security advisor). These replacements
-- live in `private`, which PostgREST does not expose, and EXECUTE is revoked
-- from PUBLIC and anon.
--
-- They are SECURITY DEFINER so they read `organization_members` as the owner
-- and therefore bypass that table's own RLS. That is what keeps a policy on
-- `organization_members` from recursing into itself.
--
-- Each returns a SET of organization ids rather than taking an organization
-- id and returning boolean. That difference matters for performance: a
-- policy written as `organization_id in (select private.readable_org_ids())`
-- has no dependency on the row being checked, so Postgres evaluates it once
-- per statement as an InitPlan. The old `is_org_member(organization_id)` form
-- took row data as an argument and therefore had to run once per row — the
-- `auth_rls_initplan` advisor warning. Wrapping that old form in a subselect
-- would NOT have fixed it; the shape had to change.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Organizations the caller belongs to, in any role. Basis for all reads.
create or replace function private.readable_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select om.organization_id
  from public.organization_members om
  where om.user_id = (select auth.uid())
$$;

-- Organizations the caller may create/update operational data in.
create or replace function private.writable_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select om.organization_id
  from public.organization_members om
  where om.user_id = (select auth.uid())
    and om.role in ('owner', 'admin', 'member')
$$;

-- Organizations the caller may delete operational data in.
create or replace function private.deletable_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select om.organization_id
  from public.organization_members om
  where om.user_id = (select auth.uid())
    and om.role in ('owner', 'admin')
$$;

-- Profiles the caller may see: their own, plus anyone sharing an organization
-- with them. Needed so the `profiles!lab_assets_assigned_to_fkey` embed keeps
-- resolving assignee names. SECURITY DEFINER avoids recursing through the
-- organization_members policy.
create or replace function private.visible_profile_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct them.user_id
  from public.organization_members me
  join public.organization_members them
    on them.organization_id = me.organization_id
  where me.user_id = (select auth.uid())
$$;

-- Lock the helpers down: no ambient EXECUTE, only what `authenticated` needs.
revoke all on function private.readable_org_ids()    from public, anon;
revoke all on function private.writable_org_ids()    from public, anon;
revoke all on function private.deletable_org_ids()   from public, anon;
revoke all on function private.visible_profile_ids() from public, anon;

grant execute on function private.readable_org_ids()    to authenticated;
grant execute on function private.writable_org_ids()    to authenticated;
grant execute on function private.deletable_org_ids()   to authenticated;
grant execute on function private.visible_profile_ids() to authenticated;

-- =====================================================================
-- 2. Harden mutable search_path (live advisor: function_search_path_mutable)
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Pure string parsing, no table access, SECURITY INVOKER. Kept in `public`
-- because the storage policies reference it; only its search_path changes.
create or replace function public.scan_object_org(name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/'
    then (substring(name from 1 for 36))::uuid
    else null
  end;
$$;

-- =====================================================================
-- 3. organization_id immutability
-- =====================================================================
-- RLS alone cannot express "this column may not change": a WITH CHECK clause
-- sees only the new row, so a user belonging to two organizations could move
-- a row from one to the other and both states would satisfy the policy. A
-- trigger is the only way to compare OLD to NEW, so it enforces the rule for
-- every role, service_role included.
create or replace function private.forbid_org_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception
      'organization_id is immutable (attempted % -> %)',
      old.organization_id, new.organization_id
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.forbid_org_change() from public, anon;

do $$
declare t text;
begin
  foreach t in array array[
    'categories', 'units', 'lab_assets', 'activity_log',
    'scan_sessions', 'photo_scans', 'missing_components'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_forbid_org_change', t);
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function private.forbid_org_change()',
      t || '_forbid_org_change', t
    );
  end loop;
end $$;

-- =====================================================================
-- 4. Drop the membership-only policies from 0001 and 0002
-- =====================================================================
drop policy if exists organizations_member_select on public.organizations;

drop policy if exists profiles_select      on public.profiles;
drop policy if exists profiles_self_insert on public.profiles;
drop policy if exists profiles_self_update on public.profiles;

drop policy if exists organization_members_select on public.organization_members;

drop policy if exists categories_select on public.categories;
drop policy if exists categories_insert on public.categories;
drop policy if exists categories_update on public.categories;
drop policy if exists categories_delete on public.categories;

drop policy if exists units_select on public.units;
drop policy if exists units_insert on public.units;
drop policy if exists units_update on public.units;
drop policy if exists units_delete on public.units;

drop policy if exists lab_assets_select on public.lab_assets;
drop policy if exists lab_assets_insert on public.lab_assets;
drop policy if exists lab_assets_update on public.lab_assets;
drop policy if exists lab_assets_delete on public.lab_assets;

drop policy if exists activity_log_select on public.activity_log;
drop policy if exists activity_log_insert on public.activity_log;

drop policy if exists scan_sessions_select on public.scan_sessions;
drop policy if exists scan_sessions_insert on public.scan_sessions;
drop policy if exists scan_sessions_update on public.scan_sessions;
drop policy if exists scan_sessions_delete on public.scan_sessions;

drop policy if exists photo_scans_select on public.photo_scans;
drop policy if exists photo_scans_insert on public.photo_scans;
drop policy if exists photo_scans_update on public.photo_scans;
drop policy if exists photo_scans_delete on public.photo_scans;

drop policy if exists missing_components_select on public.missing_components;
drop policy if exists missing_components_insert on public.missing_components;
drop policy if exists missing_components_update on public.missing_components;
drop policy if exists missing_components_delete on public.missing_components;

drop policy if exists lab_asset_scans_select on storage.objects;
drop policy if exists lab_asset_scans_insert on storage.objects;
drop policy if exists lab_asset_scans_update on storage.objects;
drop policy if exists lab_asset_scans_delete on storage.objects;

-- The old public SECURITY DEFINER helper, now unreferenced.
drop function if exists public.is_org_member(uuid);

-- =====================================================================
-- 5. Read-only reference tables
-- =====================================================================
-- Mutation of organizations / profiles / memberships is not available from
-- the Data API at all: SELECT policies only, and SELECT-only grants below.

create policy organizations_select on public.organizations
  for select to authenticated
  using ( id in (select private.readable_org_ids()) );

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or id in (select private.visible_profile_ids())
  );

create policy organization_members_select on public.organization_members
  for select to authenticated
  using ( organization_id in (select private.readable_org_ids()) );

-- =====================================================================
-- 6. Operational tables — role-aware CRUD
-- =====================================================================
-- Identical shape for every org-scoped operational table:
--   select  -> any member          (readable)
--   insert  -> owner/admin/member  (writable)
--   update  -> owner/admin/member  (writable), USING *and* WITH CHECK
--   delete  -> owner/admin         (deletable)
do $$
declare t text;
begin
  foreach t in array array[
    'categories', 'units', 'lab_assets',
    'scan_sessions', 'photo_scans', 'missing_components'
  ] loop
    execute format($f$
      create policy %I on public.%I
        for select to authenticated
        using ( organization_id in (select private.readable_org_ids()) )
    $f$, t || '_select', t);

    execute format($f$
      create policy %I on public.%I
        for insert to authenticated
        with check ( organization_id in (select private.writable_org_ids()) )
    $f$, t || '_insert', t);

    -- WITH CHECK as well as USING: without it the USING clause would be
    -- reused for the new row, which is nearly right but leaves the intent
    -- implicit. Cross-organization moves are blocked by the trigger above.
    execute format($f$
      create policy %I on public.%I
        for update to authenticated
        using ( organization_id in (select private.writable_org_ids()) )
        with check ( organization_id in (select private.writable_org_ids()) )
    $f$, t || '_update', t);

    execute format($f$
      create policy %I on public.%I
        for delete to authenticated
        using ( organization_id in (select private.deletable_org_ids()) )
    $f$, t || '_delete', t);
  end loop;
end $$;

-- =====================================================================
-- 7. activity_log — append-only
-- =====================================================================
-- No UPDATE or DELETE policy exists, and the corresponding privileges are
-- not granted, so an activity row cannot be altered or removed through the
-- Data API by any role.
create policy activity_log_select on public.activity_log
  for select to authenticated
  using ( organization_id in (select private.readable_org_ids()) );

create policy activity_log_insert on public.activity_log
  for insert to authenticated
  with check (
    organization_id in (select private.writable_org_ids())
    and ( performed_by is null or performed_by = (select auth.uid()) )
  );

-- =====================================================================
-- 8. Storage — lab-asset-scans
-- =====================================================================
-- Object path convention is '{organization_id}/{scan_session_id}/{file}';
-- public.scan_object_org(name) parses the leading segment. SELECT + INSERT +
-- UPDATE are all available to writable roles because Storage upsert needs all
-- three. DELETE is owner/admin only, matching the matrix.
create policy lab_asset_scans_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'lab-asset-scans'
    and public.scan_object_org(name) in (select private.readable_org_ids())
  );

create policy lab_asset_scans_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lab-asset-scans'
    and public.scan_object_org(name) in (select private.writable_org_ids())
  );

create policy lab_asset_scans_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'lab-asset-scans'
    and public.scan_object_org(name) in (select private.writable_org_ids())
  )
  with check (
    bucket_id = 'lab-asset-scans'
    and public.scan_object_org(name) in (select private.writable_org_ids())
  );

create policy lab_asset_scans_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'lab-asset-scans'
    and public.scan_object_org(name) in (select private.deletable_org_ids())
  );

-- =====================================================================
-- 9. Data API privileges
-- =====================================================================
-- Previously nothing here granted anything; the tables were reachable only
-- because this project predates Supabase's switch to opt-in Data API
-- exposure (changelog 2026-04-28, default for projects created after
-- 2026-05-30). Recreating the project would have made every table invisible
-- to the client. These grants make exposure explicit and no longer
-- dependent on project-creation defaults.
do $$
declare t text;
begin
  foreach t in array array[
    'organizations', 'profiles', 'organization_members',
    'categories', 'units', 'lab_assets', 'activity_log',
    'scan_sessions', 'photo_scans', 'missing_components'
  ] loop
    -- Start from nothing so the result does not depend on inherited defaults.
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    -- service_role is the backend identity (Edge Functions, admin tasks) and
    -- bypasses RLS; it keeps full access.
    execute format('grant all on table public.%I to service_role', t);
    -- Every authenticated user may read; RLS decides which rows.
    execute format('grant select on table public.%I to authenticated', t);
  end loop;

  -- Operational tables: write privileges at the table level; RLS decides
  -- which roles may actually use them.
  foreach t in array array[
    'categories', 'units', 'lab_assets',
    'scan_sessions', 'photo_scans', 'missing_components'
  ] loop
    execute format('grant insert, update, delete on table public.%I to authenticated', t);
  end loop;

  -- activity_log is append-only: INSERT but never UPDATE or DELETE.
  execute format('grant insert on table public.activity_log to authenticated');
end $$;

-- anon keeps no privilege on any inventory table. Nothing above grants to it
-- and every policy targets `authenticated`, so an anonymous request returns
-- no rows even though it can still reach the API.
