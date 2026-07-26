-- =====================================================================
-- 03_garments_test.sql — authorization + backfill for the clothing table
-- =====================================================================
-- Runs AFTER 01, deliberately. That file asserts exact row counts against
-- `lab_assets` ('ok:4', 'ok:5'), so any fixture added before it would break
-- assertions that have nothing to do with clothing. Everything seeded here
-- is therefore created at the end, and the counts below are local to this
-- file.
--
-- Reuses 01's fixtures: org A (aaaa…0001) with owner/admin/member/viewer,
-- org B (bbbb…0002) with its own owner, and the dual-org user. Note 01 ends
-- by deleting the revoked user's membership — that is not undone here.
--
-- The helpers `test.as_user` / `test.as_anon` come from 01.
-- =====================================================================

-- ── Fixtures ──────────────────────────────────────────────────────────
-- One garment in each organization, so cross-tenant isolation is testable.
insert into public.lab_assets (id, organization_id, tag, name, condition) values
  ('44440000-0000-0000-0000-00000000000a',
   'aaaa0000-0000-0000-0000-000000000001', 'LA-GARMENT-A', 'Navy jacket', 'good'),
  ('44440000-0000-0000-0000-00000000000b',
   'bbbb0000-0000-0000-0000-000000000002', 'LA-GARMENT-B', 'Red dress', 'fair');

insert into public.garments
  (id, organization_id, lab_asset_id, garment_type, brand, size_label, primary_color)
values
  ('55550000-0000-0000-0000-00000000000a',
   'aaaa0000-0000-0000-0000-000000000001',
   '44440000-0000-0000-0000-00000000000a', 'Jacket', 'Acme', 'M', 'navy'),
  ('55550000-0000-0000-0000-00000000000b',
   'bbbb0000-0000-0000-0000-000000000002',
   '44440000-0000-0000-0000-00000000000b', 'Dress', null, 'S', 'red');

-- =====================================================================
-- 1. Anonymous access is denied
-- =====================================================================
select test.as_anon('anon: select garments denied',
  'select * from public.garments', 'err:42501');

select test.as_anon('anon: insert garments denied',
  $$insert into public.garments (organization_id, lab_asset_id)
    values ('aaaa0000-0000-0000-0000-000000000001',
            '44440000-0000-0000-0000-00000000000a')$$, 'err:42501');

select test.as_anon('anon: update garments denied',
  $$update public.garments set brand = 'anon' where true$$, 'err:42501');

select test.as_anon('anon: delete garments denied',
  'delete from public.garments where true', 'err:42501');

-- The creation RPC must not be reachable anonymously.
select test.as_anon('anon: create_garment_asset denied',
  $$select public.create_garment_asset(
      'aaaa0000-0000-0000-0000-000000000001', 'LA-ANON-G', 'x',
      'good'::public.asset_condition, 'active'::public.asset_status,
      null, '{}'::jsonb)$$, 'err:42501');

-- =====================================================================
-- 2. Cross-organization isolation
-- =====================================================================
-- Each org's member sees exactly their own garment, never the other's.
select test.as_user('org A member: sees only org A garment',
  'a0000000-0000-0000-0000-000000000003',
  'select * from public.garments', 'ok:1');

select test.as_user('org B owner: sees only org B garment',
  'b0000000-0000-0000-0000-000000000001',
  'select * from public.garments', 'ok:1');

select test.as_user('org A member: cannot read org B garment by id',
  'a0000000-0000-0000-0000-000000000003',
  $$select * from public.garments
    where id = '55550000-0000-0000-0000-00000000000b'$$, 'ok:0');

select test.as_user('org A member: update of org B garment affects 0 rows',
  'a0000000-0000-0000-0000-000000000003',
  $$update public.garments set brand = 'stolen'
    where id = '55550000-0000-0000-0000-00000000000b'$$, 'ok:0');

select test.as_user('org A member: delete of org B garment affects 0 rows',
  'a0000000-0000-0000-0000-000000000001',
  $$delete from public.garments
    where id = '55550000-0000-0000-0000-00000000000b'$$, 'ok:0');

-- Writing a row INTO another organization is refused outright by WITH CHECK.
select test.as_user('org A member: insert into org B denied',
  'a0000000-0000-0000-0000-000000000003',
  $$insert into public.garments (organization_id, lab_asset_id)
    values ('bbbb0000-0000-0000-0000-000000000002',
            '44440000-0000-0000-0000-00000000000b')$$, 'err:42501');

-- =====================================================================
-- 3. Role matrix — viewer reads, member writes, owner/admin delete
-- =====================================================================
select test.as_user('viewer: select garments allowed',
  'a0000000-0000-0000-0000-000000000004',
  'select * from public.garments', 'ok:1');

