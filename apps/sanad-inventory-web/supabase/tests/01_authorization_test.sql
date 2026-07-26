-- =====================================================================
-- 01_authorization_test.sql — role-based RLS authorization tests
-- =====================================================================
-- Runs against a local throwaway cluster that has had, in order:
--   00_supabase_bootstrap.sql, 0001_initial.sql, 0002_scans.sql,
--   20260725161641_role_based_rls.sql
--
-- Every check executes as the `authenticated` Postgres role with a
-- `request.jwt.claims` GUC naming a specific user — the same mechanism
-- PostgREST uses — so what is exercised is the real policy set, not a
-- simulation of it.
--
-- Expectation strings:
--   'ok:<n>'   statement succeeded and affected <n> rows
--   'err:<ss>' statement raised SQLSTATE <ss> (42501 = insufficient privilege)
--
-- Note the asymmetry, which is why row counts matter as much as errors:
--   INSERT blocked by RLS  -> error 42501
--   SELECT/UPDATE/DELETE blocked by RLS -> no error, simply 0 rows
-- A test that only checked for absence of an error would pass vacuously.
-- =====================================================================

create schema if not exists test;

create table if not exists test.results (
  seq       serial primary key,
  name      text not null,
  expected  text not null,
  actual    text not null,
  passed    boolean not null
);

-- Executes `p_stmt` as `p_user`, records the outcome.
create or replace function test.as_user(
  p_name     text,
  p_user     uuid,
  p_stmt     text,
  p_expected text
) returns void
language plpgsql
as $$
declare
  v_actual text;
  v_rows   bigint;
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  begin
    execute p_stmt;
    get diagnostics v_rows = row_count;
    v_actual := 'ok:' || v_rows;
  exception when others then
    v_actual := 'err:' || sqlstate;
  end;

  reset role;
  insert into test.results (name, expected, actual, passed)
  values (p_name, p_expected, v_actual, v_actual = p_expected);
end $$;

-- Same, but anonymous: `anon` role and no JWT claims at all.
create or replace function test.as_anon(
  p_name     text,
  p_stmt     text,
  p_expected text
) returns void
language plpgsql
as $$
declare
  v_actual text;
  v_rows   bigint;
begin
  perform set_config('request.jwt.claims', '', true);
  set local role anon;

  begin
    execute p_stmt;
    get diagnostics v_rows = row_count;
    v_actual := 'ok:' || v_rows;
  exception when others then
    v_actual := 'err:' || sqlstate;
  end;

  reset role;
  insert into test.results (name, expected, actual, passed)
  values (p_name, p_expected, v_actual, v_actual = p_expected);
end $$;

-- =====================================================================
-- Fixtures
-- =====================================================================
-- Two organizations. Org A has one user per role plus a user whose
-- membership is revoked mid-suite. Org B has its own owner, used for every
-- cross-organization check.

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'owner@a.test'),
  ('a0000000-0000-0000-0000-000000000002', 'admin@a.test'),
  ('a0000000-0000-0000-0000-000000000003', 'member@a.test'),
  ('a0000000-0000-0000-0000-000000000004', 'viewer@a.test'),
  ('a0000000-0000-0000-0000-000000000005', 'revoked@a.test'),
  ('b0000000-0000-0000-0000-000000000001', 'owner@b.test'),
  -- Belongs to BOTH organizations. Without this user, a cross-org move is
  -- refused by the WITH CHECK clause alone and the immutability trigger is
  -- never actually exercised.
  ('d0000000-0000-0000-0000-000000000001', 'dual@both.test');

insert into public.profiles (id, full_name) values
  ('a0000000-0000-0000-0000-000000000001', 'A Owner'),
  ('a0000000-0000-0000-0000-000000000002', 'A Admin'),
  ('a0000000-0000-0000-0000-000000000003', 'A Member'),
  ('a0000000-0000-0000-0000-000000000004', 'A Viewer'),
  ('a0000000-0000-0000-0000-000000000005', 'A Revoked'),
  ('b0000000-0000-0000-0000-000000000001', 'B Owner'),
  ('d0000000-0000-0000-0000-000000000001', 'Dual Org Owner');

