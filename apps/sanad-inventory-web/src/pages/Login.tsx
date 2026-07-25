import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { BrandMark } from '../components/brand/BrandMark'
import { Button } from '../components/ui/Button'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import {
  AUTH_NOTICE_MESSAGES,
  consumeAuthNotice,
  type AuthNotice,
} from '../lib/authNotice'

type LocationState = { from?: string } | null

// Sign-in failures are reported generically. The Supabase message
// distinguishes "user not found" from "wrong password", which tells an
// attacker which emails are registered. This mirrors the Laravel app's
// generic login error (commit 5857f61).
const GENERIC_SIGN_IN_ERROR =
  "We couldn't sign you in. Check your email and password, then try again."

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as LocationState)?.from ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<AuthNotice | null>(null)

  // Read the one-shot notice once on mount. Guarded against StrictMode's
  // double-invoked effect: the second pass reads null and must not wipe the
  // value the first pass captured.
  useEffect(() => {
    const pending = consumeAuthNotice()
    if (pending) setNotice(pending)
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!supabase) {
      setError(
        'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local to enable authentication.',
      )
      return
    }
    setBusy(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setBusy(false)
    if (signInError) {
      setError(GENERIC_SIGN_IN_ERROR)
      return
    }
    // A fresh sign-in supersedes any expiry explanation.
    setNotice(null)
    navigate(from, { replace: true })
  }

  return (
    <div className="ns-auth-bg min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex flex-col items-center no-underline">
            <BrandMark size={56} />
            <span className="mt-3 text-lg font-semibold leading-tight text-ns-navy">
              Sanad Smart Inventory System
            </span>
            <span className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ns-navy-soft">
              AI-powered inventory, assets &amp; inspection
            </span>
          </Link>
        </div>

        <div className="rounded-xl border border-ns-border-soft bg-white p-6 sm:p-7 shadow-ns-card-elev">
          <h1 className="text-lg font-semibold text-ns-navy">Sign in to your account</h1>
          <p className="mt-1 text-sm text-slate-500">
            Use your Sanad Inventory credentials.
          </p>

          {notice && (
            <div
              role="status"
              className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              {AUTH_NOTICE_MESSAGES[notice]}
            </div>
          )}

          {!isSupabaseConfigured && (
            <div
              role="status"
              className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            >
              <strong>Demo mode.</strong> Supabase env vars aren't set, so the rest of the
              app is reachable without sign-in. Add{' '}
              <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
              <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to{' '}
              <code className="font-mono">.env.local</code> to enable real auth.
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ns-navy-soft"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-10 w-full rounded-lg border border-ns-border-soft bg-white px-3 text-sm text-ns-navy placeholder:text-slate-400 focus:border-ns-blue focus:outline-none focus:ring-4 focus:ring-ns-blue/15"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ns-navy-soft"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 w-full rounded-lg border border-ns-border-soft bg-white px-3 text-sm text-ns-navy placeholder:text-slate-400 focus:border-ns-blue focus:outline-none focus:ring-4 focus:ring-ns-blue/15"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              Icon={LogIn}
              disabled={busy}
              className="w-full justify-center"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Need access? Contact your administrator.
        </p>
      </div>
    </div>
  )
}
