import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js'
import {
  fakeSupabase,
  resetFakeSupabase,
  setMemberships,
  setSignedInUser,
} from '../../test/fakeSupabase'

fakeSupabase()

const {
  ScanAuthorizationError,
  ScanProcessingError,
  completeScanSession,
  intakeTagForSession,
  processScanPhoto,
} = await import('./scans')
type GarmentDraft = import('../clothing').GarmentDraft
const { supabase } = await import('../supabaseClient')
const { clearOrgCache } = await import('../org')

const ORG = '5ada0000-0000-4000-8000-000000000001'
const SESSION = '5ada0000-0000-4000-8000-000000000041'
const IMAGE = `${ORG}/${SESSION}/photo.png`

// The fake client is a shared singleton. `stubInvoke` / `stubUpdateResult`
// mutate it in place, and `resetFakeSupabase()` does not restore those — so the
// original `from` is captured once and reinstated before every test.
type MutableClient = {
  from: (...args: unknown[]) => unknown
  functions?: { invoke: (...args: unknown[]) => Promise<unknown> }
  rpc?: (name: string, args: Record<string, unknown>) => Promise<unknown>
}
const client = supabase as unknown as MutableClient
const originalFrom = client.from

beforeEach(() => {
  clearOrgCache()
  resetFakeSupabase()
  window.localStorage.clear()
  setSignedInUser('user-1')
  setMemberships([
    { organizationId: ORG, role: 'member', name: 'Staging', slug: 'staging' },
  ])
  client.from = originalFrom
  delete client.functions
  delete client.rpc
})

/**
 * A permissive chainable stand-in for `from(...)`.
 *
 * `completeScanSession` walks several different chains — `select().eq().eq()
 * .maybeSingle()`, `update().eq().eq()`, `insert()` — and the shared fake
 * client only models the narrow shape the earlier tests needed. This accepts
 * any of them and resolves to "no row found", which is the path a fresh
 * session takes. Table writes are recorded for assertions.
 */
function stubAssetChain(): Array<{ table: string; op: string }> {
  const seen: Array<{ table: string; op: string }> = []
  client.from = ((table: string) => {
    // Organization resolution still has to work: completeScanSession calls
    // resolveCurrentOrgId() first, and shadowing that lookup would fail the
    // test with NoOrganizationError long before reaching the RPC.
    if (table === 'organization_members') {
      return (originalFrom as (t: string) => unknown)(table)
    }
    const chain: Record<string, unknown> = {}
    const record = (op: string) => {
      seen.push({ table, op })
      return chain
    }
    chain.select = () => chain
    chain.eq = () => chain
    chain.in = () => chain
    chain.order = () => chain
    chain.insert = () => record('insert')
    chain.update = () => record('update')
    chain.maybeSingle = () => Promise.resolve({ data: null, error: null })
    chain.single = () => Promise.resolve({ data: null, error: null })
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    return chain
  }) as MutableClient['from']
  return seen
}

/** Records every rpc(name, args) call and returns a fixed result. */
function spyRpc(result: { data?: unknown; error?: unknown }) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  client.rpc = (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args })
    return Promise.resolve(result)
  }
  return calls
}

/** A reviewed draft — deliberately different from what the AI suggested. */
function reviewedDraft(over: Partial<GarmentDraft> = {}): GarmentDraft {
  return {
    title: 'Navy jacket, size M',
    garment_type: 'Jacket',
    brand: 'Corrected Brand',
    size_label: 'M',
    size_system: '',
    material: '',
    primary_color: 'navy',
    secondary_color: '',
    pattern: '',
    condition_notes: '',
    sku: '',
    notes: '',
    listing_status: 'draft',
    purchase_cost: '',
    selling_price: '',
    ...over,
  }
}

/** Replaces functions.invoke for one test. */
function stubInvoke(result: { data?: unknown; error?: unknown }) {
  client.functions = { invoke: vi.fn().mockResolvedValue(result) }
}

/** Replaces `from(...).update(...).eq(...).eq(...)` resolution for one test. */
function stubUpdateResult(result: { data?: unknown; error?: unknown }) {
  client.from = () => ({
    update: () => {
      const chain: Record<string, unknown> = {}
      chain.eq = () => chain
      chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve(result).then(resolve)
      return chain
    },
  })
}

