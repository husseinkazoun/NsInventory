import { describe, expect, it } from 'vitest'
import {
  ROLE_CAPABILITIES,
  NO_CAPABILITIES,
  capabilitiesFor,
} from './permissions'
import type { OrgRole } from './org'

/**
 * The frontend matrix must mirror the database matrix in
 * `supabase/migrations/20260725161641_role_based_rls.sql`. If they drift, the
 * UI is wrong (not insecure — RLS still refuses), but a viewer being shown a
 * button that always fails is a bug worth catching here.
 *
 * The table below is transcribed from the migration header on purpose: it is
 * a second, independent statement of the rule, so a one-sided edit fails.
 */
const EXPECTED: Record<OrgRole, [read: boolean, write: boolean, del: boolean]> = {
  owner:  [true, true, true],
  admin:  [true, true, true],
  member: [true, true, false],
  viewer: [true, false, false],
}

describe('role capability matrix', () => {
  for (const [role, [read, write, del]] of Object.entries(EXPECTED)) {
    it(`${role}: read=${read} write=${write} delete=${del}`, () => {
      expect(capabilitiesFor(role as OrgRole)).toEqual({
        canRead: read,
        canWrite: write,
        canDelete: del,
      })
    })
  }

  it('covers every role in the org_role enum', () => {
    expect(Object.keys(ROLE_CAPABILITIES).sort()).toEqual(
      ['admin', 'member', 'owner', 'viewer'],
    )
  })

  it('only owner and admin may delete', () => {
    const deleters = Object.entries(ROLE_CAPABILITIES)
      .filter(([, c]) => c.canDelete)
      .map(([r]) => r)
      .sort()
    expect(deleters).toEqual(['admin', 'owner'])
  })

  it('viewer is the only role denied writes', () => {
    const nonWriters = Object.entries(ROLE_CAPABILITIES)
      .filter(([, c]) => !c.canWrite)
      .map(([r]) => r)
    expect(nonWriters).toEqual(['viewer'])
  })

  it('every role may read', () => {
    expect(
      Object.values(ROLE_CAPABILITIES).every((c) => c.canRead),
    ).toBe(true)
  })
})

describe('unresolved role', () => {
  it('grants nothing when the role is missing', () => {
    expect(capabilitiesFor(null)).toEqual(NO_CAPABILITIES)
    expect(capabilitiesFor(undefined)).toEqual(NO_CAPABILITIES)
  })

  it('grants nothing for an unrecognised role', () => {
    // e.g. a role added to the enum in SQL but not yet here — fail closed.
    expect(capabilitiesFor('superuser' as OrgRole)).toEqual(NO_CAPABILITIES)
  })
})
