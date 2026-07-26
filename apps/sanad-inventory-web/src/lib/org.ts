import { supabase } from './supabaseClient'

/**
 * Current-organization resolver.
 *
 * Replaces the former `DEV_ORG_ID` constant. Every organization-scoped read
 * and write in the query layer resolves its `organization_id` through here,
 * derived from the signed-in user's `organization_members` rows.
 *
 * Design notes
 * ------------
 * - This module is deliberately framework-free (no JSX, no hooks) so the plain
 *   async query functions in `lib/queries/*` can await it directly. The React
 *   surface (`lib/orgContext.tsx`) reads the *same* module state, so the UI and
 *   the query layer can never disagree about which org is active.
 * - There is **no development fallback**. When membership cannot be resolved
 *   the resolver throws a typed error and the caller surfaces it. Silently
 *   defaulting to a seeded org would write rows into the wrong tenant.
 */

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer'

export type OrgMembership = {
  organizationId: string
  role: OrgRole
  name: string
  slug: string
}

// ── Typed errors ──────────────────────────────────────────────────────
// Callers (pages, OrgGate) branch on these rather than on message text.

/** Supabase env vars are unset — the app is in demo mode. */
export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super('Supabase is not configured; no organization can be resolved.')
    this.name = 'SupabaseNotConfiguredError'
  }
}

/** No usable session: signed out, or the refresh token is no longer valid. */
export class SessionExpiredError extends Error {
  constructor(message = 'Your session has expired. Please sign in again.') {
    super(message)
    this.name = 'SessionExpiredError'
  }
}

/** Authenticated, but the user is not a member of any organization. */
export class NoOrganizationError extends Error {
  constructor() {
    super(
      'Your account is not a member of any organization. Ask an administrator to add you to one.',
    )
    this.name = 'NoOrganizationError'
  }
}

/** Member of several organizations and none has been chosen yet. */
export class OrganizationNotSelectedError extends Error {
  constructor() {
    super(
      'You belong to more than one organization. Choose which one to work in.',
    )
    this.name = 'OrganizationNotSelectedError'
  }
}

// ── Auth-expiry classification ────────────────────────────────────────

/**
 * True when a PostgREST / Storage / GoTrue error means "the JWT is no longer
 * good", as opposed to an ordinary query failure. PostgREST reports an expired
 * or malformed JWT as `PGRST301` with HTTP 401.
 */
export function isAuthExpiryError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: unknown; status?: unknown; message?: unknown }

  if (e.code === 'PGRST301' || e.code === 'PGRST302') return true
  if (e.status === 401) return true

  const message = typeof e.message === 'string' ? e.message.toLowerCase() : ''
  return (
    message.includes('jwt expired') ||
    message.includes('jwt is expired') ||
    message.includes('invalid jwt') ||
    message.includes('invalid claim') ||
    message.includes('refresh_token_not_found')
  )
}

/**
 * Normalises an error coming out of a Supabase call.
 *
 * When the failure is an expired credential we drop the local session. That
 * emits `SIGNED_OUT`, which `SessionProvider` sees as *not* user-initiated and
 * therefore records the session-expired notice; `AuthGuard` then redirects to
 * `/login`, where the notice is displayed. Scope is `local` on purpose: a
 * server-side sign-out would itself 401 on a dead token.
 *
 * Note this function deliberately does **not** raise the notice itself. The
 * `SIGNED_OUT` handler is the single place that decides expiry-vs-deliberate,
 * and it also catches the case this function cannot see: a background token
 * refresh that fails while the tab is idle.
 */
export function asAppError(err: unknown): unknown {
  if (!isAuthExpiryError(err)) return err
  clearOrgCache()
  if (supabase) {
    void supabase.auth.signOut({ scope: 'local' }).catch(() => {
      // Best effort — the typed error below is what the caller reacts to.
    })
  }
  return new SessionExpiredError()
}

// ── Membership cache ──────────────────────────────────────────────────
// Keyed by user id so a sign-in as a different user can never reuse the
// previous user's memberships, even if `clearOrgCache()` were missed.

type CacheEntry = { userId: string; memberships: Promise<OrgMembership[]> }
let cache: CacheEntry | null = null

/** Drops the cached membership lookup. Called on every auth state change. */
export function clearOrgCache(): void {
  cache = null
}

async function requireUserId(): Promise<string> {
  if (!supabase) throw new SupabaseNotConfiguredError()
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new SessionExpiredError()
  const userId = data.session?.user?.id
  if (!userId) throw new SessionExpiredError()
  return userId
}