/** Records every `from(table).update(payload)` for one test. */
function spyUpdates(): Array<{ table: string; payload: Record<string, unknown> }> {
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = []
  client.from = ((table: string) => ({
    update: (payload: Record<string, unknown>) => {
      updates.push({ table, payload })
      const chain: Record<string, unknown> = {}
      chain.eq = () => chain
      chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      return chain
    },
  })) as MutableClient['from']
  return updates
}

/** A real FunctionsHttpError, as supabase-js throws for a non-2xx response. */
function httpError(status: number) {
  return new FunctionsHttpError({ status })
}

/**
 * A FunctionsHttpError carrying a real `Response`, exactly as supabase-js
 * builds it in the browser.
 *
 * The `{ status }` object above is a convenient stand-in, but it cannot prove
 * the client reads the Edge Function's `{ error }` body: `readServerMessage`
 * only looks inside a genuine `Response`. It also cannot prove the 401/403
 * path still classifies correctly once `context` is a Response rather than a
 * plain object.
 */
function responseError(status: number, body: string, contentType = 'application/json') {
  return new FunctionsHttpError(
    new Response(body, { status, headers: { 'content-type': contentType } }),
  )
}

/** The message ScanProcessingError falls back to when no server text is usable. */
const GENERIC_RETRY = 'The image could not be analyzed right now. Please try again.'

const args = {
  scanSessionId: SESSION,
  imagePath: IMAGE,
  scanType: 'intake' as const,
}

// =====================================================================
// Refusals (401/403) stay typed authorization errors
// =====================================================================
describe('authorization failures throw ScanAuthorizationError', () => {
  it('throws on 403 rather than returning fabricated data', async () => {
    stubInvoke({ error: httpError(403) })
    await expect(processScanPhoto(args)).rejects.toBeInstanceOf(
      ScanAuthorizationError,
    )
  })

  it('throws on 401 rather than returning fabricated data', async () => {
    stubInvoke({ error: httpError(401) })
    await expect(processScanPhoto(args)).rejects.toBeInstanceOf(
      ScanAuthorizationError,
    )
  })

  it('carries the status and a message free of server internals', async () => {
    stubInvoke({ error: httpError(403) })
    const err = (await processScanPhoto(args).catch((e) => e)) as InstanceType<
      typeof ScanAuthorizationError
    >
    expect(err.status).toBe(403)
    expect(err.message).toMatch(/permission/i)
    expect(err.message).not.toMatch(/403|Forbidden|supabase/i)
  })
})

// =====================================================================
// Configured mode has NO offline fallback: every non-auth failure surfaces
// a retryable ScanProcessingError and never returns a simulated result.
// =====================================================================
describe('provider/function failures surface a retryable error (no fallback)', () => {
  const failures: Array<[string, { data?: unknown; error?: unknown }]> = [
    ['network failure (FunctionsFetchError)', { error: new FunctionsFetchError({}) }],
    ['relay failure (FunctionsRelayError)', { error: new FunctionsRelayError({}) }],
    ['HTTP 500', { error: httpError(500) }],
    ['HTTP 503', { error: httpError(503) }],
    ['HTTP 400', { error: httpError(400) }],
    ['HTTP 404', { error: httpError(404) }],
    ['HTTP 413', { error: httpError(413) }],
    ['HTTP 429', { error: httpError(429) }],
    ['empty body', { data: null }],
    ['malformed body (no extracted)', { data: { confidence: 0.9 } }],
  ]

  for (const [label, result] of failures) {
    it(`throws ScanProcessingError, no offline mock, for ${label}`, async () => {
      stubInvoke(result)
      const outcome = await processScanPhoto(args).catch((e) => e)
      expect(outcome).toBeInstanceOf(ScanProcessingError)
      // Definitely not a resolved (simulated) ProcessResponse.
      expect((outcome as { usedOfflineMock?: unknown }).usedOfflineMock).toBeUndefined()
      expect((outcome as { simulated?: unknown }).simulated).toBeUndefined()
    })
  }

  it('marks the photo_scans row failed before throwing', async () => {
    stubInvoke({ error: new FunctionsFetchError({}) })
    const updates = spyUpdates()
    await expect(processScanPhoto(args)).rejects.toBeInstanceOf(ScanProcessingError)
    const failed = updates.find(
      (u) => u.table === 'photo_scans' && u.payload?.processing_status === 'failed',
    )
    expect(failed).toBeTruthy()
  })
})

