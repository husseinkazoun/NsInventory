// Tests for the Photo Scan handler.
//
// No server, no socket, no Supabase: `handleScanProcess` takes its context
// factory as a dependency, so a fake stands in for the caller-scoped client.
// The fake enforces organization scoping the way RLS does — a row belonging
// to another organization is simply not returned — so the tests exercise the
// same "invisible, therefore forbidden" logic the database provides.
//
// Run: deno test supabase/functions/scan-process/handler_test.ts

import { assertEquals } from 'jsr:@std/assert@1'
import {
  MAX_BODY_BYTES,
  corsHeadersFor,
  handleScanProcess,
  organizationFromImagePath,
  validateScanRequest,
  type CallerContext,
  type Deps,
} from './handler.ts'

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

type Row = Record<string, unknown>

/**
 * Stands in for the caller-scoped Supabase client.
 *
 * `visibleOrgs` mimics RLS: rows outside those organizations are withheld, so
 * a cross-organization identifier resolves to null exactly as it would in
 * Postgres.
 */
function fakeContext(opts: {
  userId: string
  role: string | null
  visibleOrgs: string[]
  sessions?: Row[]
  photos?: Row[]
  assets?: Row[]
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
      // `maybeSingle` is where the fake resolves; RLS visibility is applied
      // here so callers see null rather than a foreign row.
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

  return {
    userId: opts.userId,
    supabase: {
      from: (table: string) => ({ select: (_c: string) => query(table) }),
    } as unknown as CallerContext['supabase'],
  }
}

function deps(ctx: CallerContext | null): Deps {
  return {
    createContext: () => Promise.resolve(ctx),
    allowedOrigins: ALLOWED,
    now: () => '2026-01-01T00:00:00.000Z',
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

Deno.test('viewer is denied with 403', async () => {
  const ctx = fakeContext({ userId: 'user-1', role: 'viewer', visibleOrgs: [ORG_A] })
  const res = await handleScanProcess(post(validBody), deps(ctx))
  assertEquals(res.status, 403)
  assertEquals((await res.json()).error, 'Forbidden')
})

Deno.test('a user with no membership is denied', async () => {
  const ctx = fakeContext({ userId: 'user-1', role: null, visibleOrgs: [ORG_A] })
  assertEquals((await handleScanProcess(post(validBody), deps(ctx))).status, 403)
})

// ── Cross-organization ────────────────────────────────────────────────

Deno.test('a session in another organization is invisible, so 403', async () => {
  // Member of A only, asking about B's session and path.
  const ctx = fakeContext({ userId: 'user-1', role: 'member', visibleOrgs: [ORG_A] })
  const res = await handleScanProcess(
    post({ ...validBody, scan_session_id: SESSION_B, image_path: PATH_B }),
    deps(ctx),
  )
  assertEquals(res.status, 403)
})

Deno.test('an image_path naming a different organization is refused', async () => {
  const ctx = memberOfA()
  // Well-formed path, same session id, but the org segment is B's.
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

Deno.test('a path with no matching photo_scans row is refused', async () => {
  const ctx = fakeContext({
    userId: 'user-1', role: 'member', visibleOrgs: [ORG_A],
    photos: [], // upload never recorded
  })
  assertEquals((await handleScanProcess(post(validBody), deps(ctx))).status, 403)
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

// ── Validation helpers, directly ───────────────────────────────────────

Deno.test('validateScanRequest accepts a well-formed body', () => {
  const result = validateScanRequest(validBody)
  assertEquals(result.ok, true)
})

Deno.test('organizationFromImagePath reads the leading segment', () => {
  assertEquals(organizationFromImagePath(PATH_A), ORG_A)
  assertEquals(organizationFromImagePath('nope'), null)
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
  // Still varies, so a cache cannot serve this to an allowed origin.
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

// ── Simulation honesty ────────────────────────────────────────────────

Deno.test('a successful response is explicitly marked simulated', async () => {
  const res = await handleScanProcess(post(validBody), deps(memberOfA()))
  const body = await res.json()
  assertEquals(body.simulated, true)
  assertEquals(
    body.simulation_notice,
    'Simulated analysis — no image AI was used. These values are fabricated.',
  )
})

Deno.test('intake no longer suggests a constant tag', async () => {
  const res = await handleScanProcess(post(validBody), deps(memberOfA()))
  const body = await res.json()
  // A fixed tag collided with unique (organization_id, tag) on the second
  // intake scan in an organization.
  assertEquals(body.extracted.suggested_lab_asset.tag, undefined)
  assertEquals(JSON.stringify(body).includes('LA-INTAKE'), false)
})

Deno.test('every scan type returns a simulated payload', async () => {
  for (const scanType of ['intake', 'condition', 'missing']) {
    const res = await handleScanProcess(
      post({ ...validBody, scan_type: scanType }), deps(memberOfA()),
    )
    assertEquals(res.status, 200)
    const body = await res.json()
    assertEquals(body.simulated, true)
    assertEquals(body.scan_type, scanType)
  }
})

Deno.test('no secret, token or image content appears in a response', async () => {
  const res = await handleScanProcess(post(validBody), deps(memberOfA()))
  const text = await res.text()
  for (const forbidden of ['SERVICE_ROLE', 'apikey', 'Bearer', 'eyJ']) {
    assertEquals(text.includes(forbidden), false, forbidden)
  }
})
