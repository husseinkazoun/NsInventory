/**
 * Staging bootstrap plan — pure, side-effect free.
 *
 * Everything that decides *what* will be created lives here so it can be unit
 * tested without a network, a database, or a service-role key. `bootstrap.mjs`
 * and `teardown.mjs` are thin runners over this module.
 *
 * Nothing in this file contains a real credential, a production project
 * reference, a real email address, or any production identifier.
 */

/** Reserved TLD (RFC 2606) — these addresses can never route anywhere. */
export const STAGING_EMAIL_DOMAIN = 'sanad-staging.invalid'

/** Slug/name of the single organization this package creates. */
export const STAGING_ORG_SLUG = 'sanad-staging'
export const STAGING_ORG_NAME = 'Sanad Inventory (STAGING)'

/**
 * Deterministic ids so re-running updates the same rows instead of creating
 * duplicates, and so teardown can target exactly what bootstrap created.
 * The `5ada` prefix marks every row this package owns.
 */
export const STAGING_IDS = {
  organization: '5ada0000-0000-4000-8000-000000000001',
  categoryConsumables: '5ada0000-0000-4000-8000-000000000011',
  categoryEquipment: '5ada0000-0000-4000-8000-000000000012',
  unitEach: '5ada0000-0000-4000-8000-000000000021',
  unitBox: '5ada0000-0000-4000-8000-000000000022',
  assetCentrifuge: '5ada0000-0000-4000-8000-000000000031',
  assetMicroscope: '5ada0000-0000-4000-8000-000000000032',
  assetBalance: '5ada0000-0000-4000-8000-000000000033',
  scanSession: '5ada0000-0000-4000-8000-000000000041',
  photoScan: '5ada0000-0000-4000-8000-000000000051',
  missingComponent: '5ada0000-0000-4000-8000-000000000061',
  activityLog: '5ada0000-0000-4000-8000-000000000071',
}

/** The four roles under test, one fake account each. */
export const STAGING_ROLES = ['owner', 'admin', 'member', 'viewer']

export const STORAGE_BUCKET = 'lab-asset-scans'

/** Object key is `{organization_id}/{scan_session_id}/{file}` — see scan_object_org(). */
export function stagingStorageObjectPath() {
  return `${STAGING_IDS.organization}/${STAGING_IDS.scanSession}/staging-sample.png`
}

/** Fake accounts, derived from the role list so the two can never drift. */
export function buildStagingAccounts(domain = STAGING_EMAIL_DOMAIN) {
  return STAGING_ROLES.map((role) => ({
    role,
    email: `${role}@${domain}`,
    fullName: `Staging ${role[0].toUpperCase()}${role.slice(1)}`,
  }))
}

/**
 * Rows seeded after the accounts exist. Deliberately minimal: just enough for
 * a human to confirm each role's read/write/delete behaviour end to end.
 */
