import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import {
  emitAuthEvent,
  fakeSupabase,
  resetFakeSupabase,
  setSignInError,
  setSignedInUser,
} from '../test/fakeSupabase'

fakeSupabase()

const { SessionProvider } = await import('../lib/session')
const { AuthGuard } = await import('../components/auth/AuthGuard')
const Login = (await import('./Login')).default

const NOTICE_KEY = 'sanad.inventory.authNotice'
const EXPIRY_TEXT = 'Your session has expired. Please sign in again.'
const GENERIC_SIGN_IN_ERROR =
  "We couldn't sign you in. Check your email and password, then try again."

beforeEach(() => {
  resetFakeSupabase()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

/** Reports the live location so assertions can read the current path. */
function LocationProbe() {
  const location = useLocation()
  return (
    <span data-testid="path">{`${location.pathname}${location.search}`}</span>
  )
}

/**
 * Mounts the real routing shape: a public `/login` and two AuthGuard-protected
 * routes, all under one SessionProvider so session state survives navigation.
 */
function renderApp(initialPath: string) {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/login"
            element={
              <>
                <Login />
                <LocationProbe />
              </>
            }
          />
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <div>DASHBOARD CONTENT</div>
                <LocationProbe />
              </AuthGuard>
            }
          />
          <Route
            path="/lab-assets"
            element={
              <AuthGuard>
                <div>LAB ASSETS CONTENT</div>
                <LocationProbe />
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  )
}

const path = () => screen.getByTestId('path').textContent

async function submitCredentials() {
  await waitFor(() =>
    expect(screen.getByText('Sign in to your account')).toBeTruthy(),
  )
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'owner@example.test' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'a-long-enough-password' },
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
  })
}

// =====================================================================
// The race, reproduced end to end
// =====================================================================
describe('first sign-in race', () => {
  it('reaches the preserved destination once the auth event lands', async () => {
    // 1. Anonymous visit to a protected route with a query string.
    setSignedInUser(null)
    renderApp('/lab-assets?status=active')

    // 2. AuthGuard bounces to /login, preserving the attempted destination.
    await waitFor(() => expect(path()).toBe('/login'))

    // 3. Valid credentials. signInWithPassword succeeds and the session is
    //    stored, but — as with the real client — subscribers have not been
    //    notified yet, so SessionProvider still holds `null`.
    await submitCredentials()

    // 4. This is the defect's window. Before the fix the app navigated here,
    //    AuthGuard saw a null session and bounced straight back, and nothing
    //    ever re-navigated. Staying on /login at this instant is correct.
    expect(path()).toBe('/login')

    // 5. The auth event finally arrives.
    await act(async () => {
      emitAuthEvent('SIGNED_IN', { user: { id: 'user-owner' } })
    })

    // 6. The user must now be on the page they originally asked for —
    //    query string intact — without a manual reload or a second submit.
    await waitFor(() => expect(path()).toBe('/lab-assets?status=active'))
    expect(screen.getByText('LAB ASSETS CONTENT')).toBeTruthy()
  })

  it('defaults to /dashboard when there is no attempted destination', async () => {
    setSignedInUser(null)
    renderApp('/login')
    await submitCredentials()
    expect(path()).toBe('/login')

    await act(async () => {
      emitAuthEvent('SIGNED_IN', { user: { id: 'user-owner' } })
    })

    await waitFor(() => expect(path()).toBe('/dashboard'))
    expect(screen.getByText('DASHBOARD CONTENT')).toBeTruthy()
  })

  it('does not require a second submit', async () => {
    setSignedInUser(null)
    renderApp('/lab-assets')
    await waitFor(() => expect(path()).toBe('/login'))
    await submitCredentials()
    await act(async () => {
      emitAuthEvent('SIGNED_IN', { user: { id: 'user-owner' } })
    })
    await waitFor(() => expect(path()).toBe('/lab-assets'))
    // The sign-in form is gone: the user is inside the app after one submit.
    expect(screen.queryByText('Sign in to your account')).toBeNull()
  })
})

