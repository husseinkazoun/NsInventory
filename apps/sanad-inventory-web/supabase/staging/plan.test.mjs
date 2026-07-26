import { describe, expect, it } from 'vitest'
import {
  STAGING_EMAIL_DOMAIN,
  STAGING_IDS,
  STAGING_ROLES,
  StagingGuardError,
  TEARDOWN_TABLE_ORDER,
  assertStagingTarget,
  buildStagingAccounts,
  buildStagingFixtures,
  isStagingEmail,
  readConfig,
  sampleImageBytes,
  stagingStorageObjectPath,
} from './plan.mjs'

const REF = 'abcdefghijklmnopqrst' // 20 lowercase letters, not a real project
const OTHER_REF = 'zyxwvutsrqponmlkjihg'

function validEnv(overrides = {}) {
  return {
    SUPABASE_STAGING_PROJECT_REF: REF,
    SUPABASE_STAGING_URL: `https://${REF}.supabase.co`,
    SUPABASE_STAGING_SERVICE_ROLE_KEY: 'test-service-role-key-placeholder',
    STAGING_USER_PASSWORD: 'a-long-enough-password',
    STAGING_BOOTSTRAP_CONFIRM: 'yes',
    ...overrides,
  }
}

describe('staging accounts', () => {
  it('creates exactly one account per role in the matrix', () => {
    const accounts = buildStagingAccounts()
    expect(accounts.map((a) => a.role)).toEqual(['owner', 'admin', 'member', 'viewer'])
    expect(accounts).toHaveLength(STAGING_ROLES.length)
  })

  it('uses only unroutable .invalid addresses', () => {
    // RFC 2606 reserves .invalid, so a stray email can never reach a person.
    for (const account of buildStagingAccounts()) {
      expect(account.email).toMatch(/@sanad-staging\.invalid$/)
      expect(account.email.endsWith('.invalid')).toBe(true)
    }
  })

  it('honours a custom domain', () => {
    const accounts = buildStagingAccounts('other-staging.invalid')
    expect(accounts.every((a) => a.email.endsWith('@other-staging.invalid'))).toBe(true)
  })

  it('produces unique emails', () => {
    const emails = buildStagingAccounts().map((a) => a.email)
    expect(new Set(emails).size).toBe(emails.length)
  })
})