insert into public.organizations (id, slug, name) values
  ('aaaa0000-0000-0000-0000-000000000001', 'org-a', 'Org A'),
  ('bbbb0000-0000-0000-0000-000000000002', 'org-b', 'Org B');

insert into public.organization_members (organization_id, user_id, role) values
  ('aaaa0000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('aaaa0000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'admin'),
  ('aaaa0000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'member'),
  ('aaaa0000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'viewer'),
  ('aaaa0000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'member'),
  ('bbbb0000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'owner'),
  -- owner in BOTH organizations
  ('aaaa0000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'owner'),
  ('bbbb0000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'owner');

-- Operational rows owned by each org.
insert into public.lab_assets (id, organization_id, tag, name) values
  ('11110000-0000-0000-0000-00000000000a', 'aaaa0000-0000-0000-0000-000000000001', 'LA-A1', 'Asset A1'),
  ('11110000-0000-0000-0000-00000000000b', 'aaaa0000-0000-0000-0000-000000000001', 'LA-A2', 'Asset A2'),
  ('11110000-0000-0000-0000-00000000000c', 'aaaa0000-0000-0000-0000-000000000001', 'LA-A3', 'Asset A3'),
  ('11110000-0000-0000-0000-00000000000d', 'aaaa0000-0000-0000-0000-000000000001', 'LA-A4', 'Asset A4'),
  ('22220000-0000-0000-0000-00000000000a', 'bbbb0000-0000-0000-0000-000000000002', 'LA-B1', 'Asset B1');

insert into public.activity_log
  (id, organization_id, entity_type, entity_id, action, description)
values
  ('33330000-0000-0000-0000-00000000000a', 'aaaa0000-0000-0000-0000-000000000001',
   'lab_asset', '11110000-0000-0000-0000-00000000000a', 'created', 'seed');

insert into storage.buckets (id, name, public)
values ('lab-asset-scans', 'lab-asset-scans', false)
on conflict (id) do nothing;

insert into storage.objects (bucket_id, name) values
  ('lab-asset-scans', 'aaaa0000-0000-0000-0000-000000000001/sess-a/photo.jpg'),
  ('lab-asset-scans', 'bbbb0000-0000-0000-0000-000000000002/sess-b/photo.jpg');

-- =====================================================================
-- 1. Anonymous access is denied
-- =====================================================================
select test.as_anon('anon: select lab_assets denied',
  'select * from public.lab_assets', 'err:42501');
select test.as_anon('anon: select organizations denied',
  'select * from public.organizations', 'err:42501');
select test.as_anon('anon: select organization_members denied',
  'select * from public.organization_members', 'err:42501');
select test.as_anon('anon: select activity_log denied',
  'select * from public.activity_log', 'err:42501');
select test.as_anon('anon: insert lab_assets denied',
  $$insert into public.lab_assets (organization_id, tag, name)
    values ('aaaa0000-0000-0000-0000-000000000001','LA-ANON','x')$$, 'err:42501');
select test.as_anon('anon: storage select denied',
  $$select * from storage.objects where bucket_id = 'lab-asset-scans'$$, 'ok:0');

-- =====================================================================
-- 2. viewer — read yes, write no
-- =====================================================================
select test.as_user('viewer: select lab_assets allowed',
  'a0000000-0000-0000-0000-000000000004',
  'select * from public.lab_assets', 'ok:4');

select test.as_user('viewer: insert denied',
  'a0000000-0000-0000-0000-000000000004',
  $$insert into public.lab_assets (organization_id, tag, name)
    values ('aaaa0000-0000-0000-0000-000000000001','LA-V','viewer try')$$, 'err:42501');

select test.as_user('viewer: update affects 0 rows',
  'a0000000-0000-0000-0000-000000000004',
  $$update public.lab_assets set name = 'hacked'
    where id = '11110000-0000-0000-0000-00000000000a'$$, 'ok:0');

select test.as_user('viewer: delete affects 0 rows',
  'a0000000-0000-0000-0000-000000000004',
  $$delete from public.lab_assets
    where id = '11110000-0000-0000-0000-00000000000a'$$, 'ok:0');

select test.as_user('viewer: activity_log insert denied',
  'a0000000-0000-0000-0000-000000000004',
  $$insert into public.activity_log
      (organization_id, entity_type, entity_id, action)
    values ('aaaa0000-0000-0000-0000-000000000001','lab_asset',
            '11110000-0000-0000-0000-00000000000a','created')$$, 'err:42501');

-- =====================================================================
-- 3. member — read/insert/update yes, delete no
-- =====================================================================
select test.as_user('member: select allowed',
  'a0000000-0000-0000-0000-000000000003',
  'select * from public.lab_assets', 'ok:4');

select test.as_user('member: insert allowed',
  'a0000000-0000-0000-0000-000000000003',
  $$insert into public.lab_assets (organization_id, tag, name)
    values ('aaaa0000-0000-0000-0000-000000000001','LA-M','member made')$$, 'ok:1');

select test.as_user('member: update allowed',
  'a0000000-0000-0000-0000-000000000003',
  $$update public.lab_assets set name = 'renamed by member'
    where id = '11110000-0000-0000-0000-00000000000a'$$, 'ok:1');

select test.as_user('member: delete affects 0 rows',
  'a0000000-0000-0000-0000-000000000003',
  $$delete from public.lab_assets
    where id = '11110000-0000-0000-0000-00000000000b'$$, 'ok:0');

select test.as_user('member: activity_log insert allowed',
  'a0000000-0000-0000-0000-000000000003',
  $$insert into public.activity_log
      (organization_id, entity_type, entity_id, action, performed_by)
    values ('aaaa0000-0000-0000-0000-000000000001','lab_asset',
            '11110000-0000-0000-0000-00000000000a','created',
            'a0000000-0000-0000-0000-000000000003')$$, 'ok:1');

-- =====================================================================
-- 4. admin — full operational CRUD
-- =====================================================================
select test.as_user('admin: select allowed',
  'a0000000-0000-0000-0000-000000000002',
  'select * from public.lab_assets', 'ok:5');

select test.as_user('admin: insert allowed',
  'a0000000-0000-0000-0000-000000000002',
  $$insert into public.lab_assets (organization_id, tag, name)
    values ('aaaa0000-0000-0000-0000-000000000001','LA-AD','admin made')$$, 'ok:1');

select test.as_user('admin: update allowed',
  'a0000000-0000-0000-0000-000000000002',
  $$update public.lab_assets set name = 'renamed by admin'
    where id = '11110000-0000-0000-0000-00000000000c'$$, 'ok:1');

select test.as_user('admin: delete allowed',
  'a0000000-0000-0000-0000-000000000002',
  $$delete from public.lab_assets
    where id = '11110000-0000-0000-0000-00000000000c'$$, 'ok:1');

-- =====================================================================
-- 5. owner — full operational CRUD
-- =====================================================================
select test.as_user('owner: select allowed',
  'a0000000-0000-0000-0000-000000000001',
  'select * from public.lab_assets', 'ok:5');

select test.as_user('owner: insert allowed',
  'a0000000-0000-0000-0000-000000000001',
  $$insert into public.lab_assets (organization_id, tag, name)
    values ('aaaa0000-0000-0000-0000-000000000001','LA-OW','owner made')$$, 'ok:1');

select test.as_user('owner: update allowed',
  'a0000000-0000-0000-0000-000000000001',
  $$update public.lab_assets set name = 'renamed by owner'
    where id = '11110000-0000-0000-0000-00000000000d'$$, 'ok:1');

select test.as_user('owner: delete allowed',
  'a0000000-0000-0000-0000-000000000001',
  $$delete from public.lab_assets
    where id = '11110000-0000-0000-0000-00000000000d'$$, 'ok:1');

-- =====================================================================
-- 6. Cross-organization isolation, for every role
-- =====================================================================
select test.as_user('owner: cannot see org B rows',
  'a0000000-0000-0000-0000-000000000001',
  $$select * from public.lab_assets
    where organization_id = 'bbbb0000-0000-0000-0000-000000000002'$$, 'ok:0');
select test.as_user('admin: cannot see org B rows',
  'a0000000-0000-0000-0000-000000000002',
  $$select * from public.lab_assets
    where organization_id = 'bbbb0000-0000-0000-0000-000000000002'$$, 'ok:0');
select test.as_user('member: cannot see org B rows',
  'a0000000-0000-0000-0000-000000000003',
  $$select * from public.lab_assets
    where organization_id = 'bbbb0000-0000-0000-0000-000000000002'$$, 'ok:0');
select test.as_user('viewer: cannot see org B rows',
  'a0000000-0000-0000-0000-000000000004',
  $$select * from public.lab_assets
    where organization_id = 'bbbb0000-0000-0000-0000-000000000002'$$, 'ok:0');

select test.as_user('owner: cannot insert into org B',
  'a0000000-0000-0000-0000-000000000001',
  $$insert into public.lab_assets (organization_id, tag, name)
    values ('bbbb0000-0000-0000-0000-000000000002','LA-X','cross org')$$, 'err:42501');

select test.as_user('owner: cannot delete org B rows',
  'a0000000-0000-0000-0000-000000000001',
  $$delete from public.lab_assets
    where id = '22220000-0000-0000-0000-00000000000a'$$, 'ok:0');

select test.as_user('owner: cannot see org B organization row',
  'a0000000-0000-0000-0000-000000000001',
  $$select * from public.organizations
    where id = 'bbbb0000-0000-0000-0000-000000000002'$$, 'ok:0');

select test.as_user('owner: cannot see org B memberships',
  'a0000000-0000-0000-0000-000000000001',
  $$select * from public.organization_members
    where organization_id = 'bbbb0000-0000-0000-0000-000000000002'$$, 'ok:0');

select test.as_user('owner: cannot see org B profiles',
  'a0000000-0000-0000-0000-000000000001',
  $$select * from public.profiles
    where id = 'b0000000-0000-0000-0000-000000000001'$$, 'ok:0');

-- =====================================================================
-- 7. organization_id reassignment is refused
-- =====================================================================
-- For a user who belongs to only one organization the WITH CHECK clause is
-- already enough: the destination org is not writable for them.
select test.as_user('owner: cannot move a row to an org they are not in',
  'a0000000-0000-0000-0000-000000000001',
  $$update public.lab_assets
      set organization_id = 'bbbb0000-0000-0000-0000-000000000002'
    where id = '11110000-0000-0000-0000-00000000000a'$$, 'err:42501');

select test.as_user('member: cannot move a row to an org they are not in',
  'a0000000-0000-0000-0000-000000000003',
  $$update public.lab_assets
      set organization_id = 'bbbb0000-0000-0000-0000-000000000002'
    where id = '11110000-0000-0000-0000-00000000000a'$$, 'err:42501');

-- The case RLS alone cannot catch, and the reason the trigger exists: this
-- user is an owner of BOTH organizations, so USING and WITH CHECK both pass.
-- Only private.forbid_org_change() refuses the move.
select test.as_user('dual-org owner: can read rows in both orgs',
  'd0000000-0000-0000-0000-000000000001',
  $$select * from public.lab_assets
    where organization_id = 'bbbb0000-0000-0000-0000-000000000002'$$, 'ok:1');

select test.as_user('dual-org owner: still cannot move a row between them',
  'd0000000-0000-0000-0000-000000000001',
  $$update public.lab_assets
      set organization_id = 'bbbb0000-0000-0000-0000-000000000002'
    where id = '11110000-0000-0000-0000-00000000000a'$$, 'err:42501');

select test.as_user('dual-org owner: normal update in org A still works',
  'd0000000-0000-0000-0000-000000000001',
  $$update public.lab_assets set name = 'dual renamed'
    where id = '11110000-0000-0000-0000-00000000000a'$$, 'ok:1');

-- =====================================================================
-- 8. Membership / profile / organization mutation unavailable
-- =====================================================================
select test.as_user('owner: cannot insert membership',
  'a0000000-0000-0000-0000-000000000001',
  $$insert into public.organization_members (organization_id, user_id, role)
    values ('aaaa0000-0000-0000-0000-000000000001',
            'b0000000-0000-0000-0000-000000000001','owner')$$, 'err:42501');

select test.as_user('owner: cannot escalate own role',
  'a0000000-0000-0000-0000-000000000001',
  $$update public.organization_members set role = 'owner'
    where user_id = 'a0000000-0000-0000-0000-000000000004'$$, 'err:42501');

select test.as_user('viewer: cannot escalate own role',
  'a0000000-0000-0000-0000-000000000004',
  $$update public.organization_members set role = 'owner'
    where user_id = 'a0000000-0000-0000-0000-000000000004'$$, 'err:42501');

select test.as_user('owner: cannot delete membership',
  'a0000000-0000-0000-0000-000000000001',
  $$delete from public.organization_members
    where user_id = 'a0000000-0000-0000-0000-000000000004'$$, 'err:42501');

select test.as_user('owner: cannot update own profile',
  'a0000000-0000-0000-0000-000000000001',
  $$update public.profiles set full_name = 'renamed'
    where id = 'a0000000-0000-0000-0000-000000000001'$$, 'err:42501');

select test.as_user('owner: cannot insert a profile',
  'a0000000-0000-0000-0000-000000000001',
  $$insert into public.profiles (id, full_name)
    values ('c0000000-0000-0000-0000-000000000001','New')$$, 'err:42501');

select test.as_user('owner: cannot update organization',
  'a0000000-0000-0000-0000-000000000001',
  $$update public.organizations set name = 'Renamed'
    where id = 'aaaa0000-0000-0000-0000-000000000001'$$, 'err:42501');

select test.as_user('owner: can read own profile',
  'a0000000-0000-0000-0000-000000000001',
  $$select * from public.profiles
    where id = 'a0000000-0000-0000-0000-000000000001'$$, 'ok:1');

select test.as_user('owner: can read a peer profile in same org',
  'a0000000-0000-0000-0000-000000000001',
  $$select * from public.profiles
    where id = 'a0000000-0000-0000-0000-000000000004'$$, 'ok:1');

-- =====================================================================
-- 9. activity_log is append-only
-- =====================================================================
select test.as_user('owner: activity_log select allowed',
  'a0000000-0000-0000-0000-000000000001',
  'select * from public.activity_log', 'ok:2');

select test.as_user('owner: activity_log update denied',
  'a0000000-0000-0000-0000-000000000001',
  $$update public.activity_log set description = 'tampered'
    where id = '33330000-0000-0000-0000-00000000000a'$$, 'err:42501');

select test.as_user('owner: activity_log delete denied',
  'a0000000-0000-0000-0000-000000000001',
  $$delete from public.activity_log
    where id = '33330000-0000-0000-0000-00000000000a'$$, 'err:42501');

select test.as_user('admin: activity_log delete denied',
  'a0000000-0000-0000-0000-000000000002',
  $$delete from public.activity_log
    where id = '33330000-0000-0000-0000-00000000000a'$$, 'err:42501');

select test.as_user('member: cannot forge performed_by',
  'a0000000-0000-0000-0000-000000000003',
  $$insert into public.activity_log
      (organization_id, entity_type, entity_id, action, performed_by)
    values ('aaaa0000-0000-0000-0000-000000000001','lab_asset',
            '11110000-0000-0000-0000-00000000000a','created',
            'a0000000-0000-0000-0000-000000000001')$$, 'err:42501');

-- =====================================================================
-- 10. Storage matches the matrix
-- =====================================================================
select test.as_user('viewer: storage select own org allowed',
  'a0000000-0000-0000-0000-000000000004',
  $$select * from storage.objects
    where name like 'aaaa0000-0000-0000-0000-000000000001/%'$$, 'ok:1');

select test.as_user('viewer: storage cross-org select blocked',
  'a0000000-0000-0000-0000-000000000004',
  $$select * from storage.objects
    where name like 'bbbb0000-0000-0000-0000-000000000002/%'$$, 'ok:0');

select test.as_user('viewer: storage insert denied',
  'a0000000-0000-0000-0000-000000000004',
  $$insert into storage.objects (bucket_id, name)
    values ('lab-asset-scans',
            'aaaa0000-0000-0000-0000-000000000001/sess-v/x.jpg')$$, 'err:42501');

select test.as_user('member: storage insert allowed',
  'a0000000-0000-0000-0000-000000000003',
  $$insert into storage.objects (bucket_id, name)
    values ('lab-asset-scans',
            'aaaa0000-0000-0000-0000-000000000001/sess-m/x.jpg')$$, 'ok:1');

select test.as_user('member: storage update allowed (upsert path)',
  'a0000000-0000-0000-0000-000000000003',
  $$update storage.objects set name = name
    where name = 'aaaa0000-0000-0000-0000-000000000001/sess-m/x.jpg'$$, 'ok:1');

select test.as_user('member: storage delete affects 0 rows',
  'a0000000-0000-0000-0000-000000000003',
  $$delete from storage.objects
    where name = 'aaaa0000-0000-0000-0000-000000000001/sess-m/x.jpg'$$, 'ok:0');

select test.as_user('admin: storage delete allowed',
  'a0000000-0000-0000-0000-000000000002',
  $$delete from storage.objects
    where name = 'aaaa0000-0000-0000-0000-000000000001/sess-m/x.jpg'$$, 'ok:1');

select test.as_user('member: storage insert into another org denied',
  'a0000000-0000-0000-0000-000000000003',
  $$insert into storage.objects (bucket_id, name)
    values ('lab-asset-scans',
            'bbbb0000-0000-0000-0000-000000000002/sess-x/x.jpg')$$, 'err:42501');

-- =====================================================================
-- 11. Private helpers are not reachable by the API roles
-- =====================================================================
select test.as_anon('anon: cannot execute private.readable_org_ids',
  'select * from private.readable_org_ids()', 'err:42501');
select test.as_anon('anon: cannot execute private.writable_org_ids',
  'select * from private.writable_org_ids()', 'err:42501');

-- The old public SECURITY DEFINER RPC endpoint is gone entirely.
select test.as_anon('anon: public.is_org_member no longer exists',
  $$select public.is_org_member('aaaa0000-0000-0000-0000-000000000001')$$,
  'err:42883');

-- =====================================================================
-- 12. Revoking membership removes access immediately
-- =====================================================================
select test.as_user('revoked user: has access before revocation',
  'a0000000-0000-0000-0000-000000000005',
  'select * from public.lab_assets', 'ok:5');

delete from public.organization_members
where user_id = 'a0000000-0000-0000-0000-000000000005';

select test.as_user('revoked user: select returns nothing after revocation',
  'a0000000-0000-0000-0000-000000000005',
  'select * from public.lab_assets', 'ok:0');

select test.as_user('revoked user: insert denied after revocation',
  'a0000000-0000-0000-0000-000000000005',
  $$insert into public.lab_assets (organization_id, tag, name)
    values ('aaaa0000-0000-0000-0000-000000000001','LA-R','revoked try')$$, 'err:42501');

select test.as_user('revoked user: storage select empty after revocation',
  'a0000000-0000-0000-0000-000000000005',
  $$select * from storage.objects
    where name like 'aaaa0000-0000-0000-0000-000000000001/%'$$, 'ok:0');