// =====================================================================
// Response-backed errors: the Edge Function's own safe `{ error }` message
// must reach the user, and a body that is not usable must not.
// =====================================================================
describe('a response-backed FunctionsHttpError relays the safe server message', () => {
  const MODEL_UNAVAILABLE = JSON.stringify({ error: 'model unavailable' })

  it("surfaces the function's `{ error }` text as the thrown message", async () => {
    stubInvoke({ error: responseError(502, MODEL_UNAVAILABLE) })
    const err = await processScanPhoto(args).catch((e) => e)
    expect(err).toBeInstanceOf(ScanProcessingError)
    expect((err as Error).message).toBe('model unavailable')
  })

  it('marks the photo_scans row failed and never completed', async () => {
    stubInvoke({ error: responseError(502, MODEL_UNAVAILABLE) })
    const updates = spyUpdates()
    await expect(processScanPhoto(args)).rejects.toBeInstanceOf(ScanProcessingError)

    const statuses = updates
      .filter((u) => u.table === 'photo_scans')
      .map((u) => u.payload?.processing_status)
    expect(statuses).toContain('failed')
    expect(statuses).not.toContain('completed')
  })

  it('records the failure without leaking the provider body into the row', async () => {
    stubInvoke({ error: responseError(502, MODEL_UNAVAILABLE) })
    const updates = spyUpdates()
    await expect(processScanPhoto(args)).rejects.toBeInstanceOf(ScanProcessingError)
    const failed = updates.find((u) => u.payload?.processing_status === 'failed')
    const recorded = String(failed?.payload?.error_message ?? '')
    // supabase-js's own generic text, not the response body.
    expect(recorded).toMatch(/Image analysis failed/)
    expect(recorded).not.toMatch(/Bearer|sk-|api\.openai\.com|data:image/)
  })

  // A body the client cannot read must not become part of a user-facing
  // message — the user gets the generic retry line instead.
  const unusableBodies: Array<[string, string, string]> = [
    ['non-JSON text', 'upstream connect error', 'text/plain'],
    ['HTML error page', '<html><body>502 Bad Gateway</body></html>', 'text/html'],
    ['truncated JSON', '{"error": "model unav', 'application/json'],
    ['JSON without an error key', JSON.stringify({ detail: 'nope' }), 'application/json'],
    ['JSON whose error is not a string', JSON.stringify({ error: { code: 5 } }), 'application/json'],
    ['empty body', '', 'application/json'],
  ]

  for (const [label, body, contentType] of unusableBodies) {
    it(`falls back to the generic retry message for a ${label}`, async () => {
      stubInvoke({ error: responseError(502, body, contentType) })
      const err = await processScanPhoto(args).catch((e) => e)
      expect(err).toBeInstanceOf(ScanProcessingError)
      expect((err as Error).message).toBe(GENERIC_RETRY)
    })
  }

  it('still classifies 401 and 403 as authorization refusals', async () => {
    // The refusal path must not depend on `context` being a plain object.
    for (const status of [401, 403] as const) {
      stubInvoke({
        error: responseError(status, JSON.stringify({ error: 'Forbidden' })),
      })
      const err = await processScanPhoto(args).catch((e) => e)
      expect(err).toBeInstanceOf(ScanAuthorizationError)
      expect((err as InstanceType<typeof ScanAuthorizationError>).status).toBe(status)
    }
  })

  it('does not mark the row failed on a refusal', async () => {
    // A refusal is a real answer about permissions, not a failed analysis.
    stubInvoke({ error: responseError(403, JSON.stringify({ error: 'Forbidden' })) })
    const updates = spyUpdates()
    await expect(processScanPhoto(args)).rejects.toBeInstanceOf(ScanAuthorizationError)
    expect(updates).toHaveLength(0)
  })
})

// =====================================================================
// A persistence failure after a successful analysis still surfaces
// =====================================================================
describe('a photo_scans persistence failure surfaces (does not fabricate)', () => {
  it('surfaces the database error instead of a result', async () => {
    stubInvoke({ data: { simulated: false, confidence: 0.9, extracted: {} } })
    stubUpdateResult({ data: null, error: { message: 'update failed', code: '23505' } })
    const err = await processScanPhoto(args).catch((e) => e)
    expect(err).toMatchObject({ code: '23505' })
  })
})

