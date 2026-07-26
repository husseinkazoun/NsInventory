import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { clearOrgCache } from './org'
import { clearAuthNotice, markSessionExpired } from './authNotice'

type SessionContextValue = {
  session: Session | null
  loading: boolean
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  loading: false,
})

/**
 * True while a *deliberate* sign-out is in flight.
 *
 * supabase-js emits `SIGNED_OUT` for both a user-initiated sign-out and an
 * expired/revoked credential, and the event itself carries no reason. This
 * flag is the only thing that distinguishes them, so `/login` can show
 * "your session expired" in one case and stay silent in the other.
 *
 * supabase-js emits `SIGNED_OUT` synchronously, before `auth.signOut()`
 * resolves, so the handler observes the flag while it is still set. That
 * ordering is asserted by `session.test.tsx` rather than assumed.
 */
let manualSignOutInFlight = false

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState<boolean>(supabase !== null)

  useEffect(() => {
    if (!supabase) {
      return
    }

    let active = true
    // The initial getSession() and the auth-event stream race on cold load.
    // Once any event has been applied, a late getSession() result is stale and
    // must not overwrite it — otherwise a fast sign-in can be clobbered by the
    // pre-sign-in snapshot.
    let sawAuthEvent = false

    supabase.auth.getSession().then(({ data }) => {
      if (!active || sawAuthEvent) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return
      sawAuthEvent = true

      if (event === 'SIGNED_OUT') {
        if (manualSignOutInFlight) {
          // Deliberate: no explanation needed on the sign-in page.
          clearAuthNotice()
        } else {
          // Not user-initiated — an expired or revoked credential, including
          // a background token refresh that failed while the tab sat idle.
          markSessionExpired()
        }
      }

      // Memberships are per-user; drop the cache on anything that changes who
      // (or whether) someone is signed in. TOKEN_REFRESHED keeps the cache:
      // same user, same memberships, just a fresh access token.
      if (event !== 'TOKEN_REFRESHED') clearOrgCache()

      setSession(next)
      setLoading(false)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return (
    <SessionContext.Provider value={{ session, loading }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext)
}

/**
 * Deliberate sign-out. Marks the sign-out as user-initiated so the resulting
 * `SIGNED_OUT` event does not raise the session-expired notice.
 */
export async function signOut(): Promise<void> {
  if (!supabase) return
  manualSignOutInFlight = true
  clearAuthNotice()
  try {
    await supabase.auth.signOut()
  } finally {
    // Cleared in `finally`: if signOut() rejects (network), leaving the flag
    // set would make the *next* genuine expiry look deliberate and swallow
    // its notice.
    manualSignOutInFlight = false
  }
}
