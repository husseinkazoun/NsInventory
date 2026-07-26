import { describe, expect, it } from 'vitest'
import {
  GARMENT_REVIEW_FIELDS,
  conditionFromExtraction,
  confidenceFromExtraction,
  draftFromExtraction,
  needsReviewKeys,
  type ClothingExtraction,
} from './clothing'

/**
 * A realistic extraction: some fields read, some explicitly unreadable.
 *
 * `brand` being null with `needs_human_review: ['brand']` is the case the
 * review form exists for — the Edge Function's `fields` list drops it
 * entirely, so a form built from `fields` could not offer a box to fill in.
 */
function extraction(over: Partial<ClothingExtraction> = {}): ClothingExtraction {
  const c = (value: string | null, confidence = 0.9) => ({ value, confidence })
  return {
    garment_type: c('Jacket', 0.93),
    brand: { value: null, confidence: 0.1, evidence: null },
    main_color: c('navy', 0.88),
    secondary_color: c(null, 0.2),
    pattern: c(null, 0.3),
    size_label: c('M', 0.81),
    size_system: c(null, 0.1),
    material_composition: c(null, 0.15),
    label_text: c(null, 0.1),
    style_code: c(null, 0.1),
    suggested_title: c('Navy jacket, size M', 0.86),
    visible_condition: 'good',
    flaws: [],
    style_keywords: ['casual'],
    warnings: [],
    needs_human_review: ['brand', 'material_composition'],
    ...over,
  }
}

describe('draftFromExtraction', () => {
  it('carries the values the model actually read', () => {
    const d = draftFromExtraction(extraction())
    expect(d.garment_type).toBe('Jacket')
    expect(d.primary_color).toBe('navy')
    expect(d.size_label).toBe('M')
    expect(d.title).toBe('Navy jacket, size M')
  })

  it('turns an unreadable field into an empty, editable string — not a guess', () => {
    const d = draftFromExtraction(extraction())
    // The whole point: present in the draft, editable, and blank.
    expect(d.brand).toBe('')
    expect(d.material).toBe('')
    expect(d.pattern).toBe('')
    expect(d.secondary_color).toBe('')
  })

  it('never invents a value for a field the AI could not read', () => {
    const d = draftFromExtraction(extraction())
    for (const key of ['brand', 'material', 'pattern', 'size_system'] as const) {
      expect(d[key]).toBe('')
      expect(d[key]).not.toMatch(/unknown|n\/a|none|null/i)
    }
  })

  it('exposes every review field as a draft key, so none is unreachable', () => {
    const d = draftFromExtraction(extraction())
    for (const spec of GARMENT_REVIEW_FIELDS) {
      expect(d).toHaveProperty(spec.key)
      expect(typeof d[spec.key]).toBe('string')
    }
  })

  it('produces an all-empty draft when there is no extraction at all', () => {
    const d = draftFromExtraction(null)
    for (const spec of GARMENT_REVIEW_FIELDS) {
      expect(d[spec.key]).toBe('')
    }
    // Commercial fields are the reviewer's to fill in; they are never guessed.
    expect(d.purchase_cost).toBe('')
    expect(d.selling_price).toBe('')
    expect(d.listing_status).toBe('draft')
  })
})

describe('confidenceFromExtraction', () => {
  it('reports the score for fields that were read', () => {
    const conf = confidenceFromExtraction(extraction())
    expect(conf.garment_type).toBeCloseTo(0.93)
    expect(conf.size_label).toBeCloseTo(0.81)
  })

  it('reports null for an unread field rather than a misleading low score', () => {
    // The model returns confidence 0.1 alongside brand=null. Showing "10%"
    // would imply it read something it did not.
    const conf = confidenceFromExtraction(extraction())
    expect(conf.brand).toBeNull()
    expect(conf.material).toBeNull()
  })

  it('rejects a non-finite confidence instead of rendering NaN%', () => {
    const conf = confidenceFromExtraction(
      extraction({ garment_type: { value: 'Shirt', confidence: NaN } }),
    )
    expect(conf.garment_type).toBeNull()
  })

  it('is empty when there is no extraction', () => {
    expect(confidenceFromExtraction(null)).toEqual({})
  })
})

describe('needsReviewKeys', () => {
  it('maps the model’s field names onto draft keys', () => {
    const flagged = needsReviewKeys(extraction())
    expect(flagged.has('brand')).toBe(true)
    expect(flagged.has('material')).toBe(true)
    expect(flagged.has('garment_type')).toBe(false)
  })

  it('ignores names it does not recognise rather than throwing', () => {
    const flagged = needsReviewKeys(
      extraction({ needs_human_review: ['brand', 'not_a_real_field'] }),
    )
    expect(flagged.has('brand')).toBe(true)
    expect(flagged.size).toBe(1)
  })

  it('tolerates a missing or malformed list', () => {
    expect(
      needsReviewKeys(extraction({ needs_human_review: undefined as never })).size,
    ).toBe(0)
    expect(needsReviewKeys(null).size).toBe(0)
  })
})

describe('conditionFromExtraction', () => {
  it('passes a readable condition through', () => {
    expect(conditionFromExtraction(extraction())).toBe('good')
    expect(
      conditionFromExtraction(extraction({ visible_condition: 'poor' })),
    ).toBe('poor')
  })

  it('maps "unknown" to null so the reviewer chooses instead of inheriting a guess', () => {
    expect(
      conditionFromExtraction(extraction({ visible_condition: 'unknown' })),
    ).toBeNull()
  })

  it('is null with no extraction', () => {
    expect(conditionFromExtraction(null)).toBeNull()
  })
})
