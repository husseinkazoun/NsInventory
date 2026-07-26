// Reads and writes for the clothing extension of an asset.
//
// A garment is a `lab_assets` row that ALSO has a `public.garments` row. That
// is the only definition of "this asset is clothing" — there is no flag, and
// an asset with no garment row is not clothing. Callers ask by looking, never
// by inferring from a name or category.
//
// Every query filters on organization_id as well as relying on RLS: RLS alone
// returns the union of every organization the user belongs to, and the UI
// shows one active tenant at a time.

import { supabase } from '../supabaseClient'
import { asAppError, resolveCurrentOrgId } from '../org'
import type { Flaw, ListingStatus } from '../clothing'

export type Garment = {
  id: string
  labAssetId: string
  title: string | null
  garmentType: string | null
  brand: string | null
  sizeLabel: string | null
  sizeSystem: string | null
  material: string | null
  primaryColor: string | null
  secondaryColor: string | null
  pattern: string | null
  conditionNotes: string | null
  flaws: Flaw[]
  measurements: Record<string, unknown>
  sku: string | null
  listingStatus: ListingStatus
  purchaseCost: number | null
  sellingPrice: number | null
  currency: string | null
  notes: string | null
  scanSessionId: string | null
  primaryPhotoScanId: string | null
  aiConfidence: number | null
}

type GarmentRow = {
  id: string
  lab_asset_id: string
  title: string | null
  garment_type: string | null
  brand: string | null
  size_label: string | null
  size_system: string | null
  material: string | null
  primary_color: string | null
  secondary_color: string | null
  pattern: string | null
  condition_notes: string | null
  flaws: unknown
  measurements: unknown
  sku: string | null
  listing_status: ListingStatus
  purchase_cost: string | number | null
  selling_price: string | number | null
  currency: string | null
  notes: string | null
  scan_session_id: string | null
  primary_photo_scan_id: string | null
  ai_confidence: string | number | null
}

const SELECT = `
  id, lab_asset_id, title, garment_type, brand, size_label, size_system,
  material, primary_color, secondary_color, pattern,
  condition_notes, flaws, measurements,
  sku, listing_status, purchase_cost, selling_price, currency, notes,
  scan_session_id, primary_photo_scan_id, ai_confidence
`

// numeric columns arrive as strings over PostgREST when they exceed JS-safe
// precision, so parse rather than cast.
function num(v: string | number | null): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function rowToGarment(row: GarmentRow): Garment {
  return {
    id: row.id,
    labAssetId: row.lab_asset_id,
    title: row.title,
    garmentType: row.garment_type,
    brand: row.brand,
    sizeLabel: row.size_label,
    sizeSystem: row.size_system,
    material: row.material,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    pattern: row.pattern,
    conditionNotes: row.condition_notes,
    flaws: Array.isArray(row.flaws) ? (row.flaws as Flaw[]) : [],
    measurements:
      row.measurements && typeof row.measurements === 'object' &&
      !Array.isArray(row.measurements)
        ? (row.measurements as Record<string, unknown>)
        : {},
    sku: row.sku,
    listingStatus: row.listing_status,
    purchaseCost: num(row.purchase_cost),
    sellingPrice: num(row.selling_price),
    currency: row.currency,
    notes: row.notes,
    scanSessionId: row.scan_session_id,
    primaryPhotoScanId: row.primary_photo_scan_id,
    aiConfidence: num(row.ai_confidence),
  }
}

/**
 * The garment record for an asset, or null when the asset is not clothing.
 *
 * Null is the normal answer for equipment and must not be treated as an
 * error: the detail page uses it to decide which sections to render.
 */