// =====================================================================
// Configured-mode honesty invariant
// =====================================================================
// A configured environment must be told, explicitly, that a result came from
// the image. `simulated: false` is that assertion. `simulated: true` and an
// absent marker are both rejected: silence is not consent, and there is
// nothing legitimate in configured mode that produces either.
//
// This inverts an earlier assertion. The previous behaviour resolved an
// absent marker to `simulated: true` and returned it — "fail toward honesty"
// at the labelling layer, but the row was still written `completed`, so an
// unlabelled placeholder was persisted as a finished scan.
describe('configured mode requires an explicit simulated: false', () => {
  it('accepts a response that asserts it is genuine', async () => {
    stubInvoke({ data: { simulated: false, confidence: 0.9, extracted: {} } })
    const result = await processScanPhoto(args)
    expect(result.simulated).toBe(false)
  })

  // Positive control for every `not.toContain('completed')` assertion below
  // and in the response-backed-error block: proves the spy really does observe
  // the completed write when one happens, so its absence is evidence.
  it('writes processing_status completed for a genuine result', async () => {
    stubInvoke({ data: { simulated: false, confidence: 0.9, extracted: {} } })
    const updates = spyUpdates()
    await processScanPhoto(args)
    const statuses = updates
      .filter((u) => u.table === 'photo_scans')
      .map((u) => u.payload?.processing_status)
    expect(statuses).toContain('completed')
    expect(statuses).not.toContain('failed')
  })

  const dishonest: Array<[string, Record<string, unknown>]> = [
    ['claims to be simulated', { simulated: true, confidence: 0.9, extracted: {} }],
    ['omits the marker', { confidence: 0.9, extracted: {} }],
    ['sends a non-boolean marker', { simulated: 'false', confidence: 0.9, extracted: {} }],
    ['sends null', { simulated: null, confidence: 0.9, extracted: {} }],
  ]

  for (const [label, data] of dishonest) {
    it(`rejects a response that ${label}`, async () => {
      stubInvoke({ data })
      const outcome = await processScanPhoto(args).catch((e) => e)
      expect(outcome).toBeInstanceOf(ScanProcessingError)
      // Not a resolved result of any kind.
      expect((outcome as { extracted?: unknown }).extracted).toBeUndefined()
    })

    it(`marks the row failed, never completed, when the response ${label}`, async () => {
      stubInvoke({ data })
      const updates = spyUpdates()
      await expect(processScanPhoto(args)).rejects.toBeInstanceOf(ScanProcessingError)
      const statuses = updates
        .filter((u) => u.table === 'photo_scans')
        .map((u) => u.payload?.processing_status)
      expect(statuses).toContain('failed')
      expect(statuses).not.toContain('completed')
    })
  }

  it('explains that nothing was saved, rather than the generic retry line', async () => {
    stubInvoke({ data: { simulated: true, confidence: 0.9, extracted: {} } })
    const err = await processScanPhoto(args).catch((e) => e)
    expect((err as Error).message).toMatch(/simulated placeholder/i)
    expect((err as Error).message).toMatch(/nothing was saved/i)
  })
})

// =====================================================================
// completeScanSession must never persist an unconfirmed result
// =====================================================================
describe('completeScanSession guards against unconfirmed results', () => {
  // Defence in depth: processScanPhoto already rejects these, so reaching here
  // means the payload was constructed some other way. No asset may result.
  const unconfirmed: Array<[string, Record<string, unknown>]> = [
    ['a simulated result', { simulated: true, confidence: 0.5 }],
    ['a result with no marker at all', { confidence: 0.5 }],
  ]

  for (const [label, extracted] of unconfirmed) {
    it(`refuses to create an asset from ${label}`, async () => {
      // The guard runs before any database work, so no asset can be created.
      const updates = spyUpdates()
      await expect(
        completeScanSession({
          scanSessionId: SESSION,
          scanType: 'intake',
          extracted: extracted as Parameters<
            typeof completeScanSession
          >[0]['extracted'],
        }),
      ).rejects.toBeInstanceOf(ScanProcessingError)
      expect(updates).toHaveLength(0)
    })
  }
})

