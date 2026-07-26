// supabase/functions/scan-process/handler.ts
//
// Request handling for the Photo Scan endpoint, with no I/O of its own.
//
// Everything the handler needs — the Supabase context factory, the CORS
// allowlist, the vision provider, the clock — arrives through `Deps`, so the
// whole surface is testable without starting a server, opening a socket, or
// reaching Supabase or OpenAI. `index.ts` supplies the real implementations.
//
// SECURITY MODEL
// --------------
// Two layers, per the Supabase "Securing Edge Functions" guidance:
//
//   1. Platform: `verify_jwt = true` (the default, and set explicitly in
//      config.toml). A request without a valid user JWT never reaches this
//      code.
//   2. Handler: authorization. A valid JWT only proves *who* the caller is;
//      it says nothing about which organization's data they may touch.
//
// Every authorization read goes through the caller-scoped client, so RLS is
// the thing enforcing tenancy. A service-role client is never used to decide
// what the caller may do — with RLS bypassed, a cross-organization identifier
// would simply resolve, and the check would pass.
//
// The image is downloaded and sent to OpenAI ONLY after the full authorization
// sequence passes. The extraction is now genuine (`simulated: false`); the
// simulated fixtures live in the frontend's demo mode, not here.

import {
  type AnalyzeGarment,
  type ClothingExtraction,
  type Confident,
  OpenAIConfigError,
  OpenAIHttpError,
  OpenAINetworkError,
  OpenAITimeoutError,
} from './openai.ts'

export const SCAN_TYPES = ['intake', 'condition', 'missing'] as const
export type ScanType = (typeof SCAN_TYPES)[number]

/** Request bodies here are small JSON documents; anything larger is refused. */
export const MAX_BODY_BYTES = 4096

/** Application limit on the downloaded image, independent of Storage limits. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// '{organization_id}/{scan_session_id}/{filename}', matching the convention
// public.scan_object_org() parses for the Storage policies.
const IMAGE_PATH_RE =
  /^([0-9a-f-]{36})\/([0-9a-f-]{36})\/([A-Za-z0-9._-]{1,128})$/i

/** Roles permitted to run a scan. Mirrors the database role matrix. */
export const WRITE_ROLES = ['owner', 'admin', 'member'] as const

export type ScanRequest = {
  scan_type: ScanType
  scan_session_id: string
  image_path: string
  lab_asset_id: string | null
}

export type CallerContext = {
  /** Supabase client scoped to the caller — RLS applies to every query. */
  supabase: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => any
      }
    }
    /**
     * Storage is used to download the private scan image. The concrete client
     * has it; this structural type only lists what the handler touches. Because
     * index.ts casts the real client through `as unknown`, the presence of
     * `storage` is asserted rather than proven — the handler guards it at
     * runtime before use.
     */
    storage: {
      from: (bucket: string) => {
        download: (path: string) => Promise<{ data: Blob | null; error: unknown }>
      }
    }
  }
  userId: string
}

export type Deps = {
  /**
   * Resolves the caller. Returns `null` when the credential is missing or
   * invalid; the platform normally rejects those first, but the handler does
   * not assume the platform check ran.
   */
  createContext: (req: Request) => Promise<CallerContext | null>
  allowedOrigins: string[]
  /** Real clothing analysis. A mock stands in for it in tests. */
  analyzeGarment: AnalyzeGarment
  now?: () => string
  /** Overridable image size limit (bytes) for tests. */
  maxImageBytes?: number
}

// ── CORS ──────────────────────────────────────────────────────────────
// `Vary: Origin` is always sent: the response differs per origin, so a cache
// must not reuse one origin's response for another.

export function corsHeadersFor(
  origin: string | null,
  allowed: string[],
): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' }
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    headers['Access-Control-Allow-Headers'] =
      'authorization, x-client-info, apikey, content-type'
    headers['Access-Control-Max-Age'] = '86400'
  }
  return headers
}

