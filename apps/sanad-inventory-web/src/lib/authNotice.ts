/**
 * One-shot notice explaining *why* the user is looking at the sign-in page.
 *
 * Without this, an expired session and a deliberate sign-out are
 * indistinguishable at `/login` — both simply have no session. The notice is
 * set on the expiry path only, so a normal sign-out never shows it.
 *
 * Stored in `sessionStorage` rather than a module variable so it survives a
 * hard reload (a token that expires while the tab is closed fails its refresh
 * during boot, long before any React state exists). It is scoped to the tab
 * and cleared on read, so it can never persist into a later sign-in.
 */

export type AuthNotice = 'session-expired'

const KEY = 'sanad.inventory.authNotice'

/**
 * Human-readable text for each notice. Deliberately generic: it must never
 * carry a Supabase, JWT or PostgREST error string, which would leak backend
 * detail to an unauthenticated page.
 */
export const AUTH_NOTICE_MESSAGES: Record<AuthNotice, string> = {
  'session-expired': 'Your session has expired. Please sign in again.',
}

/** Records that the session ended because the credential expired. */
export function markSessionExpired(): void {
  try {
    window.sessionStorage.setItem(KEY, 'session-expired')
  } catch {
    // Private mode / storage disabled: the user still gets redirected to
    // /login, just without the explanatory message. Non-fatal.
  }
}

/** Clears any pending notice — used when a sign-out was deliberate. */
export function clearAuthNotice(): void {
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    // Non-fatal, as above.
  }
}

/**
 * Reads and clears the pending notice. "One-shot": the message shows on the
 * redirect that follows the expiry and not on any later visit to /login.
 */
export function consumeAuthNotice(): AuthNotice | null {
  try {
    const value = window.sessionStorage.getItem(KEY)
    if (value === 'session-expired') {
      window.sessionStorage.removeItem(KEY)
      return 'session-expired'
    }
    return null
  } catch {
    return null
  }
}
