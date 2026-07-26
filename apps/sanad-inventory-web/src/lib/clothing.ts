// Clothing extraction shapes and the editable draft the review step binds to.
//
// WHY THIS EXISTS SEPARATELY FROM `fields`
// ---------------------------------------
// The Edge Function returns two views of the same analysis:
//
//   extracted.fields    — a display list, built by handler.ts's mapExtraction,
//                         which SKIPS any field the model could not read
//                         (`if (f.value != null && f.value !== '')`).
//   extracted.clothing  — the full structured extraction, every key present,
//                         unread values explicitly null.
//
// A form built from `fields` therefore cannot show an empty, editable Brand
// box when the label was unreadable — the key simply is not there. The review
// step binds to `clothing` for values and uses `fields` only for the
// confidence badges. This is a client-side parse concern only; the verified
// Edge Function contract is unchanged.
//
// The types mirror `supabase/functions/scan-process/openai.ts`. They are
// re-declared rather than imported because that module is Deno code outside
// the Vite/tsc build (`tsconfig` includes `src` only).

export type Confident = { value: string | null; confidence: number }
export type BrandField = Confident & { evidence: string | null }

export type Flaw = {
  location: string
  severity: 'minor' | 'moderate' | 'severe'
  description: string
}

export const VISIBLE_CONDITIONS = [
  'excellent',
  'good',
  'fair',
  'poor',
  'broken',
  'unknown',
] as const
export type VisibleCondition = (typeof VISIBLE_CONDITIONS)[number]

export type ClothingExtraction = {
  garment_type: Confident
  brand: BrandField
  main_color: Confident
  secondary_color: Confident
  pattern: Confident
  size_label: Confident
  size_system: Confident
  material_composition: Confident
  label_text: Confident
  style_code: Confident
  suggested_title: Confident
  visible_condition: VisibleCondition
  flaws: Flaw[]
  style_keywords: string[]
  warnings: string[]
  needs_human_review: string[]
}

/** Listing lifecycle — mirrors public.garment_listing_status. */
export const LISTING_STATUSES = [
  'draft',
  'ready',
  'listed',
  'reserved',
  'sold',
  'withdrawn',
] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]

/**
 * The values the reviewer edits.
 *
 * Every text field is a plain string, empty rather than null, because that is
 * what a controlled input needs. The empty string is converted back to SQL
 * NULL at the database boundary (`nullif(..., '')` in create_garment_asset),
 * so "the AI could not read this and the human did not fill it in" is stored
 * as NULL and never as an empty string pretending to be a value.
 */
export type GarmentDraft = {
  title: string
  garment_type: string
  brand: string
  size_label: string
  size_system: string
  material: string
  primary_color: string
  secondary_color: string
  pattern: string
  condition_notes: string
  sku: string
  notes: string
  listing_status: ListingStatus
  purchase_cost: string
  selling_price: string
}

/** Which draft keys the review step exposes, in display order. */
export type GarmentFieldSpec = {
  key: keyof GarmentDraft
  label: string
  /** Key in ClothingExtraction that supplied it, for the confidence badge. */
  source: keyof ClothingExtraction | null
  placeholder?: string
}

export const GARMENT_REVIEW_FIELDS: GarmentFieldSpec[] = [
  { key: 'title', label: 'Item name', source: 'suggested_title' },
  { key: 'garment_type', label: 'Type', source: 'garment_type' },
  { key: 'brand', label: 'Brand', source: 'brand', placeholder: 'Not readable' },
  { key: 'size_label', label: 'Size', source: 'size_label' },
  { key: 'size_system', label: 'Size system', source: 'size_system' },
  { key: 'material', label: 'Material', source: 'material_composition' },
  { key: 'primary_color', label: 'Main color', source: 'main_color' },
  { key: 'secondary_color', label: 'Secondary color', source: 'secondary_color' },
  { key: 'pattern', label: 'Pattern', source: 'pattern' },
]

function text(f: Confident | undefined | null): string {
  return f && typeof f.value === 'string' ? f.value : ''
}

function score(f: Confident | undefined | null): number | null {
  if (!f || typeof f.confidence !== 'number' || !Number.isFinite(f.confidence)) {
    return null
  }
  // A confidence attached to a value the model could not read describes
  // nothing the reviewer can act on, so no badge is shown for it.
  return f.value == null || f.value === '' ? null : f.confidence
}

/**
 * Builds the editable draft from a real extraction.
 *
 * Unread fields become empty strings — present in the form, editable, and
 * visibly blank. Nothing is guessed or defaulted to a plausible value.
 */
export function draftFromExtraction(
  clothing: ClothingExtraction | null | undefined,
): GarmentDraft {
  const c = clothing ?? null
  return {
    title: c ? text(c.suggested_title) : '',
    garment_type: c ? text(c.garment_type) : '',
    brand: c ? text(c.brand) : '',
    size_label: c ? text(c.size_label) : '',
    size_system: c ? text(c.size_system) : '',
    material: c ? text(c.material_composition) : '',
    primary_color: c ? text(c.main_color) : '',
    secondary_color: c ? text(c.secondary_color) : '',
    pattern: c ? text(c.pattern) : '',
    condition_notes: '',
    sku: '',
    notes: '',
    listing_status: 'draft',
    purchase_cost: '',
    selling_price: '',
  }
}

/** Per-field confidence for the review badges. Null where nothing was read. */
export function confidenceFromExtraction(
  clothing: ClothingExtraction | null | undefined,
): Partial<Record<keyof GarmentDraft, number | null>> {
  if (!clothing) return {}
  const out: Partial<Record<keyof GarmentDraft, number | null>> = {}
  for (const spec of GARMENT_REVIEW_FIELDS) {
    if (!spec.source) continue
    out[spec.key] = score(
      clothing[spec.source] as Confident | undefined,
    )
  }
  return out
}

/**
 * Fields the model flagged for human confirmation, mapped to draft keys so the
 * review step can mark them. Unknown names are ignored rather than dropped
 * silently into a lookup that would throw.
 */
const SOURCE_TO_DRAFT: Record<string, keyof GarmentDraft> = {
  suggested_title: 'title',
  garment_type: 'garment_type',
  brand: 'brand',
  size_label: 'size_label',
  size_system: 'size_system',
  material_composition: 'material',
  main_color: 'primary_color',
  secondary_color: 'secondary_color',
  pattern: 'pattern',
}

export function needsReviewKeys(
  clothing: ClothingExtraction | null | undefined,
): Set<keyof GarmentDraft> {
  const out = new Set<keyof GarmentDraft>()
  if (!clothing || !Array.isArray(clothing.needs_human_review)) return out
  for (const name of clothing.needs_human_review) {
    const key = SOURCE_TO_DRAFT[name]
    if (key) out.add(key)
  }
  return out
}

/**
 * The AI's visible_condition mapped onto the asset condition scale.
 * 'unknown' becomes null so the reviewer chooses rather than inheriting a
 * guess. Mirrors handler.ts's mapExtraction.
 */
export type AssetConditionValue = 'excellent' | 'good' | 'fair' | 'poor' | 'broken'

export function conditionFromExtraction(
  clothing: ClothingExtraction | null | undefined,
): AssetConditionValue | null {
  const v = clothing?.visible_condition
  if (!v || v === 'unknown') return null
  return v
}
