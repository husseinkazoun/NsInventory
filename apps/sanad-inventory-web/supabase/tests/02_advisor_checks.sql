-- =====================================================================
-- 02_advisor_checks.sql — local equivalents of the Supabase linter findings
-- =====================================================================
-- `supabase db advisors --local` needs the Docker stack, which is not
-- available here. These assertions check the same conditions directly against
-- the local cluster, so the migration can be shown to close each finding that
-- the hosted advisor reported:
--
--   function_search_path_mutable               (set_updated_at, scan_object_org)
--   anon_security_definer_function_executable  (is_org_member)
--   authenticated_security_definer_function_executable
--   auth_rls_initplan                          (per-row auth.uid())
-- =====================================================================

create or replace function test.assert(p_name text, p_condition boolean)
returns void
language plpgsql
as $$
begin
  insert into test.results (name, expected, actual, passed)
  values (
    p_name,
    'true',
    coalesce(p_condition::text, 'null'),
    coalesce(p_condition, false)
  );
end $$;

-- ── function_search_path_mutable ──────────────────────────────────────
select test.assert(
  'advisor: set_updated_at has a fixed search_path',
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
      and array_to_string(p.proconfig, ',') like '%search_path%'
  )
);

select test.assert(
  'advisor: scan_object_org has a fixed search_path',
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'scan_object_org'
      and array_to_string(p.proconfig, ',') like '%search_path%'
  )
);

select test.assert(
  'advisor: every private helper has a fixed search_path',
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%'
  )
);

-- ── security definer reachable by API roles ───────────────────────────
select test.assert(
  'advisor: public.is_org_member no longer exists',
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_org_member'
  )
);

select test.assert(
  'advisor: no SECURITY DEFINER function remains in public',
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  )
);

select test.assert(
  'advisor: anon cannot execute private.readable_org_ids',
  not has_function_privilege('anon', 'private.readable_org_ids()', 'execute')
);

select test.assert(
  'advisor: anon cannot execute private.writable_org_ids',
  not has_function_privilege('anon', 'private.writable_org_ids()', 'execute')
);

select test.assert(
  'advisor: anon cannot execute private.deletable_org_ids',
  not has_function_privilege('anon', 'private.deletable_org_ids()', 'execute')
);

select test.assert(
  'advisor: anon has no USAGE on schema private',
  not has_schema_privilege('anon', 'private', 'usage')
);

select test.assert(
  'advisor: authenticated CAN execute the helpers it needs',
  has_function_privilege('authenticated', 'private.readable_org_ids()', 'execute')
);

-- ── auth_rls_initplan ─────────────────────────────────────────────────
-- Every remaining `auth.uid()` reference in a policy must sit inside a
-- subselect, which Postgres normalises to "( SELECT auth.uid() AS uid)".
-- A bare call is re-evaluated once per row.
select test.assert(
  'advisor: no policy calls auth.uid() per row',
  not exists (
    select 1
    from pg_policies
    where schemaname in ('public', 'storage')
      and (
        (qual is not null
           and qual like '%auth.uid()%'
           and qual not like '%( SELECT auth.uid()%')
        or
        (with_check is not null
           and with_check like '%auth.uid()%'
           and with_check not like '%( SELECT auth.uid()%')
      )
  )
);

-- ── grants ────────────────────────────────────────────────────────────
select test.assert(
  'grants: anon holds no privilege on any inventory table',
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'anon'
  )
);

select test.assert(
  'grants: authenticated cannot update or delete activity_log',
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'activity_log'
      and grantee = 'authenticated'
      and privilege_type in ('UPDATE', 'DELETE')
  )
);

select test.assert(
  'grants: authenticated cannot write organizations/profiles/memberships',
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('organizations', 'profiles', 'organization_members')
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  )
);

select test.assert(
  'grants: authenticated can read every inventory table',
  (
    select count(distinct table_name)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'authenticated'
      and privilege_type = 'SELECT'
  ) = 10
);

-- ── RLS coverage ──────────────────────────────────────────────────────
select test.assert(
  'rls: enabled on every public table',
  not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  )
);

select test.assert(
  'rls: no policy targets anon or PUBLIC',
  not exists (
    select 1 from pg_policies
    where schemaname in ('public', 'storage')
      and ('anon' = any(roles) or 'public' = any(roles))
  )
);
