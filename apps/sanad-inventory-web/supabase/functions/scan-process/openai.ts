// supabase/functions/scan-process/openai.ts
//
// Real clothing-recognition provider for the Photo Scan endpoint.
//
// This is the ONLY place that talks to OpenAI. handler.ts receives an
// `AnalyzeGarment` function through its Deps and never imports this module, so
// the handler stays unit-testable with a mock and no network.
//
// Transport: a direct authenticated `fetch` to POST https://api.openai.com/v1/responses
// (the Responses API) with image input + strict Structured Outputs. No SDK is
// added, so the function's Deno lockfile is unchanged.
//
// Request shape confirmed against the official docs:
//   - image part: { type: "input_image", image_url: "data:<mime>;base64,<data>", detail: "high" }
//   - structured output: text.format = { type: "json_schema", name, strict: true, schema }
//   - reasoning.effort: "none", store: false   (per this phase's spec)
//
// Privacy: image bytes, the base64 value, the API key, the Authorization header,
// the full provider response and any signed URLs are NEVER logged. On a provider
// HTTP error only `error.message` from the provider's JSON envelope is relayed
// upward — never the whole body or the request.

// ── Public types ──────────────────────────────────────────────────────

/** A downloaded, validated image handed to the provider. */
export type VisionImage = {
  bytes: Uint8Array
  /** One of the accepted image MIME types (validated by the caller). */
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
}

/** A field the model may or may not be able to read from the image. */
export type Confident = { value: string | null; confidence: number }

/** Brand additionally records the visible evidence that supports it. */
export type BrandField = Confident & { evidence: string | null }

export const FLAW_SEVERITIES = ['minor', 'moderate', 'severe'] as const
export type FlawSeverity = (typeof FLAW_SEVERITIES)[number]

export type Flaw = {
  location: string
  severity: FlawSeverity
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

/** Evidence-based clothing extraction. Unknown values are null, never guessed. */
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

/** The injected dependency handler.ts depends on. */
export type AnalyzeGarment = (image: VisionImage) => Promise<ClothingExtraction>

// ── Typed provider errors ─────────────────────────────────────────────
// handler.ts maps these to HTTP responses. None of them carry secrets.

export class OpenAIConfigError extends Error {
  constructor() {
    super('OPENAI_API_KEY is not configured')
    this.name = 'OpenAIConfigError'
  }
}
export class OpenAITimeoutError extends Error {
  constructor() {
    super('The image analysis request timed out')
    this.name = 'OpenAITimeoutError'
  }
}
export class OpenAINetworkError extends Error {
  constructor() {
    super('The image analysis service could not be reached')
    this.name = 'OpenAINetworkError'
  }
}
export class OpenAIHttpError extends Error {
  readonly status: number
  /** Only `error.message` from the provider envelope — never the whole body. */
  readonly providerMessage: string
  constructor(status: number, providerMessage: string) {
    super(`Provider returned HTTP ${status}`)
    this.name = 'OpenAIHttpError'
    this.status = status
    this.providerMessage = providerMessage
  }
}
export class OpenAIMalformedError extends Error {
  constructor() {
    super('The image analysis returned an unreadable result')
    this.name = 'OpenAIMalformedError'
  }
}
export class OpenAIRefusalError extends Error {
  constructor() {
    super('The image analysis declined to process this image')
    this.name = 'OpenAIRefusalError'
  }
}

// ── Strict JSON schema for Structured Outputs ─────────────────────────
// Built here so the shape stays in one place. Under strict:true every object
// must list every property in `required` and set additionalProperties:false.
// Nullable *values* use ["string","null"]; the one enum field cannot be
// nullable on some validators, so it carries an explicit "unknown" member that
// the mapper turns into null.

function confidentField(extra: Record<string, unknown> = {}) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['value', 'confidence', ...Object.keys(extra)],
    properties: {
      value: { type: ['string', 'null'] },
      confidence: { type: 'number' },
      ...extra,
    },
  }
}

const CONFIDENT_KEYS = [
  'garment_type',
  'main_color',
  'secondary_color',
  'pattern',
  'size_label',
  'size_system',
  'material_composition',
  'label_text',
  'style_code',
  'suggested_title',
] as const

