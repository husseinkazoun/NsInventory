-- =====================================================================
-- 20260726111500_garments.sql
-- Clothing-specific extension of the shared lab_assets base record
-- =====================================================================
-- `lab_assets` stays the one asset table. A garment is an asset that ALSO
-- has a row here, one-to-one. Nothing about an existing asset changes, and
-- an asset without a `garments` row is not clothing — which is the whole
-- point: there is no flag to backfill wrongly and no way to accidentally
-- reclassify the estate. "Is this clothing?" is answered by a join, not by
-- a guess.
--
-- Fields the base record already carries are NOT duplicated here:
--
--   name       -> the item name                (public.lab_assets.name)
--   condition  -> excellent..broken            (public.lab_assets.condition)
--   location   -> storage location             (public.lab_assets.location)
--   tag        -> internal inventory code      (public.lab_assets.tag)
--   status     -> lifecycle of the asset       (public.lab_assets.status)
--
-- `garments.sku` is deliberately separate from `lab_assets.tag`: the tag is
-- the internal asset identifier (derived from the scan session so a retry is
-- idempotent), while a SKU is a resale/listing code a human assigns later.
-- `listing_status` is likewise separate from `lab_assets.status`: a garment
-- can be an active asset that is not yet listed for sale.
--
-- Everything the AI cannot read stays NULL. No column has a non-null default
-- that would invent a value the photo did not support.
-- =====================================================================

-- ── Listing lifecycle ─────────────────────────────────────────────────
-- Distinct from public.asset_status, which describes the asset itself.
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'garment_listing_status'
  ) then
    create type public.garment_listing_status as enum (
      'draft', 'ready', 'listed', 'reserved', 'sold', 'withdrawn'
    );
  end if;
end $$;

-- ── Composite key so a garment can never point across organizations ───
-- `id` is already the primary key, so this unique constraint costs nothing
-- semantically; it exists solely to be the target of the composite foreign
-- key below. Without it, `garments.organization_id` could disagree with the
-- asset's own organization and every RLS policy here would be checking the
-- wrong tenant.
alter table public.lab_assets
  drop constraint if exists lab_assets_id_org_key;
alter table public.lab_assets
  add constraint lab_assets_id_org_key unique (id, organization_id);

-- ── The clothing record ───────────────────────────────────────────────
create table if not exists public.garments (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null
                          references public.organizations(id) on delete cascade,
  -- One-to-one with the base asset. UNIQUE is what makes it one-to-one;
  -- ON DELETE CASCADE means deleting the asset removes the extension rather
  -- than orphaning it.
  lab_asset_id          uuid not null unique
                          references public.lab_assets(id) on delete cascade,

  -- Descriptive attributes. All nullable: the AI leaves unread fields empty
  -- and a human fills them in later.
  title                 text,
  garment_type          text,
  brand                 text,
  size_label            text,
  size_system           text,
  material              text,
  primary_color         text,
  secondary_color       text,
  pattern               text,

  -- Condition detail. The coarse rating lives on lab_assets.condition; these
  -- are the specifics behind it.
  condition_notes       text,
  flaws                 jsonb not null default '[]'::jsonb,
  measurements          jsonb not null default '{}'::jsonb,

  -- Commercial
  sku                   text,
  listing_status        public.garment_listing_status not null default 'draft',
  purchase_cost         numeric(12,2),
  selling_price         numeric(12,2),
  currency              text,
  notes                 text,

  -- Provenance: which scan produced this, and which photo to show.
  scan_session_id       uuid references public.scan_sessions(id) on delete set null,
  primary_photo_scan_id uuid references public.photo_scans(id)   on delete set null,
  ai_confidence         numeric(4,3),
  -- The full structured extraction, kept verbatim for audit. The columns
  -- above hold the REVIEWED values, which may differ where a human corrected
  -- the AI; this is what it originally said.
  ai_extraction         jsonb,

  created_by            uuid references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint garments_org_matches_asset
    foreign key (lab_asset_id, organization_id)
    references public.lab_assets(id, organization_id),

  constraint garments_flaws_is_array
    check (jsonb_typeof(flaws) = 'array'),
  constraint garments_measurements_is_object
    check (jsonb_typeof(measurements) = 'object'),
  constraint garments_purchase_cost_non_negative
    check (purchase_cost is null or purchase_cost >= 0),
  constraint garments_selling_price_non_negative
    check (selling_price is null or selling_price >= 0),
  constraint garments_ai_confidence_range
    check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1))
);

create index if not exists garments_org_idx
  on public.garments(organization_id);
create index if not exists garments_asset_idx
  on public.garments(lab_asset_id);
create index if not exists garments_listing_status_idx
  on public.garments(organization_id, listing_status);
-- SKU is optional, but unique per organization when present.
create unique index if not exists garments_org_sku_key
  on public.garments(organization_id, sku) where sku is not null;

-- ── Triggers, matching every other operational table ──────────────────
drop trigger if exists garments_set_updated_at on public.garments;
create trigger garments_set_updated_at
  before update on public.garments
  for each row execute function public.set_updated_at();

