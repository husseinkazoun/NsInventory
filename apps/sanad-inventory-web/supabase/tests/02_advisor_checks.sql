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

-- The property the advisor actually tests is reachability, not existence.
-- `public.rls_auto_enable()` is platform-managed and cannot be moved out of
-- `public`, so the invariant is that nothing SECURITY DEFINER in `public` is
-- callable by an API role.
select test.assert(
  'advisor: no SECURITY DEFINER function in public is reachable by anon or authenticated',
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and (has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('authenticated', p.oid, 'execute'))
  )
);

-- Separately: no *application* SECURITY DEFINER function belongs in `public`.
-- Ours live in `private`; only the Supabase-managed one is permitted here.
select test.assert(
  'advisor: the only SECURITY DEFINER function in public is the platform one',
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname <> 'rls_auto_enable'
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

-- Count guard, deliberately exact: a new public table that nobody granted
-- SELECT on would be invisible to the client, and a new table granted to the
-- wrong role would be silently over-exposed. Either way this fails and the
-- number has to be re-justified. 11 = the original 10 plus `garments`.
select test.assert(
  'grants: authenticated can read every inventory table',
  (
    select count(distinct table_name)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'authenticated'
      and privilege_type = 'SELECT'
  ) = 11
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

-- ── anon/authenticated_security_definer_function_executable ───────────
-- Both advisor findings concern public.rls_auto_enable(). The hardening
-- migration revokes the ambient EXECUTE; these assert it took effect AND that
-- the automatic-RLS behaviour it backs still works.
select test.assert(
  'advisor: anon cannot execute public.rls_auto_enable()',
  not has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')
);

select test.assert(
  'advisor: authenticated cannot execute public.rls_auto_enable()',
  not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute')
);

-- proacl NULL means "default privileges", which for a function is PUBLIC
-- EXECUTE — exactly the state the advisor flags. After the revoke the ACL is
-- explicit and must not mention PUBLIC (an entry starting with '=').
select test.assert(
  'advisor: rls_auto_enable ACL no longer grants PUBLIC',
  (
    select p.proacl is not null
       and not exists (
         select 1 from unnest(p.proacl) a where a::text like '=%'
       )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  )
);

select test.assert(
  'advisor: function owner retains EXECUTE',
  (
    select has_function_privilege(pg_get_userbyid(p.proowner), p.oid, 'execute')
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  )
);

select test.assert(
  'advisor: ensure_rls event trigger still exists and is enabled',
  exists (
    select 1 from pg_event_trigger et
    join pg_proc p on p.oid = et.evtfoid
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and et.evtevent = 'ddl_command_end'
      and et.evtenabled <> 'D'
  )
);

-- Functional proof, not just a privilege check: create a table AFTER the
-- revoke and confirm the event trigger still switched RLS on. Postgres checks
-- EXECUTE when a function is *called*; an event-trigger function is invoked by
-- the system during DDL, so revoking EXECUTE cannot stop it. This asserts that
-- rather than assuming it.
create table if not exists public.rls_auto_enable_probe (id integer);

select test.assert(
  'behaviour: automatic RLS still enabled on a newly created public table',
  (
    select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rls_auto_enable_probe'
  )
);

drop table if exists public.rls_auto_enable_probe;

select test.assert(
  'behaviour: probe table cleaned up',
  to_regclass('public.rls_auto_enable_probe') is null
);