select test.as_user('viewer: insert garments denied',
  'a0000000-0000-0000-0000-000000000004',
  $$insert into public.garments (organization_id, lab_asset_id)
    values ('aaaa0000-0000-0000-0000-000000000001',
            '44440000-0000-0000-0000-00000000000b')$$, 'err:42501');

select test.as_user('viewer: update affects 0 rows',
  'a0000000-0000-0000-0000-000000000004',
  $$update public.garments set brand = 'viewer'
    where id = '55550000-0000-0000-0000-00000000000a'$$, 'ok:0');

select test.as_user('viewer: delete affects 0 rows',
  'a0000000-0000-0000-0000-000000000004',
  $$delete from public.garments
    where id = '55550000-0000-0000-0000-00000000000a'$$, 'ok:0');

select test.as_user('member: update own org garment allowed',
  'a0000000-0000-0000-0000-000000000003',
  $$update public.garments set brand = 'corrected by member'
    where id = '55550000-0000-0000-0000-00000000000a'$$, 'ok:1');

select test.as_user('member: delete affects 0 rows (owner/admin only)',
  'a0000000-0000-0000-0000-000000000003',
  $$delete from public.garments
    where id = '55550000-0000-0000-0000-00000000000a'$$, 'ok:0');

select test.as_user('admin: update own org garment allowed',
  'a0000000-0000-0000-0000-000000000002',
  $$update public.garments set size_label = 'L'
    where id = '55550000-0000-0000-0000-00000000000a'$$, 'ok:1');

-- =====================================================================
-- 4. organization_id is immutable
-- =====================================================================
-- The dual-org user belongs to A and B, so USING and WITH CHECK are both
-- satisfied for either organization. Only the trigger can refuse this.
--
-- The expected SQLSTATE is 42501, not P0001: private.forbid_org_change()
-- raises `using errcode = '42501'` on purpose, so a refused move is
-- indistinguishable from an RLS denial and leaks nothing about why.
select test.as_user('dual-org owner: cannot move a garment between orgs',
  'd0000000-0000-0000-0000-000000000001',
  $$update public.garments
      set organization_id = 'bbbb0000-0000-0000-0000-000000000002'
    where id = '55550000-0000-0000-0000-00000000000a'$$, 'err:42501');

-- The same user's ordinary update in their own org still succeeds, proving
-- the refusal above is the org change specifically and not a blanket denial.
select test.as_user('dual-org owner: normal garment update still works',
  'd0000000-0000-0000-0000-000000000001',
  $$update public.garments set notes = 'checked'
    where id = '55550000-0000-0000-0000-00000000000a'$$, 'ok:1');

-- =====================================================================
-- 5. Atomic creation through the RPC
-- =====================================================================
-- One call creates both records, under the caller's own privileges.
select test.as_user('member: create_garment_asset creates asset + garment',
  'a0000000-0000-0000-0000-000000000003',
  $$select public.create_garment_asset(
      'aaaa0000-0000-0000-0000-000000000001', 'LA-RPC-1', 'Wool coat',
      'good'::public.asset_condition, 'active'::public.asset_status,
      'Shelf 3',
      '{"garment_type":"Coat","brand":"Beta","size_label":"L"}'::jsonb)$$,
  'ok:1');

select test.assert(
  'rpc: created exactly one asset and one garment',
  (select count(*) from public.lab_assets
    where tag = 'LA-RPC-1'
      and organization_id = 'aaaa0000-0000-0000-0000-000000000001') = 1
  and (select count(*) from public.garments g
       join public.lab_assets a on a.id = g.lab_asset_id
      where a.tag = 'LA-RPC-1') = 1
);

select test.assert(
  'rpc: stored the supplied garment values',
  (select g.garment_type = 'Coat' and g.brand = 'Beta' and g.size_label = 'L'
     from public.garments g
     join public.lab_assets a on a.id = g.lab_asset_id
    where a.tag = 'LA-RPC-1')
);

-- Idempotence: the same call again must NOT create a second asset. `tag` is
-- derived from the scan session, so a retry computes the same tag and would
-- otherwise collide with unique (organization_id, tag).
select test.as_user('member: repeating the call is idempotent',
  'a0000000-0000-0000-0000-000000000003',
  $$select public.create_garment_asset(
      'aaaa0000-0000-0000-0000-000000000001', 'LA-RPC-1', 'Wool coat',
      'good'::public.asset_condition, 'active'::public.asset_status,
      'Shelf 3',
      '{"garment_type":"Coat","brand":"Beta corrected","size_label":"L"}'::jsonb)$$,
  'ok:1');