describe('deterministic ids', () => {
  it('keeps ids stable across calls so re-runs update rather than duplicate', () => {
    expect(buildStagingFixtures()).toEqual(buildStagingFixtures())
  })

  it('marks every id with the staging prefix', () => {
    for (const id of Object.values(STAGING_IDS)) {
      expect(id.startsWith('5ada0000-')).toBe(true)
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
    }
  })

  it('uses distinct ids for every fixture', () => {
    const ids = Object.values(STAGING_IDS)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('fixtures', () => {
  const fixtures = buildStagingFixtures()

  it('scopes every row to the staging organization', () => {
    for (const rows of Object.values(fixtures)) {
      for (const row of rows) {
        expect(row.organization_id).toBe(STAGING_IDS.organization)
      }
    }
  })

  it('covers the tables a role walkthrough needs', () => {
    expect(Object.keys(fixtures).sort()).toEqual([
      'activity_log',
      'categories',
      'lab_assets',
      'missing_components',
      'photo_scans',
      'scan_sessions',
      'units',
    ])
  })

  it('uses only values the schema enums allow', () => {
    const statuses = ['active', 'maintenance', 'inactive', 'disposed']
    const conditions = ['excellent', 'good', 'fair', 'poor', 'broken']
    for (const asset of fixtures.lab_assets) {
      expect(statuses).toContain(asset.status)
      expect(conditions).toContain(asset.condition)
    }
    expect(['intake', 'condition', 'missing']).toContain(fixtures.scan_sessions[0].scan_type)
    expect(['minor', 'medium', 'critical']).toContain(fixtures.missing_components[0].severity)
    expect(['created', 'updated', 'deleted', 'assigned', 'scanned', 'condition_changed', 'maintenance'])
      .toContain(fixtures.activity_log[0].action)
  })

  it('points the photo scan at the storage object it seeds', () => {
    expect(fixtures.photo_scans[0].image_path).toBe(stagingStorageObjectPath())
  })

  it('builds a storage path the org-prefix RLS rule can parse', () => {
    // storage policies read the leading UUID via public.scan_object_org(name)
    const path = stagingStorageObjectPath()
    expect(path.startsWith(`${STAGING_IDS.organization}/`)).toBe(true)
    expect(path.split('/')[0]).toHaveLength(36)
  })

  it('leaves a spare asset so a delete test does not empty the list', () => {
    expect(fixtures.lab_assets.length).toBeGreaterThanOrEqual(3)
  })
})

describe('teardown ordering', () => {
  it('clears child rows before organization_members', () => {
    // lab_assets.created_by -> profiles has no ON DELETE action, so org rows
    // must be removed before accounts are.
    expect(TEARDOWN_TABLE_ORDER.indexOf('lab_assets'))
      .toBeLessThan(TEARDOWN_TABLE_ORDER.indexOf('organization_members'))
    expect(TEARDOWN_TABLE_ORDER.indexOf('photo_scans'))
      .toBeLessThan(TEARDOWN_TABLE_ORDER.indexOf('scan_sessions'))
    expect(TEARDOWN_TABLE_ORDER.indexOf('missing_components'))
      .toBeLessThan(TEARDOWN_TABLE_ORDER.indexOf('lab_assets'))
  })

  it('covers every table the fixtures write', () => {
    for (const table of Object.keys(buildStagingFixtures())) {
      expect(TEARDOWN_TABLE_ORDER).toContain(table)
    }
  })
})

describe('staging email matching', () => {
  it('matches only the configured staging domain', () => {
    expect(isStagingEmail(`owner@${STAGING_EMAIL_DOMAIN}`)).toBe(true)
    expect(isStagingEmail('owner@example.com')).toBe(false)
    expect(isStagingEmail('owner@sanad-staging.invalid.example.com')).toBe(false)
    expect(isStagingEmail(null)).toBe(false)
    expect(isStagingEmail(undefined)).toBe(false)
  })
})

describe('safety guards', () => {
  it('accepts a correctly named staging target', () => {
    expect(() =>
      assertStagingTarget({
        url: `https://${REF}.supabase.co`,
        projectRef: REF,
        confirm: 'yes',
      }),
    ).not.toThrow()
  })

  it('refuses when the project ref is missing', () => {
    expect(() => assertStagingTarget({ url: 'https://x.supabase.co', confirm: 'yes' }))
      .toThrow(StagingGuardError)
  })

  it('refuses a malformed project ref', () => {
    expect(() =>
      assertStagingTarget({ url: 'https://nope.supabase.co', projectRef: 'nope', confirm: 'yes' }),
    ).toThrow(/does not look like a project ref/)
  })

  it('refuses when the URL does not contain the named ref', () => {
    // The case that matters: operator points at one project but names another.
    expect(() =>
      assertStagingTarget({
        url: `https://${OTHER_REF}.supabase.co`,
        projectRef: REF,
        confirm: 'yes',
      }),
    ).toThrow(/does not contain/)
  })

  it('refuses a ref listed as production', () => {
    expect(() =>
      assertStagingTarget({
        url: `https://${REF}.supabase.co`,
        projectRef: REF,
        confirm: 'yes',
        productionRefs: [REF],
      }),
    ).toThrow(/listed in SUPABASE_PRODUCTION_PROJECT_REFS/)
  })

  it('refuses a URL pointing at a production project even under another name', () => {
    expect(() =>
      assertStagingTarget({
        url: `https://${OTHER_REF}.supabase.co/rest`,
        projectRef: OTHER_REF,
        confirm: 'yes',
        productionRefs: [OTHER_REF],
      }),
    ).toThrow(/Refusing to run/)
  })

  it('refuses without explicit confirmation', () => {
    expect(() =>
      assertStagingTarget({ url: `https://${REF}.supabase.co`, projectRef: REF }),
    ).toThrow(/STAGING_BOOTSTRAP_CONFIRM/)
    expect(() =>
      assertStagingTarget({ url: `https://${REF}.supabase.co`, projectRef: REF, confirm: 'no' }),
    ).toThrow(/STAGING_BOOTSTRAP_CONFIRM/)
  })

  it('hardcodes no production reference of its own', () => {
    // Committing one would put a production identifier in the repo; the deny
    // list is supplied by the operator instead.
    expect(() =>
      assertStagingTarget({
        url: `https://${REF}.supabase.co`,
        projectRef: REF,
        confirm: 'yes',
        productionRefs: [],
      }),
    ).not.toThrow()
  })
})

describe('readConfig', () => {
  it('returns a normalised config from a valid environment', () => {
    const config = readConfig(validEnv())
    expect(config.projectRef).toBe(REF)
    expect(config.emailDomain).toBe(STAGING_EMAIL_DOMAIN)
    expect(config.orgSlug).toBe('sanad-staging')
    expect(config.productionRefs).toEqual([])
  })

  it('parses a comma-separated production deny list', () => {
    const config = readConfig(
      validEnv({ SUPABASE_PRODUCTION_PROJECT_REFS: ` ${OTHER_REF} , ` }),
    )
    expect(config.productionRefs).toEqual([OTHER_REF])
  })

  it('requires the service-role key', () => {
    expect(() => readConfig(validEnv({ SUPABASE_STAGING_SERVICE_ROLE_KEY: '' })))
      .toThrow(/SERVICE_ROLE_KEY/)
  })

  it('rejects a short password', () => {
    expect(() => readConfig(validEnv({ STAGING_USER_PASSWORD: 'short' })))
      .toThrow(/at least 12 characters/)
  })

  it('applies overrides for domain and slug', () => {
    const config = readConfig(
      validEnv({ STAGING_EMAIL_DOMAIN: 'alt.invalid', STAGING_ORG_SLUG: 'alt-slug' }),
    )
    expect(config.emailDomain).toBe('alt.invalid')
    expect(config.orgSlug).toBe('alt-slug')
  })
})

describe('sample image', () => {
  it('is a real PNG so Storage receives valid bytes', () => {
    const bytes = sampleImageBytes()
    expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(bytes.length).toBeLessThan(200)
  })
})