export const CLOTHING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    ...CONFIDENT_KEYS,
    'brand',
    'visible_condition',
    'flaws',
    'style_keywords',
    'warnings',
    'needs_human_review',
  ],
  properties: {
    ...Object.fromEntries(CONFIDENT_KEYS.map((k) => [k, confidentField()])),
    brand: confidentField({ evidence: { type: ['string', 'null'] } }),
    visible_condition: {
      type: 'string',
      enum: VISIBLE_CONDITIONS,
    },
    flaws: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['location', 'severity', 'description'],
        properties: {
          location: { type: 'string' },
          severity: { type: 'string', enum: FLAW_SEVERITIES },
          description: { type: 'string' },
        },
      },
    },
    style_keywords: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
    needs_human_review: { type: 'array', items: { type: 'string' } },
  },
} as const

// ── Instruction prompt ────────────────────────────────────────────────
// Evidence-based only. Unknown -> null. Never guess brand, hidden damage,
// odour, authenticity, exact measurements, non-visible fibre composition, or
// price.

export const CLOTHING_PROMPT = [
  'You are a second-hand clothing intake assistant. Analyse ONLY what is visibly',
  'supported by this single photo. This is evidence-based cataloguing, not a guess.',
  '',
  'Rules:',
  '- If a value is not clearly visible or readable, set it to null and add the field',
  '  name to needs_human_review. Never invent or infer a value.',
  '- brand: fill only when a logo, woven/printed label, or unmistakable branding is',
  '  visible; put what you saw in brand.evidence. Otherwise brand.value = null.',
  '- material_composition and size_system: only from a visible label, else null.',
  '- visible_condition: one of excellent, good, fair, poor, broken, or unknown.',
  '- confidence: 0..1 for how sure you are the value is correct from the image.',
  '',
  'Do NOT claim: hidden damage, odours, authenticity, exact measurements, fibre',
  'composition that is not printed on a visible label, original retail price, or',
  'resale price. If asked implicitly for any of these, leave them out and warn.',
  'Add anything a human must confirm to needs_human_review, and note risks in warnings.',
].join('\n')

// ── Base64 (chunked, no dependency) ───────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

// ── Response parsing ──────────────────────────────────────────────────

/**
 * Pull the model's JSON text out of a raw /v1/responses payload.
 *
 * Primary path: walk `output[]` for the assistant `message` item and its
 * `output_text` content part (the actual HTTP shape). A top-level `output_text`
 * is only an opportunistic fallback — it is an SDK convenience, not guaranteed
 * in the raw payload. A `refusal` content part is surfaced as a refusal.
 */
export function extractOutputText(json: unknown): string {
  const root = json as { output?: unknown; output_text?: unknown }
  const output = root?.output
  if (Array.isArray(output)) {
    for (const item of output) {
      const it = item as { type?: unknown; content?: unknown }
      if (it?.type === 'message' && Array.isArray(it.content)) {
        for (const part of it.content) {
          const p = part as { type?: unknown; text?: unknown; refusal?: unknown }
          if (p?.type === 'refusal') throw new OpenAIRefusalError()
          if (p?.type === 'output_text' && typeof p.text === 'string') {
            return p.text
          }
        }
      }
    }
  }
  if (typeof root?.output_text === 'string') return root.output_text
  throw new OpenAIMalformedError()
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isConfident(v: unknown): v is Confident {
  if (!isObject(v)) return false
  const c = v as unknown as Confident
  return (
    (c.value === null || typeof c.value === 'string') &&
    // `Number.isFinite` and not `typeof === 'number'`: NaN and ±Infinity are
    // numbers. NaN in particular survives the clamp in handler.ts, averages to
    // NaN, and serialises to `null` — a field would reach the reviewer with no
    // confidence at all rather than being rejected as unreadable.
    Number.isFinite(c.confidence)
  )
}

/** Brand carries the visible evidence that supports the value. */
function isBrandField(v: unknown): v is BrandField {
  if (!isConfident(v)) return false
  const evidence = (v as BrandField).evidence
  return evidence === null || typeof evidence === 'string'
}

function isFlaw(v: unknown): v is Flaw {
  if (!isObject(v)) return false
  const f = v as unknown as Flaw
  return (
    typeof f.location === 'string' &&
    typeof f.description === 'string' &&
    (FLAW_SEVERITIES as readonly string[]).includes(f.severity)
  )
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string')
}

/**
 * Validate the parsed JSON is the shape we expect before trusting it. Strict
 * Structured Outputs should guarantee this, but a malformed or schema-mismatched
 * body must fail loudly rather than flow downstream as a real result.
 *
 * Nested values are checked too, not just the top-level keys. Everything here
 * is persisted onto `photo_scans.extracted` and the scan session summary, so an
 * element that merely *looks* like a flaw or a keyword would be stored as
 * genuine evidence about a real garment.
 */
export function parseExtraction(text: string): ClothingExtraction {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new OpenAIMalformedError()
  }
  if (!isObject(raw)) throw new OpenAIMalformedError()
  const o = raw
  for (const k of CONFIDENT_KEYS) {
    if (!isConfident(o[k])) throw new OpenAIMalformedError()
  }
  if (!isBrandField(o.brand)) throw new OpenAIMalformedError()
  if (
    typeof o.visible_condition !== 'string' ||
    !(VISIBLE_CONDITIONS as readonly string[]).includes(o.visible_condition)
  ) {
    throw new OpenAIMalformedError()
  }
  if (!Array.isArray(o.flaws) || !o.flaws.every(isFlaw)) {
    throw new OpenAIMalformedError()
  }
  for (const k of ['style_keywords', 'warnings', 'needs_human_review'] as const) {
    if (!isStringArray(o[k])) throw new OpenAIMalformedError()
  }
  return raw as unknown as ClothingExtraction
}

