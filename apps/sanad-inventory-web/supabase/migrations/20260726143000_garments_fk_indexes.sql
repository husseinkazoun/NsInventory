-- =====================================================================
-- 20260726143000_garments_fk_indexes.sql
-- Cover the foreign keys introduced by 20260726111500_garments.sql
-- =====================================================================
-- The hosted Supabase performance advisor reported `unindexed_foreign_keys`
-- against four constraints on public.garments. Postgres does not create an
-- index for the referencing side of a foreign key, so each of these forces a
-- sequential scan when the parent row is updated or deleted — and every one of
-- these parents is deletable (an asset, a scan session, a photo scan, a
-- profile).
--
-- Scope is deliberately narrow: ONLY the constraints this milestone added.
-- The advisor also reports the same finding for activity_log, lab_assets,
-- missing_components and scan_sessions. Those predate this work and are left
-- alone rather than swept up in an unrelated change.
--
-- The advisor's `unused_index` findings are NOT acted on. They fire because
-- the table currently holds a single row, where the planner prefers a
-- sequential scan over any index — `lab_assets_org_idx` is reported for the
-- same reason and has always been correct to keep. Dropping an index because
-- an almost-empty table has not used it yet would be the wrong lesson.
-- =====================================================================

-- `lab_asset_id` is declared UNIQUE, and that constraint already maintains a
-- unique index on exactly this column — so garments_asset_idx duplicated it
-- and could never be chosen. Replacing it with the two-column form covers the
-- composite foreign key `garments_org_matches_asset`
-- (lab_asset_id, organization_id) instead of restating what UNIQUE provides.
drop index if exists public.garments_asset_idx;

create index if not exists garments_asset_org_idx
  on public.garments(lab_asset_id, organization_id);

-- Referencing sides of the remaining foreign keys.
create index if not exists garments_scan_session_idx
  on public.garments(scan_session_id);

create index if not exists garments_primary_photo_idx
  on public.garments(primary_photo_scan_id);

create index if not exists garments_created_by_idx
  on public.garments(created_by);
