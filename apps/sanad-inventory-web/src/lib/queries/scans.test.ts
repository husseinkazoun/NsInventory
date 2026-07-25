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
  MalformedScanResponseError,
  ScanAuthorizationError,
  intakeTagForSession,
  processScanPhoto,
} = await import('./scans')
const { supabase } = await import('../supabaseClient')
const { clearOrgCache } = await import('../org')

const ORG = '5ada0000-0000-4000-8000-000000000001'
const SESSION = '5ada0000-0000-4000-8000-000000000041'
const IMAGE = `${ORG}/${SESSION}/photo.png`

// The fake client is a shared singleton. `stubInvoke` / `stubUpdateResult`
// mutate it in place, and `resetFakeSupabase()` does not restore those — so the
// original `from` is captured once and reinstated before every test. Without
// that, a stub from one test leaks into the fallback path of the next (which
// calls `from` for its best-effort failure record) and passes for the wrong
// reason, or breaks purely on test order.
type MutableClient = {
  from: (...args: unknown[]) => unknown
  functions?: { invoke: (...args: unknown[]) => Promise<unknown> }
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
})

/** Replaces functions.invoke for one test. */
function stubInvoke(result: { data?: unknown; error?: unknown }) {
  client.functions = { invoke: vi.fn().mockResolvedValue(result) }
}

/**
 * Replaces the `from(...).update(...).eq(...).eq(...)` resolution for one test,
 * so a persistence failure can be simulated. Restored in `beforeEach`.
 */
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

/** A real FunctionsHttpError, as supabase-js throws for a non-2xx response. */
function httpError(status: number) {
  return new FunctionsHttpError({ status })
}

const args = {
  scanSessionId: SESSION,
  imagePath: IMAGE,
  scanType: 'intake' as const,
}

// =====================================================================
// Refusals (401/403) must never become simulated results
// =====================================================================
describe('authorization failures do not fall back', () => {
  it('throws on 403 rather than returning fabricated data', async () => {
    // A viewer, or another organization's session. The server said no; showing
    // results anyway would tell the user their scan succeeded.
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
// Genuine unavailability (network / relay / 5xx) — the ONLY fallback cases
// =====================================================================
describe('genuine unavailability falls back to the offline mock', () => {
  it('falls back on a network failure (FunctionsFetchError)', async () => {
    // A network failure carries no HTTP status — the request never reached the
    // function.
    stubInvoke({ error: new FunctionsFetchError({}) })

    const result = await processScanPhoto(args)
    expect(result.usedOfflineMock).toBe(true)
    expect(result.simulated).toBe(true)
  })

  it('falls back on a relay failure (FunctionsRelayError)', async () => {
    stubInvoke({ error: new FunctionsRelayError({}) })

    const result = await processScanPhoto(args)
    expect(result.usedOfflineMock).toBe(true)
    expect(result.simulated).toBe(true)
  })

  it('falls back on a 500', async () => {
    stubInvoke({ error: httpError(500) })
    const result = await processScanPhoto(args)
    expect(result.usedOfflineMock).toBe(true)
  })

  it('falls back on a 503', async () => {
    stubInvoke({ error: httpError(503) })
    const result = await processScanPhoto(args)
    expect(result.usedOfflineMock).toBe(true)
  })
})

// =====================================================================
// Every other 4xx is a definite answer — surface it, never fabricate
// =====================================================================
describe('non-5xx HTTP errors are surfaced, not faked', () => {
  for (const status of [400, 404, 405, 413, 422, 429]) {
    it(`surfaces a ${status} instead of returning the offline mock`, async () => {
      stubInvoke({ error: httpError(status) })

      // Rejects with the original error — so it neither fell back to the mock
      // nor was mistaken for a 401/403 refusal.
      const err = await processScanPhoto(args).catch((e) => e)
      expect(err).toBeInstanceOf(FunctionsHttpError)
      expect(err).not.toBeInstanceOf(ScanAuthorizationError)
    })
  }
})

// =====================================================================
// An empty or malformed 2xx body must be a hard error, not a silent mock
// =====================================================================
describe('empty or malformed success responses are surfaced', () => {
  const malformed: Array<[string, unknown]> = [
    ['empty (null) body', null],
    ['a string body', 'not an object'],
    ['a numeric body', 42],
    ['an array body', []],
    ['no extracted key', { simulated: true, confidence: 0.9 }],
    ['extracted is a string', { extracted: 'nope' }],
    ['extracted is an array', { extracted: [] }],
  ]

  for (const [label, data] of malformed) {
    it(`throws MalformedScanResponseError for ${label}`, async () => {
      stubInvoke({ data })
      const err = await processScanPhoto(args).catch((e) => e)
      expect(err).toBeInstanceOf(MalformedScanResponseError)
    })
  }
})

// =====================================================================
// A persistence failure is not a function outage
// =====================================================================
describe('a photo_scans persistence failure does not fall back', () => {
  it('surfaces the database error instead of the offline mock', async () => {
    // The analysis succeeded; the write onto photo_scans failed afterward. That
    // is not an "Edge Function is down" condition, so it must not be masked by
    // the offline mock.
    stubInvoke({ data: { simulated: true, confidence: 0.9, extracted: {} } })
    stubUpdateResult({ data: null, error: { message: 'update failed', code: '23505' } })

    const err = await processScanPhoto(args).catch((e) => e)
    // The surfaced value is the DB error, not a returned ProcessResponse.
    expect(err).toMatchObject({ code: '23505' })
    expect((err as { usedOfflineMock?: unknown }).usedOfflineMock).toBeUndefined()
  })
})

// =====================================================================
// Simulation marker (successful responses)
// =====================================================================
describe('simulation marker', () => {
  it('is carried through from a successful response', async () => {
    stubInvoke({
      data: { simulated: true, confidence: 0.9, extracted: { fields: [] } },
    })
    const result = await processScanPhoto(args)
    expect(result.simulated).toBe(true)
  })

  it('defaults to simulated when the marker is absent', async () => {
    // Fail toward honesty: a response that does not claim to be real is
    // treated as simulated, so a future provider must opt in explicitly.
    stubInvoke({ data: { confidence: 0.9, extracted: {} } })
    const result = await processScanPhoto(args)
    expect(result.simulated).toBe(true)
  })

  it('is false only when the server explicitly says so', async () => {
    stubInvoke({
      data: { simulated: false, confidence: 0.9, extracted: {} },
    })
    const result = await processScanPhoto(args)
    expect(result.simulated).toBe(false)
  })

  it('marks the offline fallback as simulated', async () => {
    stubInvoke({ error: new FunctionsFetchError({}) })
    const result = await processScanPhoto(args)
    expect(result.simulated).toBe(true)
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
    // The old constant tag collided with unique (organization_id, tag) on the
    // second intake scan in an organization.
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