export function buildStagingFixtures() {
  const org = STAGING_IDS.organization
  return {
    categories: [
      { id: STAGING_IDS.categoryConsumables, organization_id: org, name: 'Consumables (staging)', slug: 'staging-consumables' },
      { id: STAGING_IDS.categoryEquipment,   organization_id: org, name: 'Equipment (staging)',   slug: 'staging-equipment' },
    ],
    units: [
      { id: STAGING_IDS.unitEach, organization_id: org, name: 'Each (staging)', short_code: 'sea' },
      { id: STAGING_IDS.unitBox,  organization_id: org, name: 'Box (staging)',  short_code: 'sbx' },
    ],
    lab_assets: [
      {
        id: STAGING_IDS.assetCentrifuge, organization_id: org,
        tag: 'STG-LA-0001', name: 'Staging Centrifuge',
        manufacturer: 'Acme Labs', model: 'CF-100', serial: 'STG-CF-0001',
        location: 'Staging Bench 1',
        category_id: STAGING_IDS.categoryEquipment, unit_id: STAGING_IDS.unitEach,
        status: 'active', condition: 'good',
      },
      {
        id: STAGING_IDS.assetMicroscope, organization_id: org,
        tag: 'STG-LA-0002', name: 'Staging Microscope',
        manufacturer: 'Acme Labs', model: 'MS-200', serial: 'STG-MS-0002',
        location: 'Staging Bench 2',
        category_id: STAGING_IDS.categoryEquipment, unit_id: STAGING_IDS.unitEach,
        status: 'maintenance', condition: 'fair',
      },
      {
        // A third asset exists purely so a delete test leaves the list non-empty.
        id: STAGING_IDS.assetBalance, organization_id: org,
        tag: 'STG-LA-0003', name: 'Staging Balance (safe to delete)',
        manufacturer: 'Acme Labs', model: 'BL-050', serial: 'STG-BL-0003',
        location: 'Staging Store',
        category_id: STAGING_IDS.categoryEquipment, unit_id: STAGING_IDS.unitEach,
        status: 'inactive', condition: 'poor',
      },
    ],
    scan_sessions: [
      {
        id: STAGING_IDS.scanSession, organization_id: org,
        lab_asset_id: STAGING_IDS.assetCentrifuge,
        scan_type: 'intake', status: 'completed',
        summary: { confidence: 0.9, detected_condition: 'good', staging: true },
      },
    ],
    photo_scans: [
      {
        id: STAGING_IDS.photoScan, organization_id: org,
        scan_session_id: STAGING_IDS.scanSession,
        lab_asset_id: STAGING_IDS.assetCentrifuge,
        image_path: stagingStorageObjectPath(),
        photo_type: 'overview', processing_status: 'completed',
        confidence: 0.9, extracted: { staging: true },
      },
    ],
    missing_components: [
      {
        id: STAGING_IDS.missingComponent, organization_id: org,
        lab_asset_id: STAGING_IDS.assetCentrifuge,
        scan_session_id: STAGING_IDS.scanSession,
        component_name: 'Staging power cable', severity: 'minor', status: 'missing',
      },
    ],
    activity_log: [
      {
        id: STAGING_IDS.activityLog, organization_id: org,
        entity_type: 'lab_asset', entity_id: STAGING_IDS.assetCentrifuge,
        action: 'scanned', description: 'Staging seed activity row',
        meta: { staging: true },
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Runtime requirement
// ─────────────────────────────────────────────────────────────────────────

/**
 * Minimum Node major version for the staging scripts.
 *
 * Both runners use `@supabase/supabase-js`, whose realtime client requires a
 * native `WebSocket`. Node gained that in 22; on Node 20 the client throws at
 * `createClient()` with a message about installing the `ws` package, which
 * gives no hint that the real problem is the runtime version. Supabase also
 * dropped Node 20 support for its client libraries on 2026-06-30.
 *
 * Checking here means the failure is reported before any configuration is
 * read and before any network call is made.
 */
export const MIN_NODE_MAJOR = 22

export class NodeVersionError extends Error {
  constructor(message) {
    super(message)
    this.name = 'NodeVersionError'
  }
}

/** Extracts the major version from a string like `v22.22.1`. */
export function parseNodeMajor(version) {
  const match = /^v?(\d+)\./.exec(String(version ?? '').trim())
  return match ? Number(match[1]) : null
}

/**
 * Throws unless the runtime is new enough. Pure: takes the version string, so
 * every branch is testable without spawning another Node.
 */
export function assertSupportedNode(version = process.version) {
  const major = parseNodeMajor(version)

  if (major === null) {
    throw new NodeVersionError(
      `Could not determine the Node.js version (saw "${version}"). ` +
        `Node.js ${MIN_NODE_MAJOR} or newer is required.`,
    )
  }

  if (major < MIN_NODE_MAJOR) {
    throw new NodeVersionError(
      `Node.js ${MIN_NODE_MAJOR} or newer is required — found ${version}.\n` +
        `  The Supabase JavaScript client needs native WebSocket support, which\n` +
        `  Node ${major} does not provide, and Supabase dropped Node 20 support for\n` +
        `  its client libraries on 2026-06-30.\n` +
        `  Switch runtime, e.g.  nvm use ${MIN_NODE_MAJOR}  (or newer), then re-run.`,
    )
  }

  return major
}

// ─────────────────────────────────────────────────────────────────────────
// Safety guards
// ─────────────────────────────────────────────────────────────────────────

export class StagingGuardError extends Error {
  constructor(message) {
    super(message)
    this.name = 'StagingGuardError'
  }
}

const PROJECT_REF_PATTERN = /^[a-z]{20}$/

/**
 * Refuses to proceed unless the caller has *explicitly* named a staging
 * project and confirmed intent.
 *
 * Deliberately no production reference is hardcoded here — committing one
 * would put a production identifier in the repository. Instead the operator
 * lists their production refs in SUPABASE_PRODUCTION_PROJECT_REFS locally and
 * this refuses to touch any of them.
 */
export function assertStagingTarget({
  url,
  projectRef,
  confirm,
  productionRefs = [],
} = {}) {
  if (!projectRef) {
    throw new StagingGuardError(
      'SUPABASE_STAGING_PROJECT_REF is required. Name the staging project explicitly.',
    )
  }
  if (!PROJECT_REF_PATTERN.test(projectRef)) {
    throw new StagingGuardError(
      `SUPABASE_STAGING_PROJECT_REF "${projectRef}" does not look like a project ref (20 lowercase letters).`,
    )
  }
  if (!url) {
    throw new StagingGuardError('SUPABASE_STAGING_URL is required.')
  }
  if (!url.includes(projectRef)) {
    throw new StagingGuardError(
      'SUPABASE_STAGING_URL does not contain SUPABASE_STAGING_PROJECT_REF. ' +
        'Refusing to run against a project you did not name.',
    )
  }
  const blocked = productionRefs.filter(Boolean).map((r) => r.trim())
  if (blocked.includes(projectRef)) {
    throw new StagingGuardError(
      `Project ref "${projectRef}" is listed in SUPABASE_PRODUCTION_PROJECT_REFS. Refusing to run.`,
    )
  }
  for (const ref of blocked) {
    if (url.includes(ref)) {
      throw new StagingGuardError(
        'SUPABASE_STAGING_URL points at a project listed in SUPABASE_PRODUCTION_PROJECT_REFS. Refusing to run.',
      )
    }
  }
  if (confirm !== 'yes') {
    throw new StagingGuardError(
      'STAGING_BOOTSTRAP_CONFIRM must be set to "yes" to acknowledge this writes to a hosted project.',
    )
  }
  return true
}

/** Reads and validates configuration from the environment. */
export function readConfig(env = {}) {
  const config = {
    url: env.SUPABASE_STAGING_URL,
    projectRef: env.SUPABASE_STAGING_PROJECT_REF,
    serviceRoleKey: env.SUPABASE_STAGING_SERVICE_ROLE_KEY,
    password: env.STAGING_USER_PASSWORD,
    emailDomain: env.STAGING_EMAIL_DOMAIN || STAGING_EMAIL_DOMAIN,
    orgSlug: env.STAGING_ORG_SLUG || STAGING_ORG_SLUG,
    confirm: env.STAGING_BOOTSTRAP_CONFIRM,
    productionRefs: (env.SUPABASE_PRODUCTION_PROJECT_REFS || '')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean),
  }

  assertStagingTarget(config)

  if (!config.serviceRoleKey) {
    throw new StagingGuardError('SUPABASE_STAGING_SERVICE_ROLE_KEY is required.')
  }
  if (!config.password || config.password.length < 12) {
    throw new StagingGuardError(
      'STAGING_USER_PASSWORD is required and must be at least 12 characters.',
    )
  }
  return config
}

/** True when an email belongs to this package's fake accounts. */
export function isStagingEmail(email, domain = STAGING_EMAIL_DOMAIN) {
  return typeof email === 'string' && email.toLowerCase().endsWith(`@${domain}`)
}

/**
 * Tables that teardown clears, in an order that respects the foreign keys.
 * lab_assets.created_by references profiles with no ON DELETE action, so every
 * org-scoped row must go before the accounts are removed.
 */
export const TEARDOWN_TABLE_ORDER = [
  'activity_log',
  'missing_components',
  'photo_scans',
  'scan_sessions',
  'lab_assets',
  'categories',
  'units',
  'organization_members',
]

/** A 1×1 transparent PNG — smallest realistic object for a Storage RLS check. */
export function sampleImageBytes() {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ])
}
