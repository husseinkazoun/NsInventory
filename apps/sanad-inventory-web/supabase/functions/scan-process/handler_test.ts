// Tests for the Photo Scan handler.
//
// No server, no socket, no Supabase, no OpenAI: `handleScanProcess` takes its
// context factory AND its vision provider as dependencies, so a fake client and
// a mock provider stand in. The fake client enforces organization scoping the
// way RLS does — a row belonging to another organization is simply not returned
// — so the tests exercise the same "invisible, therefore forbidden" logic the
// database provides.
//
// Run: deno test handler_test.ts

import { assert, assertEquals } from 'jsr:@std/assert@1'
import {
  MAX_BODY_BYTES,
  corsHeadersFor,
  detectImageMime,
  handleScanProcess,
  organizationFromImagePath,
  validateScanRequest,
  type CallerContext,
  type Deps,
} from './handler.ts'
import {
  OpenAIConfigError,
  OpenAIHttpError,
  OpenAIMalformedError,
  OpenAITimeoutError,
  type ClothingExtraction,
  type VisionImage,
} from './openai.ts'

const ORG_A = '5ada0000-0000-4000-8000-000000000001'
const ORG_B = '5bdb0000-0000-4000-8000-000000000002'
const SESSION_A = '5ada0000-0000-4000-8000-000000000041'
const SESSION_B = '5bdb0000-0000-4000-8000-000000000042'
const ASSET_A = '5ada0000-0000-4000-8000-000000000031'
const ASSET_B = '5bdb0000-0000-4000-8000-000000000032'
const PATH_A = `${ORG_A}/${SESSION_A}/photo.png`
const PATH_B = `${ORG_B}/${SESSION_B}/photo.png`
const ORIGIN = 'http://127.0.0.1:5174'
const ALLOWED = [ORIGIN, 'https://sanad-inventory.pages.dev']

// Valid image magic bytes for the happy path (JPEG).
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])

type Row = Record<string, unknown>

/** A well-formed extraction whose brand is UNKNOWN (null, flagged). */
function makeExtraction(over: Partial<ClothingExtraction> = {}): ClothingExtraction {
  const c = (value: string | null, confidence = 0.9) => ({ value, confidence })
  return {
    garment_type: c('T-shirt'),
    brand: { value: null, confidence: 0.2, evidence: null },
    main_color: c('black'),
    secondary_color: c(null),
    pattern: c(null),
    size_label: c('M'),
    size_system: c(null),
    material_composition: c(null),
    label_text: c(null),
    style_code: c(null),
    suggested_title: c('Black T-shirt, size M'),
    visible_condition: 'good',
    flaws: [],
    style_keywords: ['casual'],
    warnings: [],
    needs_human_review: ['brand'],
    ...over,
  }
}

/** A counting provider mock. `impl` may resolve an extraction or throw. */
function stubProvider(impl?: (image: VisionImage) => Promise<ClothingExtraction>) {
  let calls = 0
  const analyze = (image: VisionImage): Promise<ClothingExtraction> => {
    calls++
    return impl ? impl(image) : Promise.resolve(makeExtraction())
  }
  return { analyze, calls: () => calls }
}

