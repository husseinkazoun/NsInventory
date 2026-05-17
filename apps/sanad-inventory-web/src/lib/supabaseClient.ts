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
