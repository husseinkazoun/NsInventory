// supabase/functions/scan-process/handler.ts
//
// Request handling for the Photo Scan endpoint, with no I/O of its own.
//
// Everything the handler needs — the Supabase context factory, the CORS
// allowlist, the clock — arrives through `Deps`, so the whole surface is
// testable without starting a server, opening a socket, or reaching Supabase.
// `index.ts` supplies the real implementations.
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
// The extraction is still deterministic and fabricated. It is labelled
// `simulated: true` so no caller can mistake it for image analysis.

export const SCAN_TYPES = ['intake', 'condition', 'missing'] as const
export type ScanType = (typeof SCAN_TYPES)[number]

/** Request bodies here are small JSON documents; anything larger is refused. */
export const MAX_BODY_BYTES = 4096

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
  now?: () => string
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

// ── Simulated extraction ──────────────────────────────────────────────
// Deterministic placeholder output. `simulated: true` travels with it so the
// UI can say plainly that no image was analysed. Field-level numbers are
// deliberately NOT called confidence anywhere user-facing.

type Extracted = {
  fields?: { label: string; value: string; confidence: number }[]
  detected_condition?: string | null
  missing_components?: { component_name: string; severity: string }[]
  suggested_lab_asset?: Record<string, string>
}

const SIMULATED: Record<ScanType, Extracted> = {
  intake: {
    fields: [
      { label: 'Manufacturer', value: 'Eppendorf', confidence: 0.94 },
      { label: 'Model', value: 'MX-9', confidence: 0.89 },
      { label: 'Serial', value: '87XJ-3401K', confidence: 0.72 },
      { label: 'Asset class', value: 'Centrifuge', confidence: 0.91 },
    ],
    detected_condition: 'good',
    // No `tag` is suggested. A constant tag collided with the
    // unique (organization_id, tag) constraint on the second intake scan in
    // any organization; the client now derives a per-session tag instead.
    suggested_lab_asset: {
      name: 'Centrifuge (simulated intake)',
      manufacturer: 'Eppendorf',
      model: 'MX-9',
      serial: '87XJ-3401K',
    },
  },
  condition: {
    fields: [
      { label: 'Visible wear', value: 'Moderate', confidence: 0.81 },
      { label: 'Surface damage', value: 'None', confidence: 0.93 },
      { label: 'Cable integrity', value: 'Intact', confidence: 0.86 },
      { label: 'Calibration label', value: 'Expires 2026-12-15', confidence: 0.74 },
    ],
    detected_condition: 'good',
  },
  missing: {
    fields: [
      { label: 'Components expected', value: '7', confidence: 1.0 },
      { label: 'Components detected', value: '5', confidence: 0.88 },
    ],
    missing_components: [
      { component_name: 'Power cable', severity: 'minor' },
      { component_name: 'Spare rotor', severity: 'medium' },
    ],
  },
}

function aggregateScore(extracted: Extracted): number {
  const fields = extracted.fields ?? []
  if (fields.length === 0) return 0.85
  const sum = fields.reduce(
    (acc, f) => acc + Math.max(0, Math.min(1, f.confidence)),
    0,
  )
  return Math.round((sum / fields.length) * 1000) / 1000
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

  // ── Simulated extraction ──
  const extracted = SIMULATED[request.scan_type]
  const now = deps.now ? deps.now() : new Date().toISOString()

  return new Response(
    JSON.stringify({
      scan_session_id: request.scan_session_id,
      scan_type: request.scan_type,
      // Not a measurement of anything. Kept for response-shape compatibility;
      // `simulated` is what callers should branch on.
      confidence: aggregateScore(extracted),
      simulated: true,
      simulation_notice:
        'Simulated analysis — no image AI was used. These values are fabricated.',
      extracted,
      generated_at: now,
    }),
    { headers: { 'Content-Type': 'application/json', ...cors } },
  )
}