async function fetchMemberships(userId: string): Promise<OrgMembership[]> {
  if (!supabase) throw new SupabaseNotConfiguredError()

  // `organizations!inner` guarantees a row for the embedded org; both
  // `organization_members` and `organizations` are RLS-gated by
  // `is_org_member()`, which is SECURITY DEFINER and therefore resolves the
  // user's own rows without recursing through the policy being evaluated.
  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id, role, organizations!inner ( id, name, slug )')
    .eq('user_id', userId)

  if (error) throw asAppError(error)

  type Row = {
    organization_id: string
    role: OrgRole
    organizations: { id: string; name: string; slug: string } | null
  }

  return ((data ?? []) as unknown as Row[])
    .filter((row) => row.organizations !== null)
    .map((row) => ({
      organizationId: row.organization_id,
      role: row.role,
      name: row.organizations!.name,
      slug: row.organizations!.slug,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Memberships for a *specific* user id.
 *
 * Takes the id as an argument rather than re-reading the session, so a caller
 * that has already resolved a user id cannot end up pairing one user's
 * memberships with another user's stored organization selection.
 */
function listMembershipsFor(userId: string): Promise<OrgMembership[]> {
  if (cache && cache.userId === userId) return cache.memberships

  const entry: CacheEntry = { userId, memberships: null as never }
  entry.memberships = fetchMemberships(userId).catch((err) => {
    // Never cache a failure — a transient network error would otherwise pin
    // the user to an error state until the next auth event. Compared by
    // identity, not user id: if a different user's lookup has replaced this
    // entry in the meantime, evicting it would be someone else's cache.
    if (cache === entry) cache = null
    throw err
  })

  cache = entry

  // Return the locally captured promise, never `cache.memberships`. A
  // concurrent lookup for a different user may replace `cache` before this
  // resolves; reading it back would hand this caller the other user's rows.
  return entry.memberships
}

/** The signed-in user's organizations, cached per user id. */
export function listMemberships(): Promise<OrgMembership[]> {
  return requireUserId().then(listMembershipsFor)
}

// ── Selected organization (multi-org users) ───────────────────────────

const STORAGE_PREFIX = 'sanad.inventory.currentOrg:'

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

function readStoredOrgId(userId: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(userId))
  } catch {
    // Private-mode / disabled storage: fall through to the picker each time.
    return null
  }
}

function writeStoredOrgId(userId: string, orgId: string): void {
  try {
    window.localStorage.setItem(storageKey(userId), orgId)
  } catch {
    // Non-fatal: the selection just won't survive a reload.
  }
}

/**
 * Persists the active organization for a multi-org user.
 * Rejects ids the user is not actually a member of.
 */
export async function selectOrganization(orgId: string): Promise<void> {
  const userId = await requireUserId()
  const memberships = await listMembershipsFor(userId)
  if (!memberships.some((m) => m.organizationId === orgId)) {
    throw new Error('You are not a member of that organization.')
  }
  writeStoredOrgId(userId, orgId)
}

// ── Resolution ────────────────────────────────────────────────────────

export type OrgResolution =
  | {
      status: 'ready'
      organizationId: string
      membership: OrgMembership
      memberships: OrgMembership[]
    }
  | { status: 'needs-selection'; memberships: OrgMembership[] }
  | { status: 'no-membership' }
  | { status: 'session-expired' }

/**
 * Resolves the active organization as data rather than by throwing, so the
 * React layer can render one screen per state. Unexpected failures (network,
 * schema) still throw and are surfaced as an error state by the caller.
 */
export async function resolveOrgState(): Promise<OrgResolution> {
  let userId: string
  try {
    userId = await requireUserId()
  } catch (err) {
    if (err instanceof SessionExpiredError) return { status: 'session-expired' }
    throw err
  }

  // Reuse the id resolved above rather than calling listMemberships(), which
  // would re-read the session. Between the two reads the signed-in user can
  // change, which would pair one user's memberships with another user's
  // stored selection.
  let memberships: OrgMembership[]
  try {
    memberships = await listMembershipsFor(userId)
  } catch (err) {
    if (err instanceof SessionExpiredError) return { status: 'session-expired' }
    throw err
  }

  if (memberships.length === 0) return { status: 'no-membership' }

  if (memberships.length === 1) {
    return {
      status: 'ready',
      organizationId: memberships[0].organizationId,
      membership: memberships[0],
      memberships,
    }
  }

  const stored = readStoredOrgId(userId)
  const chosen = stored
    ? memberships.find((m) => m.organizationId === stored)
    : undefined

  // A stored id that is no longer a valid membership (access revoked, org
  // deleted) falls through to the picker rather than to an arbitrary org.
  if (!chosen) return { status: 'needs-selection', memberships }

  return {
    status: 'ready',
    organizationId: chosen.organizationId,
    membership: chosen,
    memberships,
  }
}

/**
 * The organization id for the current user, or a typed throw.
 *
 * This is the single entry point used by the query layer. It never returns a
 * fallback id — an unresolved organization is an error, not a default.
 */
export async function resolveCurrentOrgId(): Promise<string> {
  const state = await resolveOrgState()
  switch (state.status) {
    case 'ready':
      return state.organizationId
    case 'needs-selection':
      throw new OrganizationNotSelectedError()
    case 'no-membership':
      throw new NoOrganizationError()
    case 'session-expired':
      throw new SessionExpiredError()
  }
}