// =====================================================================
// Clothing intake saves the REVIEWED values, atomically
// =====================================================================
describe('completeScanSession creates a garment from the reviewed draft', () => {
  const genuine = {
    simulated: false as const,
    confidence: 0.81,
    detected_condition: 'fair' as const,
    suggested_lab_asset: { name: 'AI suggested name' },
    clothing: { garment_type: { value: 'Jacket', confidence: 0.9 } } as never,
  }

  it('routes clothing intake through the atomic create_garment_asset call', async () => {
    stubAssetChain()
    const calls = spyRpc({ data: 'new-asset-id', error: null })
    const out = await completeScanSession({
      scanSessionId: SESSION,
      scanType: 'intake',
      extracted: genuine,
      garment: reviewedDraft(),
      condition: 'good',
      photoScanId: 'photo-1',
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].name).toBe('create_garment_asset')
    expect(out.labAssetId).toBe('new-asset-id')
  })

  it('sends the corrected values, not the AI’s originals', async () => {
    stubAssetChain()
    const calls = spyRpc({ data: 'new-asset-id', error: null })
    await completeScanSession({
      scanSessionId: SESSION,
      scanType: 'intake',
      extracted: genuine,
      garment: reviewedDraft({ brand: 'Corrected Brand', size_label: 'XL' }),
      condition: 'good',
    })
    const g = calls[0].args.p_garment as Record<string, unknown>
    expect(g.brand).toBe('Corrected Brand')
    expect(g.size_label).toBe('XL')
    // The reviewer's condition wins over detected_condition ('fair').
    expect(calls[0].args.p_condition).toBe('good')
    // The asset name comes from the reviewed title, not suggested_lab_asset.
    expect(calls[0].args.p_name).toBe('Navy jacket, size M')
  })

  it('keeps the AI’s original extraction alongside the reviewed values', async () => {
    stubAssetChain()
    const calls = spyRpc({ data: 'new-asset-id', error: null })
    await completeScanSession({
      scanSessionId: SESSION,
      scanType: 'intake',
      extracted: genuine,
      garment: reviewedDraft({ brand: 'Corrected Brand' }),
    })
    // Corrected value in the columns, original words kept for audit.
    expect((calls[0].args.p_garment as Record<string, unknown>).brand).toBe(
      'Corrected Brand',
    )
    expect(calls[0].args.p_ai_extraction).toBe(genuine.clothing)
  })

  it('passes the scan session and photo so provenance is recorded', async () => {
    stubAssetChain()
    const calls = spyRpc({ data: 'new-asset-id', error: null })
    await completeScanSession({
      scanSessionId: SESSION,
      scanType: 'intake',
      extracted: genuine,
      garment: reviewedDraft(),
      photoScanId: 'photo-42',
    })
    expect(calls[0].args.p_scan_session_id).toBe(SESSION)
    expect(calls[0].args.p_photo_scan_id).toBe('photo-42')
    expect(calls[0].args.p_confidence).toBe(0.81)
  })

  it('uses the session-derived tag, so a retry cannot create a second asset', async () => {
    stubAssetChain()
    const calls = spyRpc({ data: 'new-asset-id', error: null })
    await completeScanSession({
      scanSessionId: SESSION,
      scanType: 'intake',
      extracted: genuine,
      garment: reviewedDraft(),
    })
    expect(calls[0].args.p_tag).toBe(intakeTagForSession(SESSION))
  })

  it('leaves a field the reviewer did not fill in empty, for the database to store as NULL', async () => {
    stubAssetChain()
    const calls = spyRpc({ data: 'new-asset-id', error: null })
    await completeScanSession({
      scanSessionId: SESSION,
      scanType: 'intake',
      extracted: genuine,
      garment: reviewedDraft({ material: '', pattern: '   ' }),
    })
    const g = calls[0].args.p_garment as Record<string, unknown>
    // Empty, not a placeholder word. create_garment_asset applies nullif().
    expect(g.material).toBe('')
    expect(g.pattern).toBe('')
  })

  it('falls back to the garment type when the reviewer cleared the title', async () => {
    stubAssetChain()
    const calls = spyRpc({ data: 'new-asset-id', error: null })
    await completeScanSession({
      scanSessionId: SESSION,
      scanType: 'intake',
      extracted: genuine,
      garment: reviewedDraft({ title: '  ', garment_type: 'Coat' }),
    })
    expect(calls[0].args.p_name).toBe('Coat')
  })

  it('surfaces a failed save and creates nothing partial', async () => {
    // The whole insert is one transaction inside the function: a failure
    // rolls back both records, so there is no asset without its garment.
    stubAssetChain()
    spyRpc({ data: null, error: { message: 'insert failed', code: '23505' } })
    const err = await completeScanSession({
      scanSessionId: SESSION,
      scanType: 'intake',
      extracted: genuine,
      garment: reviewedDraft(),
    }).catch((e) => e)
    expect(err).toMatchObject({ code: '23505' })
  })

  it('refuses a response that did not return an asset id', async () => {
    // A call that reports no error but no id has not created anything
    // usable; treating it as success would show a broken asset link.
    stubAssetChain()
    spyRpc({ data: null, error: null })
    const err = await completeScanSession({
      scanSessionId: SESSION,
      scanType: 'intake',
      extracted: genuine,
      garment: reviewedDraft(),
    }).catch((e) => e)
    expect(err).toBeInstanceOf(ScanProcessingError)
  })

  it('still refuses to save a simulated result as a garment', async () => {
    // The honesty invariant is unchanged by the clothing work.
    stubAssetChain()
    const calls = spyRpc({ data: 'new-asset-id', error: null })
    await expect(
      completeScanSession({
        scanSessionId: SESSION,
        scanType: 'intake',
        extracted: { simulated: true, confidence: 0.5 },
        garment: reviewedDraft(),
      }),
    ).rejects.toBeInstanceOf(ScanProcessingError)
    expect(calls).toHaveLength(0)
  })

  it('does not use the clothing path for a non-clothing intake', async () => {
    // No garment draft: the original generic asset creation is untouched.
    stubAssetChain()
    const calls = spyRpc({ data: 'new-asset-id', error: null })
    const updates = spyUpdates()
    await completeScanSession({
      scanSessionId: SESSION,
      scanType: 'intake',
      extracted: { simulated: false, confidence: 0.9 },
      garment: null,
    }).catch(() => undefined)
    expect(calls).toHaveLength(0)
    expect(updates.length).toBeGreaterThanOrEqual(0)
  })
})