function fakeContext(opts: {
  userId: string
  role: string | null
  visibleOrgs: string[]
  sessions?: Row[]
  photos?: Row[]
  assets?: Row[]
  image?: { bytes?: Uint8Array; error?: unknown }
}): CallerContext {
  const sessions = opts.sessions ?? [
    { id: SESSION_A, organization_id: ORG_A },
    { id: SESSION_B, organization_id: ORG_B },
  ]
  const photos = opts.photos ?? [
    { id: 'p1', organization_id: ORG_A, scan_session_id: SESSION_A, image_path: PATH_A },
    { id: 'p2', organization_id: ORG_B, scan_session_id: SESSION_B, image_path: PATH_B },
  ]
  const assets = opts.assets ?? [
    { id: ASSET_A, organization_id: ORG_A },
    { id: ASSET_B, organization_id: ORG_B },
  ]
  const members: Row[] = opts.role
    ? [{ organization_id: ORG_A, user_id: opts.userId, role: opts.role },
       { organization_id: ORG_B, user_id: opts.userId, role: opts.role }]
        .filter((m) => opts.visibleOrgs.includes(m.organization_id as string))
    : []

  const tables: Record<string, Row[]> = {
    scan_sessions: sessions,
    photo_scans: photos,
    lab_assets: assets,
    organization_members: members,
  }

  function query(table: string) {
    const filters: Array<[string, string]> = []
    const api = {
      eq(column: string, value: string) {
        filters.push([column, value])
        return api
      },
      maybeSingle() {
        const rows = (tables[table] ?? []).filter((row) =>
          filters.every(([c, v]) => String(row[c]) === String(v)),
        )
        const visible = rows.filter((row) => {
          const org = row.organization_id as string | undefined
          return org === undefined || opts.visibleOrgs.includes(org)
        })
        return Promise.resolve({ data: visible[0] ?? null, error: null })
      },
    }
    return api
  }

  const imageBytes = opts.image?.bytes ?? JPEG_BYTES
  const imageError = opts.image?.error ?? null

  return {
    userId: opts.userId,
    supabase: {
      from: (table: string) => ({ select: (_c: string) => query(table) }),
      storage: {
        from: (_bucket: string) => ({
          download: (_path: string) =>
            Promise.resolve(
              imageError
                ? { data: null, error: imageError }
                : { data: new Blob([imageBytes as BlobPart]), error: null },
            ),
        }),
      },
    } as unknown as CallerContext['supabase'],
  }
}

function deps(
  ctx: CallerContext | null,
  opts: {
    provider?: ReturnType<typeof stubProvider>
    maxImageBytes?: number
  } = {},
): Deps {
  const provider = opts.provider ?? stubProvider()
  return {
    createContext: () => Promise.resolve(ctx),
    allowedOrigins: ALLOWED,
    now: () => '2026-01-01T00:00:00.000Z',
    analyzeGarment: provider.analyze,
    maxImageBytes: opts.maxImageBytes,
  }
}