-- organization_id is immutable. USING + WITH CHECK cannot catch a move
-- between two organizations the caller belongs to; only OLD-vs-NEW can.
drop trigger if exists garments_forbid_org_change on public.garments;
create trigger garments_forbid_org_change
  before update on public.garments
  for each row execute function private.forbid_org_change();

-- ── RLS ───────────────────────────────────────────────────────────────
-- Same shape as every other org-scoped operational table:
--   select -> any member · insert/update -> owner/admin/member · delete -> owner/admin
--
-- Stated explicitly rather than relying on the platform `ensure_rls` event
-- trigger, which does not exist on a plain Postgres (the local test cluster).
alter table public.garments enable row level security;

drop policy if exists garments_select on public.garments;
drop policy if exists garments_insert on public.garments;
drop policy if exists garments_update on public.garments;
drop policy if exists garments_delete on public.garments;

create policy garments_select on public.garments
  for select to authenticated
  using ( organization_id in (select private.readable_org_ids()) );

create policy garments_insert on public.garments
  for insert to authenticated
  with check ( organization_id in (select private.writable_org_ids()) );

-- WITH CHECK as well as USING: the row must belong to a writable org both
-- before and after the update.
create policy garments_update on public.garments
  for update to authenticated
  using ( organization_id in (select private.writable_org_ids()) )
  with check ( organization_id in (select private.writable_org_ids()) );

create policy garments_delete on public.garments
  for delete to authenticated
  using ( organization_id in (select private.deletable_org_ids()) );

-- ── Data API privileges ───────────────────────────────────────────────
-- Explicit, not inherited: start from nothing, then grant exactly what the
-- role needs. RLS decides which rows; these decide whether the table is
-- reachable at all. `anon` is granted nothing.
revoke all on table public.garments from public, anon, authenticated;
grant all on table public.garments to service_role;
grant select, insert, update, delete on table public.garments to authenticated;