/** Error bodies are deliberately uniform and reveal nothing about internals. */
function fail(
  status: number,
  message: string,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
}

// ── Validation ────────────────────────────────────────────────────────

export type ValidationResult =
  | { ok: true; value: ScanRequest }
  | { ok: false }

export function validateScanRequest(raw: unknown): ValidationResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false }
  }
  const body = raw as Record<string, unknown>

  const scanType = body.scan_type
  if (typeof scanType !== 'string') return { ok: false }
  if (!(SCAN_TYPES as readonly string[]).includes(scanType)) return { ok: false }

  const sessionId = body.scan_session_id
  if (typeof sessionId !== 'string' || !UUID_RE.test(sessionId)) {
    return { ok: false }
  }

  const imagePath = body.image_path
  if (typeof imagePath !== 'string') return { ok: false }
  const match = IMAGE_PATH_RE.exec(imagePath)
  if (!match) return { ok: false }
  const [, pathOrg, pathSession] = match
  if (!UUID_RE.test(pathOrg) || !UUID_RE.test(pathSession)) return { ok: false }
  // The path must name the same session the body does; otherwise a caller
  // could pair their own session id with someone else's object key.
  if (pathSession.toLowerCase() !== sessionId.toLowerCase()) return { ok: false }

  const labAssetId = body.lab_asset_id
  if (
    labAssetId !== undefined &&
    labAssetId !== null &&
    (typeof labAssetId !== 'string' || !UUID_RE.test(labAssetId))
  ) {
    return { ok: false }
  }

  return {
    ok: true,
    value: {
      scan_type: scanType as ScanType,
      scan_session_id: sessionId,
      image_path: imagePath,
      lab_asset_id: typeof labAssetId === 'string' ? labAssetId : null,
    },
  }
}

export function organizationFromImagePath(imagePath: string): string | null {
  const match = IMAGE_PATH_RE.exec(imagePath)
  return match ? match[1] : null
}

// ── Image inspection ──────────────────────────────────────────────────
// MIME is detected from magic bytes, never trusted from a header or filename.

export type AcceptedMime = 'image/jpeg' | 'image/png' | 'image/webp'

export function detectImageMime(bytes: Uint8Array): AcceptedMime | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png'
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return 'image/webp'
  }
  return null
}

// ── Mapping: clothing extraction -> response contract ─────────────────
// The existing frontend consumes `fields`, `detected_condition` and
// `suggested_lab_asset`. The full structured clothing payload rides along in
// `extracted.clothing` for the later clothing-schema phase.

export type ExtractedField = { label: string; value: string; confidence: number }

export type MappedExtracted = {
  fields: ExtractedField[]
  detected_condition: string | null
  suggested_lab_asset: Record<string, string>
  clothing: ClothingExtraction
}

// The parser already rejects a non-finite confidence, so this is defence in
// depth: NaN survives both Math.min and Math.max, and JSON.stringify turns it
// into `null` — a field would reach the reviewer carrying no score at all.
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function mapExtraction(c: ClothingExtraction): {
  extracted: MappedExtracted
  confidence: number
} {
  const fields: ExtractedField[] = []
  const push = (label: string, f: Confident) => {
    if (f && f.value != null && f.value !== '') {
      fields.push({ label, value: f.value, confidence: clamp01(f.confidence) })
    }
  }
  push('Type', c.garment_type)
  push('Brand', c.brand)
  push('Main color', c.main_color)
  push('Secondary color', c.secondary_color)
  push('Pattern', c.pattern)
  push('Size', c.size_label)
  push('Size system', c.size_system)
  push('Material', c.material_composition)
  push('Style code', c.style_code)
  push('Label text', c.label_text)

  // Only the five allowed conditions reach the client; 'unknown' becomes null.
  const detected_condition =
    c.visible_condition === 'unknown' ? null : c.visible_condition

  // Temporary mapping onto the lab_assets columns (no schema change this phase):
  //   name <- title, manufacturer <- brand, model <- garment type, serial <- style code.
  const suggested: Record<string, string> = {}
  const name = c.suggested_title.value?.trim() || c.garment_type.value?.trim()
  if (name) suggested.name = name
  if (c.brand.value) suggested.manufacturer = c.brand.value
  if (c.garment_type.value) suggested.model = c.garment_type.value
  if (c.style_code.value) suggested.serial = c.style_code.value

  const confidence =
    fields.length === 0
      ? 0
      : Math.round(
          (fields.reduce((a, f) => a + f.confidence, 0) / fields.length) * 1000,
        ) / 1000

  return {
    extracted: {
      fields,
      detected_condition,
      suggested_lab_asset: suggested,
      clothing: c,
    },
    confidence,
  }
}