function post(body: unknown, origin = ORIGIN): Request {
  return new Request('https://example.test/scan-process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  })
}

const validBody = {
  scan_type: 'intake',
  scan_session_id: SESSION_A,
  image_path: PATH_A,
  lab_asset_id: null,
}

const memberOfA = () =>
  fakeContext({ userId: 'user-1', role: 'member', visibleOrgs: [ORG_A] })

// ── Authentication ────────────────────────────────────────────────────

Deno.test('missing or invalid JWT is rejected with 401', async () => {
  const res = await handleScanProcess(post(validBody), deps(null))
  assertEquals(res.status, 401)
  assertEquals((await res.json()).error, 'Unauthorized')
})

Deno.test('401 body reveals nothing about internals', async () => {
  const res = await handleScanProcess(post(validBody), deps(null))
  const text = await res.text()
  assertEquals(/token|jwt|claim|supabase|stack/i.test(text), false)
})

// ── Role matrix ───────────────────────────────────────────────────────

for (const role of ['owner', 'admin', 'member']) {
  Deno.test(`${role} may run a scan`, async () => {
    const ctx = fakeContext({ userId: 'user-1', role, visibleOrgs: [ORG_A] })
    const res = await handleScanProcess(post(validBody), deps(ctx))
    assertEquals(res.status, 200)
  })
}

Deno.test('viewer is denied with 403 and never reaches the provider', async () => {
  const provider = stubProvider()
  const ctx = fakeContext({ userId: 'user-1', role: 'viewer', visibleOrgs: [ORG_A] })
  const res = await handleScanProcess(post(validBody), deps(ctx, { provider }))
  assertEquals(res.status, 403)
  assertEquals((await res.json()).error, 'Forbidden')
  assertEquals(provider.calls(), 0)
})

Deno.test('a user with no membership is denied and never reaches the provider', async () => {
  const provider = stubProvider()
  const ctx = fakeContext({ userId: 'user-1', role: null, visibleOrgs: [ORG_A] })
  const res = await handleScanProcess(post(validBody), deps(ctx, { provider }))
  assertEquals(res.status, 403)
  assertEquals(provider.calls(), 0)
})

// ── Cross-organization ────────────────────────────────────────────────

Deno.test('a session in another organization is invisible, so 403 (no provider call)', async () => {
  const provider = stubProvider()
  const ctx = fakeContext({ userId: 'user-1', role: 'member', visibleOrgs: [ORG_A] })
  const res = await handleScanProcess(
    post({ ...validBody, scan_session_id: SESSION_B, image_path: PATH_B }),
    deps(ctx, { provider }),
  )
  assertEquals(res.status, 403)
  assertEquals(provider.calls(), 0)
})

Deno.test('an image_path naming a different organization is refused', async () => {
  const ctx = memberOfA()
  const res = await handleScanProcess(
    post({ ...validBody, image_path: `${ORG_B}/${SESSION_A}/photo.png` }),
    deps(ctx),
  )
  assertEquals(res.status, 403)
})

Deno.test('an image_path for a different session is rejected as invalid', async () => {
  const ctx = memberOfA()
  const res = await handleScanProcess(
    post({ ...validBody, image_path: `${ORG_A}/${SESSION_B}/photo.png` }),
    deps(ctx),
  )
  assertEquals(res.status, 400)
})

Deno.test('a path with no matching photo_scans row is refused (no provider call)', async () => {
  const provider = stubProvider()
  const ctx = fakeContext({
    userId: 'user-1', role: 'member', visibleOrgs: [ORG_A],
    photos: [],
  })
  const res = await handleScanProcess(post(validBody), deps(ctx, { provider }))
  assertEquals(res.status, 403)
  assertEquals(provider.calls(), 0)
})

Deno.test('an unrelated lab asset is refused', async () => {
  const ctx = memberOfA()
  const res = await handleScanProcess(
    post({ ...validBody, lab_asset_id: ASSET_B }),
    deps(ctx),
  )
  assertEquals(res.status, 403)
})

Deno.test('an asset in the caller organization is accepted', async () => {
  const ctx = memberOfA()
  const res = await handleScanProcess(
    post({ ...validBody, lab_asset_id: ASSET_A }),
    deps(ctx),
  )
  assertEquals(res.status, 200)
})

// ── Input validation ──────────────────────────────────────────────────

Deno.test('method other than POST or OPTIONS is refused', async () => {
  const req = new Request('https://example.test/scan-process', {
    method: 'GET', headers: { Origin: ORIGIN },
  })
  assertEquals((await handleScanProcess(req, deps(memberOfA()))).status, 405)
})

Deno.test('malformed JSON is refused', async () => {
  const req = new Request('https://example.test/scan-process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: '{not json',
  })
  const res = await handleScanProcess(req, deps(memberOfA()))
  assertEquals(res.status, 400)
  assertEquals((await res.json()).error, 'Invalid request')
})

Deno.test('an oversized body is refused before parsing', async () => {
  const req = new Request('https://example.test/scan-process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ ...validBody, pad: 'x'.repeat(MAX_BODY_BYTES) }),
  })
  assertEquals((await handleScanProcess(req, deps(memberOfA()))).status, 413)
})

Deno.test('unknown scan_type is refused', async () => {
  const res = await handleScanProcess(
    post({ ...validBody, scan_type: 'bogus' }), deps(memberOfA()),
  )
  assertEquals(res.status, 400)
})

Deno.test('non-uuid identifiers are refused', async () => {
  for (const body of [
    { ...validBody, scan_session_id: 'not-a-uuid' },
    { ...validBody, lab_asset_id: 'not-a-uuid' },
    { ...validBody, image_path: 'no-slashes' },
    { ...validBody, image_path: `${ORG_A}/${SESSION_A}/../escape.png` },
  ]) {
    const res = await handleScanProcess(post(body), deps(memberOfA()))
    assertEquals(res.status, 400, JSON.stringify(body))
  }
})

Deno.test('a non-object body is refused', async () => {
  for (const body of [[], 'string', 42, null]) {
    assertEquals(
      (await handleScanProcess(post(body), deps(memberOfA()))).status, 400,
    )
  }
})

Deno.test('validation errors never name the offending field', async () => {
  const res = await handleScanProcess(
    post({ ...validBody, scan_type: 'bogus' }), deps(memberOfA()),
  )
  const text = await res.text()
  assertEquals(text.includes('scan_type'), false)
  assertEquals(text.includes('bogus'), false)
})

// ── Image validation (before anything is sent externally) ─────────────

Deno.test('an unsupported image type is rejected with 415, no provider call', async () => {
  const provider = stubProvider()
  const ctx = fakeContext({
    userId: 'user-1', role: 'member', visibleOrgs: [ORG_A],
    image: { bytes: new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]) }, // not an image
  })
  const res = await handleScanProcess(post(validBody), deps(ctx, { provider }))
  assertEquals(res.status, 415)
  assertEquals(provider.calls(), 0)
})

