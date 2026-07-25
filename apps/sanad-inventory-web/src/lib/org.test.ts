import { beforeEach, describe, expect, it } from 'vitest'
import {
  fakeSupabase,
  resetFakeSupabase,
  setMemberships,
  setSignedInUser,
  setQueryError,
} from '../test/fakeSupabase'

// Must be hoisted above the import of the module under test.
fakeSupabase()

const {
  clearOrgCache,
  listMemberships,
  resolveCurrentOrgId,
  resolveOrgState,
  selectOrganization,
  NoOrganizationError,
  OrganizationNotSelectedError,
  SessionExpiredError,
  isAuthExpiryError,
} = await import('./org')

const ORG_A = { organizationId: 'org-a', role: 'owner' as const, name: 'Alpha Health', slug: 'alpha' }
const ORG_B = { organizationId: 'org-b', role: 'member' as const, name: 'Beta Relief', slug: 'beta' }

const STORAGE_KEY = (userId: string) => `sanad.inventory.currentOrg:${userId}`

beforeEach(() => {
  // Module-level state persists between tests in the same file. Without this,
  // a later test can pass on a previous test's cached memberships.
  clearOrgCache()
  resetFakeSupabase()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('single organization', () => {
  it('resolves automatically without asking the user to choose', async () => {
    setSignedInUser('user-1')
    setMemberships([ORG_A])

    const state = await resolveOrgState()

    expect(state.status).toBe('ready')
    expect(state).toMatchObject({ organizationId: 'org-a' })
    await expect(resolveCurrentOrgId()).resolves.toBe('org-a')
  })
})

describe('multiple organizations', () => {
  it('requires an explicit selection instead of picking one silently', async () => {
    setSignedInUser('user-1')
    setMemberships([ORG_A, ORG_B])

    const state = await resolveOrgState()

    expect(state.status).toBe('needs-selection')
    // The query layer must refuse to guess rather than default to the first org.
    await expect(resolveCurrentOrgId()).rejects.toBeInstanceOf(
      OrganizationNotSelectedError,
    )
  })

  it('restores a valid saved selection', async () => {
    setSignedInUser('user-1')
    setMemberships([ORG_A, ORG_B])
    window.localStorage.setItem(STORAGE_KEY('user-1'), 'org-b')

    const state = await resolveOrgState()

    expect(state.status).toBe('ready')
    expect(state).toMatchObject({ organizationId: 'org-b' })
  })

  it('rejects a saved organization the user no longer belongs to', async () => {
    setSignedInUser('user-1')
    // Access to org-b was revoked; only org-a and org-c remain.
    setMemberships([ORG_A, { ...ORG_B, organizationId: 'org-c', name: 'Gamma' }])
    window.localStorage.setItem(STORAGE_KEY('user-1'), 'org-b')

    const state = await resolveOrgState()

    // Falls back to the picker, never to an arbitrary organization.
    expect(state.status).toBe('needs-selection')
    await expect(resolveCurrentOrgId()).rejects.toBeInstanceOf(
      OrganizationNotSelectedError,
    )
  })

  it('refuses to persist a selection the user is not a member of', async () => {
    setSignedInUser('user-1')
    setMemberships([ORG_A, ORG_B])

    await expect(selectOrganization('org-not-mine')).rejects.toThrow(
      /not a member/i,
    )
    expect(window.localStorage.getItem(STORAGE_KEY('user-1'))).toBeNull()
  })
})

describe('no membership', () => {
  it('reports the dedicated no-access state rather than an empty org', async () => {
    setSignedInUser('user-1')
    setMemberships([])

    const state = await resolveOrgState()

    expect(state.status).toBe('no-membership')
    await expect(resolveCurrentOrgId()).rejects.toBeInstanceOf(
      NoOrganizationError,
    )
  })
})

describe('expired session', () => {
  it('reports session-expired when no session is present', async () => {
    setSignedInUser(null)

    const state = await resolveOrgState()

    expect(state.status).toBe('session-expired')
    await expect(resolveCurrentOrgId()).rejects.toBeInstanceOf(
      SessionExpiredError,
    )
  })

  it('classifies PostgREST and JWT expiry errors, but not ordinary failures', () => {
    expect(isAuthExpiryError({ code: 'PGRST301' })).toBe(true)
    expect(isAuthExpiryError({ status: 401 })).toBe(true)
    expect(isAuthExpiryError({ message: 'JWT expired' })).toBe(true)
    expect(isAuthExpiryError({ code: '23505', message: 'duplicate key' })).toBe(
      false,
    )
    expect(isAuthExpiryError(null)).toBe(false)
  })

  it('converts an expiry error into a typed error carrying no backend detail', async () => {
    setSignedInUser('user-1')
    setQueryError({ code: 'PGRST301', message: 'JWT expired' })

    await expect(listMemberships()).rejects.toBeInstanceOf(SessionExpiredError)

    const err = await listMemberships().catch((e: unknown) => e)
    expect((err as Error).message).toBe(
      'Your session has expired. Please sign in again.',
    )
    // No PostgREST code or JWT wording leaks to the UI.
    expect((err as Error).message).not.toMatch(/PGRST|JWT|token/i)
  })
})

describe('cross-user cache isolation', () => {
  it('never hands one user the other user\'s memberships', async () => {
    setSignedInUser('user-1')
    setMemberships([ORG_A])
    const first = await listMemberships()
    expect(first.map((m) => m.organizationId)).toEqual(['org-a'])

    // A different user signs in. SessionProvider clears the cache on the auth
    // event; assert the resolver is safe even so.
    clearOrgCache()
    setSignedInUser('user-2')
    setMemberships([ORG_B], 'user-2')

    const second = await listMemberships()
    expect(second.map((m) => m.organizationId)).toEqual(['org-b'])
  })

  it('keeps an in-flight lookup bound to the user that started it', async () => {
    // Regression guard for the double session-read defect: the membership
    // fetch must use the user id resolved at the start of the lookup, not
    // re-read "whoever is signed in now". Otherwise a user switch mid-flight
    // pairs one user's id with another user's rows.
    setSignedInUser('user-1')
    setMemberships([ORG_A])
    setMemberships([ORG_B], 'user-2')

    const pendingForUser1 = listMemberships()

    // user-2 signs in and completes before user-1's lookup is awaited.
    setSignedInUser('user-2')
    const forUser2 = await listMemberships()

    expect(forUser2.map((m) => m.organizationId)).toEqual(['org-b'])
    // user-1's promise must still carry user-1's data.
    expect((await pendingForUser1).map((m) => m.organizationId)).toEqual([
      'org-a',
    ])
  })

  it('does not apply one user\'s saved selection to another user', async () => {
    // Both users belong to two orgs; only user-1 has chosen.
    window.localStorage.setItem(STORAGE_KEY('user-1'), 'org-b')

    setSignedInUser('user-2')
    setMemberships([ORG_A, ORG_B])

    const state = await resolveOrgState()

    // user-2 has made no choice, so they must be asked — not silently given
    // user-1's organization.
    expect(state.status).toBe('needs-selection')
  })

  it('does not cache a failed lookup', async () => {
    setSignedInUser('user-1')
    setMemberships([ORG_A])
    setQueryError({ message: 'network down' })
    await expect(listMemberships()).rejects.toBeTruthy()

    // Recovery without needing an auth event: a cached rejection would pin
    // the user to the error state until the next sign-in.
    setQueryError(null)
    await expect(listMemberships()).resolves.toHaveLength(1)
  })
})