-- ── Atomic creation of asset + garment ────────────────────────────────
-- PostgREST cannot span two tables in one transaction from the client, and a
-- garment whose asset insert succeeded but whose own insert failed is exactly
-- the orphan this avoids. A single function call is one transaction.
--
-- SECURITY INVOKER (the default, stated explicitly): the function runs as the
-- caller, so both inserts are still subject to RLS. A SECURITY DEFINER
-- function here would bypass the policies above and become a hole in the
-- authorization model — it is deliberately not used.
--
-- Idempotent, because the review step can be submitted twice (double click,
-- or a retry after a network failure):
--   1. reuse the asset this scan session already produced, then
--   2. adopt an existing asset with the same tag, then
--   3. only then insert.
-- Step 2 matters because `tag` is derived from the session id, so a retry
-- computes the SAME tag and would otherwise collide with
-- `unique (organization_id, tag)`.
create or replace function public.create_garment_asset(
  p_organization_id uuid,
  p_tag             text,
  p_name            text,
  p_condition       public.asset_condition,
  p_status          public.asset_status,
  p_location        text,
  p_garment         jsonb,
  p_scan_session_id uuid    default null,
  p_photo_scan_id   uuid    default null,
  p_confidence      numeric default null,
  p_ai_extraction   jsonb   default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_asset_id uuid;
begin
  if p_organization_id is null or p_tag is null or p_name is null then
    raise exception 'create_garment_asset: organization, tag and name are required';
  end if;

  -- 1. This session already produced an asset.
  if p_scan_session_id is not null then
    select s.lab_asset_id
      into v_asset_id
      from public.scan_sessions s
     where s.id = p_scan_session_id
       and s.organization_id = p_organization_id
       and s.lab_asset_id is not null;
  end if;

  -- 2. An asset already exists under this tag.
  if v_asset_id is null then
    select a.id
      into v_asset_id
      from public.lab_assets a
     where a.organization_id = p_organization_id
       and a.tag = p_tag;
  end if;

  -- 3. Create it.
  if v_asset_id is null then
    insert into public.lab_assets
      (organization_id, tag, name, condition, status, location, created_by)
    values
      (p_organization_id, p_tag, p_name, p_condition, p_status,
       nullif(p_location, ''), (select auth.uid()))
    returning id into v_asset_id;
  else
    -- A retry carries the reviewed values, which may have been corrected
    -- since the first attempt. Location is only overwritten when supplied.
    update public.lab_assets
       set name      = p_name,
           condition = p_condition,
           status    = p_status,
           location  = coalesce(nullif(p_location, ''), location)
     where id = v_asset_id;
  end if;

  insert into public.garments (
    organization_id, lab_asset_id,
    title, garment_type, brand, size_label, size_system, material,
    primary_color, secondary_color, pattern,
    condition_notes, flaws, measurements,
    sku, listing_status, purchase_cost, selling_price, currency, notes,
    scan_session_id, primary_photo_scan_id, ai_confidence, ai_extraction,
    created_by
  )
  values (
    p_organization_id, v_asset_id,
    nullif(p_garment->>'title', ''),
    nullif(p_garment->>'garment_type', ''),
    nullif(p_garment->>'brand', ''),
    nullif(p_garment->>'size_label', ''),
    nullif(p_garment->>'size_system', ''),
    nullif(p_garment->>'material', ''),
    nullif(p_garment->>'primary_color', ''),
    nullif(p_garment->>'secondary_color', ''),
    nullif(p_garment->>'pattern', ''),
    nullif(p_garment->>'condition_notes', ''),
    coalesce(p_garment->'flaws',        '[]'::jsonb),
    coalesce(p_garment->'measurements', '{}'::jsonb),
    nullif(p_garment->>'sku', ''),
    coalesce(
      nullif(p_garment->>'listing_status', '')::public.garment_listing_status,
      'draft'
    ),
    nullif(p_garment->>'purchase_cost', '')::numeric,
    nullif(p_garment->>'selling_price', '')::numeric,
    nullif(p_garment->>'currency', ''),
    nullif(p_garment->>'notes', ''),
    p_scan_session_id, p_photo_scan_id, p_confidence, p_ai_extraction,
    (select auth.uid())
  )
  on conflict (lab_asset_id) do update set
    title           = excluded.title,
    garment_type    = excluded.garment_type,
    brand           = excluded.brand,
    size_label      = excluded.size_label,
    size_system     = excluded.size_system,
    material        = excluded.material,
    primary_color   = excluded.primary_color,
    secondary_color = excluded.secondary_color,
    pattern         = excluded.pattern,
    condition_notes = excluded.condition_notes,
    flaws           = excluded.flaws,
    measurements    = excluded.measurements,
    sku             = excluded.sku,
    listing_status  = excluded.listing_status,
    purchase_cost   = excluded.purchase_cost,
    selling_price   = excluded.selling_price,
    currency        = excluded.currency,
    notes           = excluded.notes;

  return v_asset_id;
end $$;

-- No ambient EXECUTE: `anon` must not be able to call this.
revoke all on function public.create_garment_asset(
  uuid, text, text, public.asset_condition, public.asset_status,
  text, jsonb, uuid, uuid, numeric, jsonb
) from public, anon;

grant execute on function public.create_garment_asset(
  uuid, text, text, public.asset_condition, public.asset_status,
  text, jsonb, uuid, uuid, numeric, jsonb
) to authenticated;

-- ── Backfill: only assets a scan PROVED are clothing ──────────────────
-- The evidence is `photo_scans.extracted -> 'clothing'`, the structured
-- payload the vision provider returns. An asset reached only through a scan
-- session that produced such a payload is clothing; nothing else is touched.
--
-- This is why no `is_clothing` flag exists: there is no defensible way to
-- classify the rest, so the migration does not try. Assets with no clothing
-- scan keep behaving exactly as before.
--
-- `distinct on` picks the most recent scan per asset when several exist.
-- `on conflict do nothing` makes re-running safe.
--
-- Packaged as a function rather than a bare statement so the local RLS suite
-- can seed fixtures and call the SAME code, instead of re-implementing the
-- query in a test where it could drift from what actually ran.
create or replace function private.backfill_garments_from_scans()
returns integer
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_inserted integer;
begin
insert into public.garments (
  organization_id, lab_asset_id,
  title, garment_type, brand, size_label, size_system, material,
  primary_color, secondary_color, pattern,
  flaws, scan_session_id, primary_photo_scan_id, ai_confidence, ai_extraction
)
select distinct on (ss.lab_asset_id)
  la.organization_id,
  la.id,
  nullif(x.c->'suggested_title'->>'value', ''),
  nullif(x.c->'garment_type'->>'value', ''),
  nullif(x.c->'brand'->>'value', ''),
  nullif(x.c->'size_label'->>'value', ''),
  nullif(x.c->'size_system'->>'value', ''),
  nullif(x.c->'material_composition'->>'value', ''),
  nullif(x.c->'main_color'->>'value', ''),
  nullif(x.c->'secondary_color'->>'value', ''),
  nullif(x.c->'pattern'->>'value', ''),
  case
    when jsonb_typeof(x.c->'flaws') = 'array' then x.c->'flaws'
    else '[]'::jsonb
  end,
  ss.id,
  ps.id,
  ps.confidence,
  x.c
from public.photo_scans ps
join public.scan_sessions ss on ss.id = ps.scan_session_id
join public.lab_assets   la on la.id = ss.lab_asset_id
cross join lateral (select ps.extracted -> 'clothing' as c) x
where ps.processing_status = 'completed'
  and jsonb_typeof(x.c) = 'object'
  and la.organization_id = ss.organization_id
order by ss.lab_asset_id, ps.processed_at desc nulls last, ps.id
on conflict (lab_asset_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end $fn$;

revoke all on function private.backfill_garments_from_scans() from public, anon;

-- Run it once, now, for data that already exists in this database.
do $$
declare n integer;
begin
  select private.backfill_garments_from_scans() into n;
  raise notice 'garments backfill: % asset(s) identified as clothing by scan evidence', n;
end $$;