Deno.test('an empty image is rejected with 422, no provider call', async () => {
  const provider = stubProvider()
  const ctx = fakeContext({
    userId: 'user-1', role: 'member', visibleOrgs: [ORG_A],
    image: { bytes: new Uint8Array(0) },
  })
  const res = await handleScanProcess(post(validBody), deps(ctx, { provider }))
  assertEquals(res.status, 422)
  assertEquals(provider.calls(), 0)
})

Deno.test('an oversized image is rejected with 413, no provider call', async () => {
  const provider = stubProvider()
  const ctx = fakeContext({
    userId: 'user-1', role: 'member', visibleOrgs: [ORG_A],
    image: { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]) },
  })
  // Inject a tiny limit so we exercise the guard without allocating megabytes.
  const res = await handleScanProcess(post(validBody), deps(ctx, { provider, maxImageBytes: 4 }))
  assertEquals(res.status, 413)
  assertEquals(provider.calls(), 0)
})

Deno.test('a failed image download is a retryable 502, no provider call', async () => {
  const provider = stubProvider()
  const ctx = fakeContext({
    userId: 'user-1', role: 'member', visibleOrgs: [ORG_A],
    image: { error: { message: 'not found' } },
  })
  const res = await handleScanProcess(post(validBody), deps(ctx, { provider }))
  assertEquals(res.status, 502)
  assertEquals(provider.calls(), 0)
})

Deno.test('detectImageMime recognises jpeg/png/webp and rejects others', () => {
  assertEquals(detectImageMime(new Uint8Array([0xff, 0xd8, 0xff])), 'image/jpeg')
  assertEquals(detectImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png')
  assertEquals(
    detectImageMime(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
    'image/webp',
  )
  assertEquals(detectImageMime(new Uint8Array([0x25, 0x50, 0x44, 0x46])), null) // PDF
})

// ── Real extraction (mocked provider) ─────────────────────────────────

Deno.test('a successful analysis is explicitly simulated: false', async () => {
  const res = await handleScanProcess(post(validBody), deps(memberOfA()))
  assertEquals(res.status, 200)
  const body = await res.json()
  assertEquals(body.simulated, false)
  assertEquals(body.simulation_notice, undefined)
})

Deno.test('the clothing extraction maps into the response contract', async () => {
  const res = await handleScanProcess(post(validBody), deps(memberOfA()))
  const body = await res.json()
  const fields: Array<{ label: string; value: string }> = body.extracted.fields
  const typeField = fields.find((f) => f.label === 'Type')
  assertEquals(typeField?.value, 'T-shirt')
  assertEquals(body.extracted.detected_condition, 'good')
  assertEquals(body.extracted.suggested_lab_asset.model, 'T-shirt')
  assertEquals(body.extracted.suggested_lab_asset.name, 'Black T-shirt, size M')
  // Full structured clothing payload rides along for the later schema phase.
  assertEquals(body.extracted.clothing.visible_condition, 'good')
  assertEquals(typeof body.confidence, 'number')
})

Deno.test('an unknown brand is never invented in the response', async () => {
  // Provider returned brand=null; the mapped fields must omit Brand and the
  // suggested asset must have no manufacturer.
  const res = await handleScanProcess(post(validBody), deps(memberOfA()))
  const body = await res.json()
  const labels: string[] = body.extracted.fields.map((f: { label: string }) => f.label)
  assertEquals(labels.includes('Brand'), false)
  assertEquals(body.extracted.suggested_lab_asset.manufacturer, undefined)
  assert(body.extracted.clothing.needs_human_review.includes('brand'))
})

Deno.test('an unknown visible condition maps to null, not a guess', async () => {
  const provider = stubProvider(() =>
    Promise.resolve(makeExtraction({ visible_condition: 'unknown' })),
  )
  const res = await handleScanProcess(post(validBody), deps(memberOfA(), { provider }))
  const body = await res.json()
  assertEquals(body.extracted.detected_condition, null)
})

Deno.test('every scan type returns a genuine (simulated:false) result', async () => {
  for (const scanType of ['intake', 'condition', 'missing']) {
    const res = await handleScanProcess(
      post({ ...validBody, scan_type: scanType }), deps(memberOfA()),
    )
    assertEquals(res.status, 200)
    const body = await res.json()
    assertEquals(body.simulated, false)
    assertEquals(body.scan_type, scanType)
  }
})

// ── Provider failures never become a fabricated success ───────────────

const PROVIDER_FAILURES: Array<[string, () => Promise<never>, number]> = [
  ['missing key', () => Promise.reject(new OpenAIConfigError()), 503],
  ['timeout', () => Promise.reject(new OpenAITimeoutError()), 504],
  ['rate limit (429)', () => Promise.reject(new OpenAIHttpError(429, 'rate limited')), 429],
  ['provider 5xx', () => Promise.reject(new OpenAIHttpError(503, 'boom')), 502],
  ['malformed body', () => Promise.reject(new OpenAIMalformedError()), 502],
]

for (const [label, impl, status] of PROVIDER_FAILURES) {
  Deno.test(`provider failure (${label}) -> ${status}, never a simulated success`, async () => {
    const provider = stubProvider(impl)
    const res = await handleScanProcess(post(validBody), deps(memberOfA(), { provider }))
    assertEquals(res.status, status)
    const body = await res.json()
    assertEquals(body.simulated, undefined) // no fabricated success payload
    assertEquals('extracted' in body, false)
    assert(typeof body.error === 'string')
    assertEquals(provider.calls(), 1)
  })
}

Deno.test('an unavailable model surfaces the provider message, no model swap', async () => {
  const provider = stubProvider(() =>
    Promise.reject(new OpenAIHttpError(400, "model 'gpt-5.6-terra' does not exist")),
  )
  const res = await handleScanProcess(post(validBody), deps(memberOfA(), { provider }))
  assertEquals(res.status, 502)
  const body = await res.json()
  assert(String(body.error).includes('does not exist'))
})

// ── CORS ──────────────────────────────────────────────────────────────

Deno.test('an allowed origin receives Allow-Origin and Vary', async () => {
  const res = await handleScanProcess(post(validBody), deps(memberOfA()))
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), ORIGIN)
  assertEquals(res.headers.get('Vary'), 'Origin')
})

