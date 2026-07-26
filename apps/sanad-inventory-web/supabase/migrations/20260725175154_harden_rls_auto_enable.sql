-- =====================================================================
-- 20260725175154_harden_rls_auto_enable.sql
-- Remove ambient EXECUTE from the Supabase-managed RLS auto-enable function
-- =====================================================================
-- The security advisor reports two WARNs against this project:
--
--   anon_security_definer_function_executable
--   authenticated_security_definer_function_executable
--
-- both for `public.rls_auto_enable()`. It is created by the Supabase platform
-- (owner `postgres`, SECURITY DEFINER, search_path = pg_catalog) and backs the
-- `ensure_rls` event trigger, which enables RLS on newly created public
-- tables. Postgres grants EXECUTE on every new function to PUBLIC by default,
-- and `anon`/`authenticated` inherit from PUBLIC — hence the finding.
--
-- Exploitability is limited: the function returns `event_trigger`, a type
-- PostgREST cannot expose, so it is not genuinely callable over /rest/v1/rpc,
-- and calling an event-trigger function directly raises "can only be called
-- as an event trigger". The finding is nonetheless correct about the grant,
-- and removing an unnecessary ambient privilege on a SECURITY DEFINER function
-- is the right default. This migration closes it.
--
-- What is NOT changed:
--   * the function body, owner, security mode and search_path
--   * the `ensure_rls` event trigger, which keeps firing
--
-- Revoking EXECUTE does not stop the event trigger. Postgres checks EXECUTE
-- when a function is *called*; an event-trigger function is invoked by the
-- system while processing DDL, not called by the session's role. This is
-- asserted by the local suite (`02_advisor_checks.sql`), which creates a
-- table after the revoke and confirms RLS was still switched on automatically.
--
-- Idempotent and portable:
--   * no-ops with a NOTICE when the function is absent (it is platform-
--     managed, so it does not exist on a plain Postgres or a local shadow DB)
--   * skips roles that do not exist, so it runs outside Supabase too
--   * re-running is harmless; REVOKE of an absent privilege is a no-op
-- =====================================================================

do $$
declare
  fn_oid    oid;
  role_name text;
begin
  -- Match on name *and* return type so we can never target an unrelated
  -- function that happens to share the name.
  select p.oid
    into fn_oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'rls_auto_enable'
     and pg_get_function_result(p.oid) = 'event_trigger'
   limit 1;

  if fn_oid is null then
    raise notice
      'harden_rls_auto_enable: public.rls_auto_enable() not present — nothing to do';
    return;
  end if;

  -- PUBLIC first: anon and authenticated inherit from it, so this is the
  -- grant that actually matters. The explicit role revokes below cover the
  -- case where someone was also granted EXECUTE directly.
  execute 'revoke all on function public.rls_auto_enable() from public';

  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format(
        'revoke all on function public.rls_auto_enable() from %I', role_name
      );
    else
      raise notice
        'harden_rls_auto_enable: role % does not exist — skipped', role_name;
    end if;
  end loop;

  raise notice
    'harden_rls_auto_enable: EXECUTE revoked from PUBLIC, anon and authenticated';
end $$;

-- Verify in the same transaction, so a partial application cannot be recorded
-- as successful. The owner (postgres) necessarily retains EXECUTE, and the
-- event trigger is untouched.
do $$
declare
  fn_oid oid;
begin
  select p.oid into fn_oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'rls_auto_enable'
     and pg_get_function_result(p.oid) = 'event_trigger'
   limit 1;

  if fn_oid is null then
    return; -- nothing was hardened; nothing to verify
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon')
     and has_function_privilege('anon', fn_oid, 'execute') then
    raise exception 'harden_rls_auto_enable: anon can still execute rls_auto_enable()';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and has_function_privilege('authenticated', fn_oid, 'execute') then
    raise exception 'harden_rls_auto_enable: authenticated can still execute rls_auto_enable()';
  end if;

  if not exists (
    select 1 from pg_event_trigger
     where evtfoid = fn_oid and evtenabled <> 'D'
  ) then
    raise warning
      'harden_rls_auto_enable: no enabled event trigger uses rls_auto_enable() — automatic RLS may be off';
  end if;
end $$;