/** Maps a typed provider error to a safe, retryable HTTP response. */
function providerErrorResponse(
  err: unknown,
  cors: Record<string, string>,
): Response {
  if (err instanceof OpenAIConfigError) {
    return fail(503, 'Image analysis is not configured', cors)
  }
  if (err instanceof OpenAITimeoutError || err instanceof OpenAINetworkError) {
    return fail(504, 'Image analysis timed out. Please try again.', cors)
  }
  if (err instanceof OpenAIHttpError) {
    if (err.status === 429) {
      return fail(429, 'Image analysis is busy. Please try again shortly.', cors)
    }
    if (err.status >= 500) {
      return fail(502, 'Image analysis failed. Please try again.', cors)
    }
    // A provider 4xx (e.g. the configured model is unavailable) surfaces the
    // provider's own message — and only that message, never the whole body —
    // so the model is never silently swapped.
    const detail = err.providerMessage ? `: ${err.providerMessage}` : ''
    return fail(502, `Image analysis rejected the request${detail}`, cors)
  }
  // Malformed body, refusal, or anything unrecognised.
  return fail(
    502,
    'Image analysis returned an unreadable result. Please try again.',
    cors,
  )
}

// ── Handler ───────────────────────────────────────────────────────────

export async function handleScanProcess(
  req: Request,
  deps: Deps,
): Promise<Response> {
  const origin = req.headers.get('Origin')
  const cors = corsHeadersFor(origin, deps.allowedOrigins)

  // Preflight. A disallowed origin gets no Allow-Origin header, so the browser
  // blocks the real request; `Vary: Origin` still goes out.
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }
  if (req.method !== 'POST') {
    return fail(405, 'Method not allowed', cors)
  }

  const declaredLength = Number(req.headers.get('Content-Length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return fail(413, 'Payload too large', cors)
  }

  const rawBody = await req.text()
  if (rawBody.length > MAX_BODY_BYTES) {
    return fail(413, 'Payload too large', cors)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return fail(400, 'Invalid request', cors)
  }

  const validated = validateScanRequest(parsed)
  if (!validated.ok) {
    // One generic message for every validation failure: which field was wrong
    // is not information an unauthenticated-ish caller needs.
    return fail(400, 'Invalid request', cors)
  }
  const request = validated.value

  // ── Authentication ──
  const ctx = await deps.createContext(req)
  if (!ctx) return fail(401, 'Unauthorized', cors)

  // ── Authorization, entirely through the caller-scoped client ──
  // RLS is doing the work: a row belonging to another organization is simply
  // not visible, so "not found" and "not yours" are the same outcome, and the
  // response cannot be used to probe for existence.
  const sessionQuery = await ctx.supabase
    .from('scan_sessions')
    .select('id, organization_id')
    .eq('id', request.scan_session_id)
    .maybeSingle()
  if (sessionQuery.error) return fail(403, 'Forbidden', cors)
  const session = sessionQuery.data as
    | { id: string; organization_id: string }
    | null
  if (!session) return fail(403, 'Forbidden', cors)

  const organizationId = session.organization_id

  // The object key must name the same organization that owns the session.
  if (organizationFromImagePath(request.image_path)?.toLowerCase() !==
      organizationId.toLowerCase()) {
    return fail(403, 'Forbidden', cors)
  }

  // A photo_scans row must already exist for this exact session and key.
  const photoQuery = await ctx.supabase
    .from('photo_scans')
    .select('id, organization_id, scan_session_id')
    .eq('scan_session_id', request.scan_session_id)
    .eq('image_path', request.image_path)
    .maybeSingle()
  if (photoQuery.error) return fail(403, 'Forbidden', cors)
  const photo = photoQuery.data as
    | { id: string; organization_id: string; scan_session_id: string }
    | null
  if (!photo) return fail(403, 'Forbidden', cors)
  if (photo.organization_id !== organizationId) {
    return fail(403, 'Forbidden', cors)
  }

  // An explicitly named asset must belong to the same organization.
  if (request.lab_asset_id) {
    const assetQuery = await ctx.supabase
      .from('lab_assets')
      .select('id, organization_id')
      .eq('id', request.lab_asset_id)
      .maybeSingle()
    if (assetQuery.error) return fail(403, 'Forbidden', cors)
    const asset = assetQuery.data as
      | { id: string; organization_id: string }
      | null
    if (!asset || asset.organization_id !== organizationId) {
      return fail(403, 'Forbidden', cors)
    }
  }

  // ── Role matrix: owner/admin/member may scan; viewer may not ──
  const membershipQuery = await ctx.supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', ctx.userId)
    .maybeSingle()
  if (membershipQuery.error) return fail(403, 'Forbidden', cors)
  const membership = membershipQuery.data as { role: string } | null
  if (!membership) return fail(403, 'Forbidden', cors)
  if (!(WRITE_ROLES as readonly string[]).includes(membership.role)) {
    return fail(403, 'Forbidden', cors)
  }

  // ─────────────────────────────────────────────────────────────────────
  // Everything past this point runs ONLY for an authenticated caller who is a
  // member of the owning organization with a write role. No image is
  // downloaded or sent to OpenAI before here.
  // ─────────────────────────────────────────────────────────────────────

  // ── Download the private image via the caller-scoped client ──
  // RLS on storage.objects applies. The bucket stays private; no public URL is
  // ever created. `storage` is asserted by the type but guarded at runtime.
  const storage = ctx.supabase.storage
  if (!storage || typeof storage.from !== 'function') {
    return fail(500, 'Image could not be retrieved', cors)
  }
  const download = await storage.from('lab-asset-scans').download(request.image_path)
  if (download.error || !download.data) {
    return fail(502, 'Image could not be retrieved', cors)
  }
  const bytes = new Uint8Array(await download.data.arrayBuffer())

  // ── Validate before sending anything externally ──
  // Generic messages only — no path, token, or internal detail is exposed.
  if (bytes.length === 0) return fail(422, 'Invalid image', cors)
  const maxBytes = deps.maxImageBytes ?? MAX_IMAGE_BYTES
  if (bytes.length > maxBytes) return fail(413, 'Image too large', cors)
  const mimeType = detectImageMime(bytes)
  if (!mimeType) return fail(415, 'Unsupported image type', cors)

  // ── Real clothing analysis ──
  let extraction: ClothingExtraction
  try {
    extraction = await deps.analyzeGarment({ bytes, mimeType })
  } catch (err) {
    // Provider failures never become a fabricated success.
    return providerErrorResponse(err, cors)
  }

  const { extracted, confidence } = mapExtraction(extraction)
  const now = deps.now ? deps.now() : new Date().toISOString()

  return new Response(
    JSON.stringify({
      scan_session_id: request.scan_session_id,
      scan_type: request.scan_type,
      confidence,
      simulated: false,
      extracted,
      generated_at: now,
    }),
    { headers: { 'Content-Type': 'application/json', ...cors } },
  )
}