Deno.test('a disallowed origin gets no Allow-Origin header', async () => {
  const res = await handleScanProcess(
    post(validBody, 'https://evil.example.com'), deps(memberOfA()),
  )
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), null)
  assertEquals(res.headers.get('Vary'), 'Origin')
})

Deno.test('preflight from an allowed origin returns 204 with the methods', async () => {
  const req = new Request('https://example.test/scan-process', {
    method: 'OPTIONS', headers: { Origin: ORIGIN },
  })
  const res = await handleScanProcess(req, deps(memberOfA()))
  assertEquals(res.status, 204)
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), ORIGIN)
  assertEquals(res.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS')
})

Deno.test('preflight from a disallowed origin is not granted', async () => {
  const req = new Request('https://example.test/scan-process', {
    method: 'OPTIONS', headers: { Origin: 'https://evil.example.com' },
  })
  const res = await handleScanProcess(req, deps(memberOfA()))
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), null)
})

Deno.test('corsHeadersFor never echoes an unlisted origin', () => {
  assertEquals(
    corsHeadersFor('https://evil.example.com', ALLOWED)['Access-Control-Allow-Origin'],
    undefined,
  )
  assertEquals(corsHeadersFor(null, ALLOWED)['Vary'], 'Origin')
})

// ── Validation helpers, directly ───────────────────────────────────────

Deno.test('validateScanRequest accepts a well-formed body', () => {
  const result = validateScanRequest(validBody)
  assertEquals(result.ok, true)
})

Deno.test('organizationFromImagePath reads the leading segment', () => {
  assertEquals(organizationFromImagePath(PATH_A), ORG_A)
  assertEquals(organizationFromImagePath('nope'), null)
})

// ── No secrets in the response ────────────────────────────────────────

Deno.test('no secret, token or key appears in a successful response', async () => {
  const res = await handleScanProcess(post(validBody), deps(memberOfA()))
  const text = await res.text()
  for (const forbidden of ['SERVICE_ROLE', 'apikey', 'Bearer', 'sk-', 'eyJ']) {
    assertEquals(text.includes(forbidden), false, forbidden)
  }
})
