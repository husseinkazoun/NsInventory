import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// When either env var is missing, `supabase` is null and the app falls back
// to demo mode (mock data, AuthGuard bypassed).
const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null

export const isSupabaseConfigured: boolean = supabase !== null

// Resolve the signed-in user's id from the cached session (no network call).
// Returns null in demo mode or when no session is available, so callers can
// safely fall back to leaving audit fields null.
export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}
