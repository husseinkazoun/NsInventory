import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fakeSupabase,
  resetFakeSupabase,
  setMemberships,
  setSignedInUser,
} from '../../test/fakeSupabase'

fakeSupabase()

const {
  ScanAuthorizationError,
  intakeTagForSession,
  processScanPhoto,
} = await import('./scans')
const { supabase } = await import('../supabaseClient')
const { clearOrgCache } = await import('../org')

const ORG = '5ada0000-0000-4000-8000-000000000001'
const SESSION = '5ada0000-0000-4000-8000-000000000041'
const IMAGE = `${ORG}/${SESSION}/photo.png`

beforeEach(() => {
  clearOrgCache()
  resetFakeSupabase()
  window.localStorage.clear()
  setSignedInUser('user-1')
  setMemberships([
    { organizationId: ORG, role: 'member', name: 'Staging', slug: 'staging' },
  ])
})

/** Replaces functions.invoke for one test. */
function stubInvoke(result: { data?: unknown; error?: unknown }) {
  const client = supabase as unknown as {
    functions: { invoke: (...args: unknown[]) => Promise<unknown> }
  }
  client.functions = {
    invoke: vi.fn().mockResolvedValue(result),
  }
}

const args = {
  scanSessionId: SESSION,
  imagePath: IMAGE,
  scanType: 'intake' as const,
}

// =====================================================================
// Refusals must never become simulated results
// =====================================================================
describe('authorization failures do not fall back', () => {
  it('throws on 403 rather than returning fabricated data', async () => {
    // A viewer, or another organization's session. The server said no; showing
    // results anyway would tell the user their scan succeeded.
    stubInvoke({ error: { message: 'Forbidden', context: { status: 403 } } })

    await expect(processScanPhoto(args)).rejects.toBeInstanceOf(
      ScanAuthorizationError,
    )
  })

  it('throws on 401 rather than returning fabricated data', async () => {
    stubInvoke({ error: { message: 'Unauthorized', context: { status: 401 } } })
    await expect(processScanPhoto(args)).rejects.toBeInstanceOf(
      ScanAuthorizationError,
    )
  })

  it('carries the status and a message free of server internals', async () => {
    stubInvoke({ error: { message: 'Forbidden', context: { status: 403 } } })
    const err = (await processScanPhoto(args).catch((e) => e)) as InstanceType<
      typeof ScanAuthorizationError
    >
    expect(err.status).toBe(403)
    expect(err.message).toMatch(/permission/i)
    expect(err.message).not.toMatch(/403|Forbidden|supabase/i)
  })

  it('still falls back when the function is genuinely unavailable', async () => {
    // A network failure carries no HTTP status — this is the only case the
    // offline fallback is for.
    stubInvoke({ error: { message: 'Failed to fetch' } })

    const result = await processScanPhoto(args)
    expect(result.usedOfflineMock).toBe(true)
    expect(result.simulated).toBe(true)
  })

  it('falls back on a 500, which is unavailability rather than refusal', async () => {
    stubInvoke({ error: { message: 'boom', context: { status: 500 } } })
    const result = await processScanPhoto(args)
    expect(result.usedOfflineMock).toBe(true)
  })
})

// =====================================================================
// Simulation marker
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
    stubInvoke({ error: { message: 'Failed to fetch' } })
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
