import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '../../lib/session'
import { isSupabaseConfigured } from '../../lib/supabaseClient'

/**
 * Wraps protected routes.
 *
 * - When Supabase is not configured (no env vars), AuthGuard transparently
 *   renders its children — this is the "demo mode" used for offline previews.
 * - When Supabase is configured and the user has a session, render children.
 * - When Supabase is configured and there's no session, redirect to /login
 *   while preserving the attempted destination in router state so we can
 *   bounce the user back after sign-in.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { session, loading } = useSession()
  const location = useLocation()

  if (!isSupabaseConfigured) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <div className="text-sm text-slate-400">Loading…</div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