select test.assert(
  'rpc: retry did not duplicate the asset',
  (select count(*) from public.lab_assets
    where tag = 'LA-RPC-1'
      and organization_id = 'aaaa0000-0000-0000-0000-000000000001') = 1
);

select test.assert(
  'rpc: retry applied the corrected value',
  (select g.brand = 'Beta corrected'
     from public.garments g
     join public.lab_assets a on a.id = g.lab_asset_id
    where a.tag = 'LA-RPC-1')
);

-- A viewer may not create anything through the RPC either: it is SECURITY
-- INVOKER, so the insert policies still apply.
select test.as_user('viewer: create_garment_asset denied by RLS',
  'a0000000-0000-0000-0000-000000000004',
  $$select public.create_garment_asset(
      'aaaa0000-0000-0000-0000-000000000001', 'LA-RPC-VIEWER', 'x',
      'good'::public.asset_condition, 'active'::public.asset_status,
      null, '{}'::jsonb)$$, 'err:42501');

select test.assert(
  'rpc: the refused call left no partial asset behind',
  not exists (select 1 from public.lab_assets where tag = 'LA-RPC-VIEWER')
);

-- Writing into an organization the caller does not belong to is refused.
select test.as_user('member: create_garment_asset into org B denied',
  'a0000000-0000-0000-0000-000000000003',
  $$select public.create_garment_asset(
      'bbbb0000-0000-0000-0000-000000000002', 'LA-RPC-CROSS', 'x',
      'good'::public.asset_condition, 'active'::public.asset_status,
      null, '{}'::jsonb)$$, 'err:42501');

select test.assert(
  'rpc: the cross-organization attempt created nothing',
  not exists (select 1 from public.lab_assets where tag = 'LA-RPC-CROSS')
);

-- =====================================================================
-- 6. Unknown AI values stay NULL rather than becoming empty strings
-- =====================================================================
select test.as_user('member: unreadable fields are stored as NULL',
  'a0000000-0000-0000-0000-000000000003',
  $$select public.create_garment_asset(
      'aaaa0000-0000-0000-0000-000000000001', 'LA-RPC-NULLS', 'Unknown item',
      'fair'::public.asset_condition, 'active'::public.asset_status, null,
      '{"garment_type":"Shirt","brand":"","size_label":null}'::jsonb)$$,
  'ok:1');

select test.assert(
  'rpc: empty string and JSON null both become SQL NULL, not ""',
  (select g.brand is null and g.size_label is null and g.garment_type = 'Shirt'
     from public.garments g
     join public.lab_assets a on a.id = g.lab_asset_id
    where a.tag = 'LA-RPC-NULLS')
);

-- =====================================================================
-- 7. The garment cannot disagree with its asset's organization
-- =====================================================================
select test.assert(
  'schema: composite FK ties garment org to the asset org',
  exists (
    select 1 from pg_constraint
    where conname = 'garments_org_matches_asset'
      and conrelid = 'public.garments'::regclass
  )
);

-- =====================================================================
-- 8. Backfill classifies ONLY assets a scan proved to be clothing
-- =====================================================================
-- Two assets: one reached through a completed scan carrying a `clothing`
-- payload, one with a completed scan that has no such payload (the pre-
-- provider shape). Exactly one must be classified.
insert into public.lab_assets (id, organization_id, tag, name) values
  ('66660000-0000-0000-0000-00000000000a',
   'aaaa0000-0000-0000-0000-000000000001', 'LA-BACKFILL-CLOTH', 'Scanned garment'),
  ('66660000-0000-0000-0000-00000000000b',
   'aaaa0000-0000-0000-0000-000000000001', 'LA-BACKFILL-PLAIN', 'Scanned equipment');

insert into public.scan_sessions (id, organization_id, lab_asset_id, scan_type, status) values
  ('77770000-0000-0000-0000-00000000000a', 'aaaa0000-0000-0000-0000-000000000001',
   '66660000-0000-0000-0000-00000000000a', 'intake', 'completed'),
  ('77770000-0000-0000-0000-00000000000b', 'aaaa0000-0000-0000-0000-000000000001',
   '66660000-0000-0000-0000-00000000000b', 'intake', 'completed');

insert into public.photo_scans
  (id, organization_id, scan_session_id, image_path, processing_status,
   confidence, extracted, processed_at)