export async function getGarmentForAsset(
  labAssetId: string,
): Promise<Garment | null> {
  if (!supabase) return null
  const organizationId = await resolveCurrentOrgId()
  const { data, error } = await supabase
    .from('garments')
    .select(SELECT)
    .eq('lab_asset_id', labAssetId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (error) throw asAppError(error)
  return data ? rowToGarment(data as unknown as GarmentRow) : null
}

/**
 * Which of the given assets are clothing, as a lookup keyed by asset id.
 *
 * One request for the whole list rather than one per row. Assets with no
 * garment row are simply absent from the map.
 */
export async function getGarmentsForAssets(
  labAssetIds: string[],
): Promise<Record<string, Garment>> {
  if (!supabase || labAssetIds.length === 0) return {}
  const organizationId = await resolveCurrentOrgId()
  const { data, error } = await supabase
    .from('garments')
    .select(SELECT)
    .eq('organization_id', organizationId)
    .in('lab_asset_id', labAssetIds)
  if (error) throw asAppError(error)
  const out: Record<string, Garment> = {}
  for (const row of data ?? []) {
    const g = rowToGarment(row as unknown as GarmentRow)
    out[g.labAssetId] = g
  }
  return out
}

/** Fields an editor may change after the garment has been saved. */
export type GarmentUpdate = {
  title?: string | null
  garmentType?: string | null
  brand?: string | null
  sizeLabel?: string | null
  sizeSystem?: string | null
  material?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  pattern?: string | null
  conditionNotes?: string | null
  sku?: string | null
  listingStatus?: ListingStatus
  purchaseCost?: number | null
  sellingPrice?: number | null
  notes?: string | null
}

// Empty and whitespace-only input becomes NULL, never an empty string: a
// cleared field means "unknown", which is what NULL says.
function blankToNull(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null) return null
  const t = v.trim()
  return t === '' ? null : t
}

/**
 * Updates a saved garment.
 *
 * `organization_id` is never sent: it is immutable at the database level
 * (private.forbid_org_change), and including it would be a user-supplied
 * value in an authorization-relevant column.
 */
export async function updateGarment(
  garmentId: string,
  patch: GarmentUpdate,
): Promise<Garment> {
  if (!supabase) throw new Error('Supabase is not configured')
  const organizationId = await resolveCurrentOrgId()

  const payload: Record<string, unknown> = {}
  const set = (col: string, v: unknown) => {
    if (v !== undefined) payload[col] = v
  }
  set('title', blankToNull(patch.title))
  set('garment_type', blankToNull(patch.garmentType))
  set('brand', blankToNull(patch.brand))
  set('size_label', blankToNull(patch.sizeLabel))
  set('size_system', blankToNull(patch.sizeSystem))
  set('material', blankToNull(patch.material))
  set('primary_color', blankToNull(patch.primaryColor))
  set('secondary_color', blankToNull(patch.secondaryColor))
  set('pattern', blankToNull(patch.pattern))
  set('condition_notes', blankToNull(patch.conditionNotes))
  set('sku', blankToNull(patch.sku))
  set('notes', blankToNull(patch.notes))
  set('listing_status', patch.listingStatus)
  set('purchase_cost', patch.purchaseCost)
  set('selling_price', patch.sellingPrice)

  const { data, error } = await supabase
    .from('garments')
    .update(payload)
    .eq('id', garmentId)
    .eq('organization_id', organizationId)
    .select(SELECT)
    .single()
  if (error) throw asAppError(error)
  return rowToGarment(data as unknown as GarmentRow)
}

/**
 * A time-limited signed URL for the garment's photo, or null.
 *
 * The bucket is private and stays private — no public URL is ever created.
 * Storage RLS still applies, so a caller outside the owning organization gets
 * an error, which surfaces here as null rather than a broken image.
 */
export async function getScanPhotoUrl(
  photoScanId: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  if (!supabase) return null
  const organizationId = await resolveCurrentOrgId()
  const { data: scan, error } = await supabase
    .from('photo_scans')
    .select('image_path')
    .eq('id', photoScanId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (error || !scan?.image_path) return null

  const { data, error: signError } = await supabase.storage
    .from('lab-asset-scans')
    .createSignedUrl(scan.image_path as string, expiresInSeconds)
  if (signError || !data?.signedUrl) return null
  return data.signedUrl
}