// =====================================================================
// Already-authenticated visit to /login
// =====================================================================
describe('authenticated visit to /login', () => {
  it('redirects to /dashboard without a submit', async () => {
    setSignedInUser('user-owner')
    renderApp('/login')

    await waitFor(() => expect(path()).toBe('/dashboard'))
    expect(screen.getByText('DASHBOARD CONTENT')).toBeTruthy()
  })

  it('does not loop when the attempted destination is /login itself', async () => {
    // A `from` of /login would otherwise redirect to itself forever.
    setSignedInUser('user-owner')
    render(
      <SessionProvider>
        <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/login' } }]}>
          <Routes>
            <Route path="/login" element={<><Login /><LocationProbe /></>} />
            <Route
              path="/dashboard"
              element={<AuthGuard><div>DASHBOARD CONTENT</div><LocationProbe /></AuthGuard>}
            />
          </Routes>
        </MemoryRouter>
      </SessionProvider>,
    )

    await waitFor(() => expect(path()).toBe('/dashboard'))
  })
})

// =====================================================================
// Behaviour that must not regress
// =====================================================================
describe('failed sign-in is unchanged', () => {
  it('shows the generic error and stays on /login', async () => {
    setSignedInUser(null)
    setSignInError({ message: 'Invalid login credentials' })
    renderApp('/login')
    await submitCredentials()

    await waitFor(() =>
      expect(screen.getByText(GENERIC_SIGN_IN_ERROR)).toBeTruthy(),
    )
    expect(path()).toBe('/login')
    // The Supabase wording must never reach the page.
    expect(screen.queryByText(/Invalid login credentials/)).toBeNull()
  })

  it('leaves the form usable after a failure', async () => {
    setSignedInUser(null)
    setSignInError({ message: 'Invalid login credentials' })
    renderApp('/login')
    await submitCredentials()

    await waitFor(() =>
      expect(screen.getByText(GENERIC_SIGN_IN_ERROR)).toBeTruthy(),
    )
    const button = screen.getByRole('button', { name: /sign in/i })
    expect((button as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('notices still behave', () => {
  it('shows the expiry notice and does not redirect while signed out', async () => {
    window.sessionStorage.setItem(NOTICE_KEY, 'session-expired')
    setSignedInUser(null)
    renderApp('/login')

    await waitFor(() => expect(screen.getByText(EXPIRY_TEXT)).toBeTruthy())
    // No session, so no redirect — the notice stays readable.
    expect(path()).toBe('/login')
  })

  it('shows no expiry notice after a deliberate sign-out', async () => {
    setSignedInUser(null)
    renderApp('/login')
    await waitFor(() =>
      expect(screen.getByText('Sign in to your account')).toBeTruthy(),
    )
    expect(screen.queryByText(EXPIRY_TEXT)).toBeNull()
  })

  it('does not strand a user who signs in after an expiry', async () => {
    window.sessionStorage.setItem(NOTICE_KEY, 'session-expired')
    setSignedInUser(null)
    renderApp('/lab-assets')
    await waitFor(() => expect(path()).toBe('/login'))
    await waitFor(() => expect(screen.getByText(EXPIRY_TEXT)).toBeTruthy())

    await submitCredentials()
    await act(async () => {
      emitAuthEvent('SIGNED_IN', { user: { id: 'user-owner' } })
    })

    await waitFor(() => expect(path()).toBe('/lab-assets'))
  })
})

describe('no protected-content flash', () => {
  it('never renders protected content while the session is unknown', async () => {
    setSignedInUser(null)
    renderApp('/lab-assets')
    // AuthGuard shows its loading state, then redirects; at no point does the
    // guarded content appear.
    expect(screen.queryByText('LAB ASSETS CONTENT')).toBeNull()
    await waitFor(() => expect(path()).toBe('/login'))
    expect(screen.queryByText('LAB ASSETS CONTENT')).toBeNull()
  })
})