values
  ('88880000-0000-0000-0000-00000000000a', 'aaaa0000-0000-0000-0000-000000000001',
   '77770000-0000-0000-0000-00000000000a',
   'aaaa0000-0000-0000-0000-000000000001/77770000-0000-0000-0000-00000000000a/g.jpg',
   'completed', 0.810,
   '{"fields":[],"clothing":{"garment_type":{"value":"Trousers","confidence":0.9},
     "brand":{"value":null,"confidence":0.1,"evidence":null},
     "main_color":{"value":"black","confidence":0.9},
     "size_label":{"value":"32","confidence":0.8},
     "suggested_title":{"value":"Black trousers","confidence":0.8},
     "flaws":[]}}'::jsonb,
   now()),
  -- No `clothing` key: the pre-provider response shape.
  ('88880000-0000-0000-0000-00000000000b', 'aaaa0000-0000-0000-0000-000000000001',
   '77770000-0000-0000-0000-00000000000b',
   'aaaa0000-0000-0000-0000-000000000001/77770000-0000-0000-0000-00000000000b/e.jpg',
   'completed', 0.900,
   '{"fields":[{"label":"Model","value":"MX-9","confidence":0.9}]}'::jsonb,
   now());

select test.assert(
  'backfill: inserts exactly one garment for the two seeded assets',
  private.backfill_garments_from_scans() = 1
);

select test.assert(
  'backfill: the clothing-scanned asset was classified',
  exists (
    select 1 from public.garments
    where lab_asset_id = '66660000-0000-0000-0000-00000000000a'
      and garment_type = 'Trousers'
      and primary_color = 'black'
      and title = 'Black trousers'
  )
);

select test.assert(
  'backfill: an unreadable brand stays NULL, it is not invented',
  (select brand is null from public.garments
    where lab_asset_id = '66660000-0000-0000-0000-00000000000a')
);

select test.assert(
  'backfill: carried the scan confidence and session reference',
  exists (
    select 1 from public.garments
    where lab_asset_id = '66660000-0000-0000-0000-00000000000a'
      and ai_confidence = 0.810
      and scan_session_id = '77770000-0000-0000-0000-00000000000a'
      and primary_photo_scan_id = '88880000-0000-0000-0000-00000000000a'
  )
);

select test.assert(
  'backfill: the non-clothing asset was NOT classified',
  not exists (
    select 1 from public.garments
    where lab_asset_id = '66660000-0000-0000-0000-00000000000b'
  )
);

select test.assert(
  'backfill: assets with no scan at all were not classified',
  not exists (
    select 1 from public.garments
    where lab_asset_id in (
      '11110000-0000-0000-0000-00000000000a',
      '11110000-0000-0000-0000-00000000000b',
      '11110000-0000-0000-0000-00000000000c'
    )
  )
);

-- Re-running must be a no-op, so the migration is safe to reapply.
select test.assert(
  'backfill: re-running inserts nothing further',
  private.backfill_garments_from_scans() = 0
);

-- =====================================================================
-- 9. Data API grants (not just RLS)
-- =====================================================================
select test.assert(
  'grants: anon has no privilege at all on garments',
  not has_table_privilege('anon', 'public.garments', 'select')
  and not has_table_privilege('anon', 'public.garments', 'insert')
  and not has_table_privilege('anon', 'public.garments', 'update')
  and not has_table_privilege('anon', 'public.garments', 'delete')
);

select test.assert(
  'grants: authenticated has full CRUD at table level (RLS decides rows)',
  has_table_privilege('authenticated', 'public.garments', 'select')
  and has_table_privilege('authenticated', 'public.garments', 'insert')
  and has_table_privilege('authenticated', 'public.garments', 'update')
  and has_table_privilege('authenticated', 'public.garments', 'delete')
);

select test.assert(
  'grants: service_role retains full access',
  has_table_privilege('service_role', 'public.garments', 'select')
);

select test.assert(
  'rls: garments has row level security enabled',
  (select relrowsecurity from pg_class where oid = 'public.garments'::regclass)
);

select test.assert(
  'rls: garments has all four policies',
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'garments') = 4
);

-- The UPDATE policy must carry BOTH a USING and a WITH CHECK clause.
select test.assert(
  'rls: the garments UPDATE policy has USING and WITH CHECK',
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'garments'
      and policyname = 'garments_update'
      and qual is not null and with_check is not null
  )
);

-- =====================================================================
-- 10. The creation RPC is not a privilege-escalation hole
-- =====================================================================
select test.assert(
  'advisor: create_garment_asset is SECURITY INVOKER, not DEFINER',
  (select not prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_garment_asset')
);

select test.assert(
  'advisor: create_garment_asset has a fixed search_path',
  (select array_to_string(p.proconfig, ',') like '%search_path%'
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_garment_asset')
);

select test.assert(
  'advisor: anon cannot execute create_garment_asset',
  not has_function_privilege(
    'anon',
    'public.create_garment_asset(uuid, text, text, public.asset_condition,
       public.asset_status, text, jsonb, uuid, uuid, numeric, jsonb)',
    'execute')
);