// =====================================================================
// The clothing payload reaches the client for the review form
// =====================================================================
describe('the full clothing extraction is carried to the review step', () => {
  it('lifts extracted.clothing, which fields alone cannot supply', async () => {
    // `fields` omits anything unreadable, so an empty editable Brand box can
    // only come from the structured payload.
    const clothing = {
      garment_type: { value: 'Jacket', confidence: 0.9 },
      brand: { value: null, confidence: 0.1, evidence: null },
    }
    stubInvoke({
      data: {
        simulated: false,
        confidence: 0.9,
        extracted: { fields: [{ label: 'Type', value: 'Jacket', confidence: 0.9 }], clothing },
      },
    })
    const result = await processScanPhoto(args)
    expect(result.clothing).toEqual(clothing)
    // The unreadable brand is absent from `fields` but present in `clothing`.
    expect(result.fields).toHaveLength(1)
  })

  it('is null when the response carries no clothing payload', async () => {
    stubInvoke({ data: { simulated: false, confidence: 0.9, extracted: {} } })
    const result = await processScanPhoto(args)
    expect(result.clothing).toBeNull()
  })

  it('is null rather than a malformed value when clothing is not an object', async () => {
    stubInvoke({
      data: {
        simulated: false,
        confidence: 0.9,
        extracted: { clothing: 'not-an-object' },
      },
    })
    const result = await processScanPhoto(args)
    expect(result.clothing).toBeNull()
  })
})

// =====================================================================
// Intake tags
// =====================================================================
describe('intake tag generation', () => {
  it('is deterministic for a session, so a retry reuses it', () => {
    expect(intakeTagForSession(SESSION)).toBe(intakeTagForSession(SESSION))
  })

  it('differs between two separate scan sessions', () => {
    const a = intakeTagForSession('11111111-2222-4333-8444-555555555555')
    const b = intakeTagForSession('66666666-7777-4888-8999-aaaaaaaaaaaa')
    expect(a).not.toBe(b)
  })

  it('never emits the old constant tag', () => {
    for (const id of [
      SESSION,
      '11111111-2222-4333-8444-555555555555',
      '00000000-0000-4000-8000-000000000000',
    ]) {
      expect(intakeTagForSession(id)).not.toBe('LA-INTAKE')
    }
  })

  it('produces a compact, uppercase, tag-safe value', () => {
    const tag = intakeTagForSession(SESSION)
    expect(tag).toMatch(/^LA-[0-9A-F]{12}$/)
  })

  it('is stable across many distinct sessions', () => {
    const ids = Array.from(
      { length: 200 },
      (_, i) =>
        `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`,
    )
    const tags = new Set(ids.map(intakeTagForSession))
    expect(tags.size).toBe(ids.length)
  })
})
