import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import {
  emitAuthEvent,
  fakeSupabase,
  getSignOutCalls,
  resetFakeSupabase,
  setSignOutRejects,
  setSignedInUser,
} from '../test/fakeSupabase'

fakeSupabase()

const { SessionProvider, signOut } = await import('./session')
const { clearOrgCache } = await import('./org')
const { consumeAuthNotice } = await import('./authNotice')
const { AuthGuard } = await import('../components/auth/AuthGuard')
const Login = (await import('../pages/Login')).default

const NOTICE_KEY = 'sanad.inventory.authNotice'
const EXPIRY_TEXT = 'Your session has expired. Please sign in again.'

beforeEach(() => {
  clearOrgCache()
  resetFakeSupabase()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

/** Mounts SessionProvider and waits for its initial getSession() to settle. */
async function mountSession() {
  render(
    <SessionProvider>
      <div>app</div>
    </SessionProvider>,
  )
  await waitFor(() => expect(screen.getByText('app')).toBeTruthy())
}

describe('expiry vs deliberate sign-out', () => {
  it('records the expiry notice when the session ends without user action', async () => {
    setSignedInUser('user-1')
    await mountSession()

    // A background token refresh failing, or asAppError()'s local sign-out.
    act(() => {
      emitAuthEvent('SIGNED_OUT', null)
    })

    expect(window.sessionStorage.getItem(NOTICE_KEY)).toBe('session-expired')
  })

  it('records no notice for a deliberate sign-out', async () => {
    setSignedInUser('user-1')
    await mountSession()

    await act(async () => {
      await signOut()
    })

    // The fake emits SIGNED_OUT synchronously inside signOut(), exactly as
    // supabase-js does — so this asserts the real ordering the flag relies on.
    expect(getSignOutCalls()).toHaveLength(1)
    expect(window.sessionStorage.getItem(NOTICE_KEY)).toBeNull()
  })

  it('does not swallow a later expiry when a sign-out failed', async () => {
    setSignedInUser('user-1')
    await mountSession()
    setSignOutRejects(true)

    await act(async () => {
      await signOut().catch(() => {
        // Network failure during sign-out; the flag must still be released.
      })
    })
    expect(window.sessionStorage.getItem(NOTICE_KEY)).toBeNull()

    // A genuine expiry afterwards must still be reported.
    act(() => {
      emitAuthEvent('SIGNED_OUT', null)
    })
    expect(window.sessionStorage.getItem(NOTICE_KEY)).toBe('session-expired')
  })

  it('keeps the notice cleared across a token refresh', async () => {
    setSignedInUser('user-1')
    await mountSession()

    act(() => {
      emitAuthEvent('TOKEN_REFRESHED', { user: { id: 'user-1' } })
    })

    expect(window.sessionStorage.getItem(NOTICE_KEY)).toBeNull()
  })
})

describe('the notice is one-shot', () => {
  it('is cleared once read, so a later visit to /login stays silent', () => {
    window.sessionStorage.setItem(NOTICE_KEY, 'session-expired')

    expect(consumeAuthNotice()).toBe('session-expired')
    expect(consumeAuthNotice()).toBeNull()
    expect(window.sessionStorage.getItem(NOTICE_KEY)).toBeNull()
  })
})

describe('login surface', () => {
  function renderLogin() {
    return render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('shows the generic expiry message when a notice is pending', async () => {
    window.sessionStorage.setItem(NOTICE_KEY, 'session-expired')
    renderLogin()

    await waitFor(() => expect(screen.getByText(EXPIRY_TEXT)).toBeTruthy())
  })

  it('shows no expiry message after a deliberate sign-out', async () => {
    setSignedInUser('user-1')
    await mountSession()
    await act(async () => {
      await signOut()
    })

    renderLogin()

    await waitFor(() =>
      expect(screen.getByText('Sign in to your account')).toBeTruthy(),
    )
    expect(screen.queryByText(EXPIRY_TEXT)).toBeNull()
  })

  it('never renders raw Supabase, JWT or PostgREST wording', async () => {
    window.sessionStorage.setItem(NOTICE_KEY, 'session-expired')
    const { container } = renderLogin()

    await waitFor(() => expect(screen.getByText(EXPIRY_TEXT)).toBeTruthy())
    expect(container.textContent).not.toMatch(/PGRST|JWT|refresh_token|401/i)
  })
})

describe('protected-route redirect', () => {
  function LocationProbe() {
    const location = useLocation()
    const state = location.state as { from?: string } | null
    return (
      <div>
        <span data-testid="path">{location.pathname}</span>
        <span data-testid="from">{state?.from ?? ''}</span>
      </div>
    )
  }

  it('preserves the attempted destination, including its query string', async () => {
    // No signed-in user -> AuthGuard redirects.
    setSignedInUser(null)

    render(
      <MemoryRouter initialEntries={['/lab-assets?status=active']}>
        <Routes>
          <Route path="/login" element={<LocationProbe />} />
          <Route
            path="/lab-assets"
            element={
              <SessionProvider>
                <AuthGuard>
                  <div>protected</div>
                </AuthGuard>
              </SessionProvider>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('path').textContent).toBe('/login'),
    )
    // Without the query string a deep link would lose its filters on return.
    expect(screen.getByTestId('from').textContent).toBe(
      '/lab-assets?status=active',
    )
  })
})
