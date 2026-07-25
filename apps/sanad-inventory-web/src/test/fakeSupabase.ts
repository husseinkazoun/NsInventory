import { vi } from 'vitest'

/**
 * Mutable stand-in for `src/lib/supabaseClient.ts`.
 *
 * `supabaseClient` builds its singleton from `import.meta.env` at import time,
 * so tests cannot construct one. This module mocks it with a client whose
 * behaviour is driven by module-level state that a test can change *during*
 * the test — which is what the cross-user cache tests need, since they must
 * flip the signed-in user between two awaits.
 *
 * This is MOCKED verification. It exercises the resolver's own logic and
 * nothing else: RLS, PostgREST behaviour, and real token refresh are not
 * covered here and still require a live Supabase run.
 */

export type FakeMembership = {
  organizationId: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  name: string
  slug: string
}

type State = {
  userId: string | null
  /**
   * Rows keyed by `user_id`, because the real query is
   * `.eq('user_id', userId)`. Keying by user matters: a lookup started for one
   * user must resolve with that user's rows even if a different user signs in
   * before it is awaited. A single mutable `rows` array would silently return
   * whoever's data was current, making the cross-user tests meaningless.
   */
  rowsByUser: Record<string, unknown[]>
  queryError: unknown | null
  sessionError: unknown | null
  /** Auth events emitted by the fake, newest last. */
  authListeners: Array<(event: string, session: unknown) => void>
  signOutCalls: Array<{ scope?: string }>
  signOutRejects: boolean
  /** When set, signInWithPassword reports this instead of succeeding. */
  signInError: { message: string } | null
}

const state: State = {
  userId: null,
  rowsByUser: {},
  queryError: null,
  sessionError: null,
  authListeners: [],
  signOutCalls: [],
  signOutRejects: false,
  signInError: null,
}

export function resetFakeSupabase(): void {
  state.userId = null
  state.rowsByUser = {}
  state.queryError = null
  state.sessionError = null
  state.authListeners = []
  state.signOutCalls = []
  state.signOutRejects = false
  state.signInError = null
}

export function setSignedInUser(userId: string | null): void {
  state.userId = userId
}

export function setSessionError(error: unknown | null): void {
  state.sessionError = error
}

/**
 * Shapes memberships into the row form `fetchMemberships()` expects, stored
 * against a specific user id. Defaults to the currently signed-in user so the
 * common single-user test reads naturally.
 */
export function setMemberships(
  memberships: FakeMembership[],
  userId: string | null = state.userId,
): void {
  if (!userId) throw new Error('setMemberships: no user id (sign a user in first)')
  state.queryError = null
  state.rowsByUser[userId] = memberships.map((m) => ({
    organization_id: m.organizationId,
    role: m.role,
    organizations: { id: m.organizationId, name: m.name, slug: m.slug },
  }))
}

export function setQueryError(error: unknown | null): void {
  state.queryError = error
}

export function setSignOutRejects(value: boolean): void {
  state.signOutRejects = value
}

/** Makes the next signInWithPassword fail, as a wrong password would. */
export function setSignInError(error: { message: string } | null): void {
  state.signInError = error
}

export function getSignOutCalls(): Array<{ scope?: string }> {
  return state.signOutCalls
}

/** Emit an auth event to every subscriber, as supabase-js would. */
export function emitAuthEvent(event: string, session: unknown = null): void {
  for (const listener of state.authListeners) listener(event, session)
}

function sessionPayload() {
  return state.userId ? { user: { id: state.userId } } : null
}

const client = {
  auth: {
    async getSession() {
      return {
        data: { session: sessionPayload() },
        error: state.sessionError,
      }
    },
    onAuthStateChange(cb: (event: string, session: unknown) => void) {
      state.authListeners.push(cb)
      return {
        data: {
          subscription: {
            unsubscribe() {
              state.authListeners = state.authListeners.filter((l) => l !== cb)
            },
          },
        },
      }
    },
    async signOut(opts?: { scope?: string }) {
      state.signOutCalls.push({ scope: opts?.scope })
      // supabase-js emits SIGNED_OUT synchronously, before signOut() resolves.
      // Replicated so tests exercise the real ordering the notice logic
      // depends on.
      const previous = state.userId
      state.userId = null
      if (previous !== null) emitAuthEvent('SIGNED_OUT', null)
      if (state.signOutRejects) throw new Error('network failure')
      return { error: null }
    },
    /**
     * Mirrors supabase-js: on success the session is stored immediately, but
     * subscribers are notified asynchronously. The fake therefore updates the
     * signed-in user WITHOUT emitting `SIGNED_IN` — the test emits it when it
     * wants the event to land. That gap is exactly the first-login race.
     */
    async signInWithPassword({ email }: { email?: string } = {}) {
      if (state.signInError) {
        return { data: { session: null }, error: state.signInError }
      }
      state.userId = state.userId ?? `user-${(email ?? 'anon').split('@')[0]}`
      return { data: { session: sessionPayload() }, error: null }
    },
  },
  from() {
    return {
      select: () => ({
        // Mirrors `.eq('user_id', userId)`: the filter value decides the rows,
        // exactly as PostgREST would, rather than "whatever is current".
        eq: (_column: string, value: string) =>
          Promise.resolve({
            data: state.queryError ? null : (state.rowsByUser[value] ?? []),
            error: state.queryError,
          }),
      }),
    }
  },
}

/**
 * Installs the mock. Call at the top level of a test file, then `await
 * import()` the module under test so the mock is in place first.
 */
export function fakeSupabase(): void {
  // The path resolves relative to THIS file, so a single registration covers
  // every importer of src/lib/supabaseClient regardless of their own path.
  vi.mock('../lib/supabaseClient', () => ({
    supabase: client,
    isSupabaseConfigured: true,
    currentUserId: async () => state.userId,
  }))
}