// ── Provider factory ──────────────────────────────────────────────────

export type OpenAIVisionOptions = {
  /** Injectable for tests. Defaults to the global fetch. */
  fetch?: typeof fetch
  /** Injectable for tests. Defaults to Deno.env.get. */
  env?: (name: string) => string | undefined
  /** Request timeout in ms. */
  timeoutMs?: number
  /** Injectable base URL for tests. */
  baseUrl?: string
}

export const DEFAULT_VISION_MODEL = 'gpt-5.6-terra'

/**
 * Builds an AnalyzeGarment backed by the OpenAI Responses API. Env is read on
 * each call (not at cold start) so a key added later is picked up on the next
 * invocation without a code change.
 */
export function createOpenAIVision(opts: OpenAIVisionOptions = {}): AnalyzeGarment {
  const doFetch = opts.fetch ?? fetch
  const getEnv = opts.env ?? ((n: string) => Deno.env.get(n))
  const timeoutMs = opts.timeoutMs ?? 45_000
  const baseUrl = opts.baseUrl ?? 'https://api.openai.com'

  return async function analyzeGarment(image: VisionImage): Promise<ClothingExtraction> {
    const apiKey = getEnv('OPENAI_API_KEY')
    if (!apiKey) throw new OpenAIConfigError()
    const model = getEnv('OPENAI_VISION_MODEL') || DEFAULT_VISION_MODEL

    const dataUrl = `data:${image.mimeType};base64,${bytesToBase64(image.bytes)}`
    const payload = {
      model,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: CLOTHING_PROMPT },
            { type: 'input_image', image_url: dataUrl, detail: 'high' },
          ],
        },
      ],
      reasoning: { effort: 'none' },
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'clothing_extraction',
          strict: true,
          schema: CLOTHING_SCHEMA,
        },
      },
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let res: Response
    try {
      res = await doFetch(`${baseUrl}/v1/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new OpenAITimeoutError()
      }
      throw new OpenAINetworkError()
    } finally {
      clearTimeout(timer)
    }

    if (!res.ok) {
      // Relay ONLY the provider's error.message (e.g. "model ... does not
      // exist"), never the whole body or our request. Model-availability issues
      // must surface exactly, not be silently swapped for another model.
      let providerMessage = ''
      try {
        const body = (await res.json()) as { error?: { message?: unknown } }
        if (typeof body?.error?.message === 'string') providerMessage = body.error.message
      } catch {
        // provider sent no JSON; leave the message blank
      }
      throw new OpenAIHttpError(res.status, providerMessage)
    }

    let json: unknown
    try {
      json = await res.json()
    } catch {
      throw new OpenAIMalformedError()
    }
    return parseExtraction(extractOutputText(json))
  }
}
