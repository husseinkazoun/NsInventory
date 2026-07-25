// supabase/functions/scan-process/index.ts
//
// Sanad Inventory — Photo Scan endpoint.
//
// Entry point only. All request handling lives in `handler.ts`, which takes
// its dependencies as arguments so it can be tested without a server or a
// network. Keeping this file thin is what makes that possible.
//
// Authentication follows the current Supabase guidance ("Securing Edge
// Functions"): `createSupabaseContext` with `auth: 'user'`, which validates
// the caller's JWT and returns a Supabase client already scoped to them, so
// RLS applies to every query the handler makes. `createSupabaseContext` is
// used rather than `withSupabase` because the handler shapes its own generic
// error responses.
//
// `verify_jwt = true` is set explicitly for this function in config.toml.
// That is the platform default, and it is the setting this pattern expects:
// the platform rejects requests with no valid JWT before this code runs, and
// the handler then decides what the authenticated caller may actually reach.
//
// The extraction is still simulated — see handler.ts. No AI provider is
// called and no provider key is read here. Nothing is logged: no tokens, no
// image bytes, no identifiers.
//
// Deploy: supabase functions deploy scan-process
//         (do NOT pass --no-verify-jwt)

// The npm specifier is pinned in deno.json's import map (@supabase/server ->
// npm:@supabase/server@1.4.1) and recorded in deno.lock, so `deno check` and
// `deno test` resolve and type-check this file. This function lives outside the
// Vite/tsc build (tsconfig `include` is `src` only), which never sees it.
import { createSupabaseContext } from '@supabase/server'
import { handleScanProcess, type CallerContext } from './handler.ts'

/**
 * Origins permitted to call this function from a browser.
 *
 * Overridable with the ALLOWED_ORIGINS secret (comma-separated) so a new
 * staging or preview origin does not require a code change. The defaults
 * cover local development and the existing Pages deployment.
 */
function allowedOrigins(): string[] {
  const configured = Deno.env.get('ALLOWED_ORIGINS')
  if (configured && configured.trim()) {
    return configured
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  }
  return [
    'http://127.0.0.1:5174',
    'http://localhost:5174',
    'https://sanad-inventory.pages.dev',
  ]
}

async function createContext(req: Request): Promise<CallerContext | null> {
  const { data, error } = await createSupabaseContext(req, { auth: 'user' })
  if (error || !data) return null

  // `UserClaims.id` is the normalized user id — @supabase/server derives it as
  // `jwtClaims.sub`, so it equals the JWT subject by construction. (The former
  // `?? data.userClaims?.sub` first operand was always undefined: the
  // normalized claims object has no `sub` field. @ts-nocheck had hidden that.)
  const userId = data.userClaims?.id
  if (!userId) return null

  // `data.supabase` is scoped to the caller, so RLS governs every read the
  // handler performs. `data.supabaseAdmin` is deliberately not passed through:
  // authorization decisions must never be made with RLS bypassed. The cast
  // narrows the full SupabaseClient generic to the minimal surface the handler
  // uses; without it tsc reports "type instantiation is excessively deep".
  return {
    supabase: data.supabase as unknown as CallerContext['supabase'],
    userId,
  }
}

Deno.serve((req: Request) =>
  handleScanProcess(req, {
    createContext,
    allowedOrigins: allowedOrigins(),
  }),
)
