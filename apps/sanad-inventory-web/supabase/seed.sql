-- =====================================================================
-- seed.sql — Sanad Inventory development seed
-- Idempotent; safe to re-run. Mirrors the React app's mock data 1:1.
-- =====================================================================

-- Default development organization
insert into public.organizations (id, slug, name) values
  ('11111111-1111-1111-1111-111111111111', 'sanad-dev', 'Sanad Inventory Dev')
on conflict (id) do nothing;

-- Categories
insert into public.categories (id, organization_id, name, slug) values
  ('22222222-2222-2222-2222-222222220001', '11111111-1111-1111-1111-111111111111', 'Consumables', 'consumables'),
  ('22222222-2222-2222-2222-222222220002', '11111111-1111-1111-1111-111111111111', 'PPE',         'ppe'),
  ('22222222-2222-2222-2222-222222220003', '11111111-1111-1111-1111-111111111111', 'Devices',     'devices'),
  ('22222222-2222-2222-2222-222222220004', '11111111-1111-1111-1111-111111111111', 'Reagents',    'reagents'),
  ('22222222-2222-2222-2222-222222220005', '11111111-1111-1111-1111-111111111111', 'Equipment',   'equipment')
on conflict (id) do nothing;

-- Units
insert into public.units (id, organization_id, name, short_code) values
  ('33333333-3333-3333-3333-333333330001', '11111111-1111-1111-1111-111111111111', 'Each', 'ea'),
  ('33333333-3333-3333-3333-333333330002', '11111111-1111-1111-1111-111111111111', 'Box',  'box'),
  ('33333333-3333-3333-3333-333333330003', '11111111-1111-1111-1111-111111111111', 'Pack', 'pck'),
  ('33333333-3333-3333-3333-333333330004', '11111111-1111-1111-1111-111111111111', 'Kit',  'kit')
on conflict (id) do nothing;

-- Lab Assets — match mockData.ts 1:1 (deterministic UUIDs so URLs survive reseeds)
insert into public.lab_assets
  (id, organization_id, tag, name, manufacturer, model, serial, location,
   category_id, unit_id, status, condition,
   last_maintenance, next_maintenance, warranty_expiry)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111',
   'LA-A1B2C3', 'Centrifuge MX-9', 'Eppendorf', 'MX-9', '87XJ-3401K', 'Lab 2 · Bench A',
   '22222222-2222-2222-2222-222222220005', '33333333-3333-3333-3333-333333330001',
   'active', 'good',
   '2026-02-15', '2026-05-22', '2027-03-01'),

  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '11111111-1111-1111-1111-111111111111',
   'LA-D4E5F6', 'pH Meter Pro 700', 'Hanna', 'Pro 700', 'HI-PRO-118', 'Lab 1 · Shelf 3',
   '22222222-2222-2222-2222-222222220003', '33333333-3333-3333-3333-333333330001',
   'active', 'excellent',
   '2026-04-02', null, '2028-01-20'),

  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '11111111-1111-1111-1111-111111111111',
   'LA-G7H8I9', 'Microscope BX-53', 'Olympus', 'BX-53', 'OL-BX53-2004', 'Lab 3 · Workstation 2',
   '22222222-2222-2222-2222-222222220005', '33333333-3333-3333-3333-333333330001',
   'maintenance', 'fair',
   '2025-12-01', '2026-05-18', '2026-09-30'),

  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', '11111111-1111-1111-1111-111111111111',
   'LA-J0K1L2', 'Analytical Balance', 'Sartorius', 'Quintix 224-1S', 'SAR-Q224-009', 'Storage A',
   '22222222-2222-2222-2222-222222220005', '33333333-3333-3333-3333-333333330001',
   'active', 'good',
   '2026-01-12', '2026-07-01', '2027-11-12'),

  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', '11111111-1111-1111-1111-111111111111',
   'LA-M3N4O5', 'Incubator IS-200', 'Thermo', 'Heratherm IS-200', 'TH-IS200-44', 'Lab 1 · Cabinet 2',
   '22222222-2222-2222-2222-222222220005', '33333333-3333-3333-3333-333333330001',
   'inactive', 'poor',
   '2025-08-20', null, null)
on conflict (id) do nothing;

-- =====================================================================
-- REQUIRED follow-up: grant yourself membership
-- =====================================================================
-- profiles and organization_members are NOT seeded here because they depend
-- on real auth.users rows.
--
-- This step is MANDATORY, not optional. The app resolves its organization
-- from organization_members and has no development fallback (the former
-- DEV_ORG_ID constant was removed). Signing in without a membership row lands
-- you on the "No organization access" screen and you will see no data — that
-- is the resolver working correctly, not a bug.
--
-- After creating your user via the Supabase auth UI, run:
--
--   insert into public.profiles (id, full_name)
--     values ('<your-user-uuid>', 'You')
--     on conflict (id) do nothing;
--
--   insert into public.organization_members (organization_id, user_id, role)
--     values ('11111111-1111-1111-1111-111111111111', '<your-user-uuid>', 'owner')
--     on conflict do nothing;
--
-- Note: `role` is recorded but NOT yet enforced — every RLS policy currently
-- gates on membership alone via is_org_member(), so 'viewer' has the same
-- write access as 'owner'. See docs/feature-parity-matrix.md §4.
