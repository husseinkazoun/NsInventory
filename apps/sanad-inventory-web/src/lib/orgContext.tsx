import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isSupabaseConfigured } from './supabaseClient'
import { useSession } from './session'
import {
  resolveOrgState,
  selectOrganization as persistOrganization,
  type OrgMembership,
} from './org'

/**
 * React surface over `lib/org.ts`.
 *
 * The provider does not own the resolution logic — it renders whatever
 * `resolveOrgState()` reports, so the UI and the query layer always agree on
 * the active organization.
 */
export type OrgState =
  /** Demo mode: Supabase env vars unset, mock data everywhere, no tenancy. */
  | { status: 'demo' }
  | { status: 'loading' }
  | {
      status: 'ready'
      organizationId: string
      membership: OrgMembership
      memberships: OrgMembership[]
    }
  | { status: 'needs-selection'; memberships: OrgMembership[] }
  | { status: 'no-membership' }
  | { status: 'session-expired' }
  | { status: 'error'; message: string }

type OrgContextValue = OrgState & {
  /** Persist a choice for a multi-org user and re-resolve. */
  selectOrganization: (orgId: string) => Promise<void>
  refresh: () => void
}

const OrgContext = createContext<OrgContextValue>({
  status: 'demo',
  selectOrganization: async () => {},
  refresh: () => {},
})

export function OrgProvider({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading } = useSession()
  const [state, setState] = useState<OrgState>(
    isSupabaseConfigured ? { status: 'loading' } : { status: 'demo' },
  )
  const [nonce, setNonce] = useState(0)

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setState({ status: 'demo' })
      return
    }

    // Wait for the session bootstrap before deciding anything; resolving too
    // early would report 'session-expired' on every cold load.
    if (sessionLoading) {
      setState({ status: 'loading' })
      return
    }

    if (!userId) {
      // AuthGuard owns the redirect to /login; nothing to resolve here.
      setState({ status: 'session-expired' })
      return
    }

    let cancelled = false
    setState({ status: 'loading' })

    resolveOrgState()
      .then((resolution) => {
        if (cancelled) return
        setState(resolution)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      })

    return () => {
      cancelled = true
    }
  }, [userId, sessionLoading, nonce])

  const selectOrganization = useCallback(
    async (orgId: string) => {
      await persistOrganization(orgId)
      refresh()
    },
    [refresh],
  )

  const value = useMemo<OrgContextValue>(
    () => ({ ...state, selectOrganization, refresh }),
    [state, selectOrganization, refresh],
  )

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useCurrentOrg(): OrgContextValue {
  return useContext(OrgContext)
}
