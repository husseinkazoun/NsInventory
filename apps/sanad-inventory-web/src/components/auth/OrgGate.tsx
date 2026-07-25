import { Fragment, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Building2, LogOut, RefreshCw, ShieldAlert } from 'lucide-react'
import { BrandMark } from '../brand/BrandMark'
import { Button } from '../ui/Button'
import { useCurrentOrg } from '../../lib/orgContext'
import { signOut } from '../../lib/session'
import type { OrgMembership } from '../../lib/org'

/**
 * Gates the authenticated app on a resolved organization.
 *
 * `AuthGuard` answers "is there a session?"; `OrgGate` answers "which tenant
 * are we operating in?". Nothing organization-scoped renders until that
 * question has a definite answer — there is no development-org fallback.
 *
 * Children are keyed by organization id so switching org remounts the routed
 * tree and discards data fetched for the previous tenant.
 */
export function OrgGate({ children }: { children: ReactNode }) {
  const org = useCurrentOrg()

  switch (org.status) {
    case 'demo':
      // Supabase unset — mock data, no tenancy to resolve.
      return <>{children}</>

    case 'loading':
      return <CenteredNotice>Loading your organization…</CenteredNotice>

    case 'ready':
      // Keyed so switching organization remounts the routed tree and discards
      // state fetched for the previous tenant. Fragment: no DOM node, no
      // interference with AppShell's flex layout.
      return <Fragment key={org.organizationId}>{children}</Fragment>

    case 'needs-selection':
      return <OrgPicker memberships={org.memberships} />

    case 'no-membership':
      return <NoMembershipScreen />

    case 'session-expired':
      return <Navigate to="/login" replace />

    case 'error':
      return <ResolutionErrorScreen message={org.message} onRetry={org.refresh} />
  }
}

// ── Shared chrome ─────────────────────────────────────────────────────

function CenteredNotice({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <div className="text-sm text-slate-400">{children}</div>
    </div>
  )
}

function GateCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="ns-auth-bg min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <BrandMark size={48} />
        </div>
        <div className="rounded-xl border border-ns-border-soft bg-white p-6 sm:p-7 shadow-ns-card-elev">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-ns-blue" aria-hidden="true">
              {icon}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-ns-navy">{title}</h1>
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── State screens ─────────────────────────────────────────────────────

function OrgPicker({ memberships }: { memberships: OrgMembership[] }) {
  const { selectOrganization } = useCurrentOrg()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function choose(orgId: string) {
    setBusy(orgId)
    setError(null)
    try {
      await selectOrganization(orgId)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(null)
    }
  }

  return (
    <GateCard
      icon={<Building2 className="h-5 w-5" />}
      title="Choose an organization"
      description="Your account belongs to more than one organization. Pick the one you want to work in — you can switch at any time from the header."
    >
      <ul className="mt-5 space-y-2">
        {memberships.map((m) => (
          <li key={m.organizationId}>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void choose(m.organizationId)}
              className="w-full rounded-lg border border-ns-border-soft bg-white px-3 py-2.5 text-left transition hover:border-ns-blue hover:bg-ns-blue-tint disabled:opacity-60"
            >
              <span className="block text-sm font-medium text-ns-navy">
                {m.name}
              </span>
              <span className="block text-xs text-slate-500">
                {m.slug} · {m.role}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
        >
          {error}
        </div>
      )}
    </GateCard>
  )
}

function NoMembershipScreen() {
  return (
    <GateCard
      icon={<ShieldAlert className="h-5 w-5" />}
      title="No organization access"
      description="You're signed in, but your account isn't a member of any organization yet. An administrator needs to add you before inventory data becomes visible."
    >
      <div className="mt-5 flex justify-end">
        <Button
          variant="secondary"
          Icon={LogOut}
          onClick={() => {
            void signOut()
          }}
        >
          Sign out
        </Button>
      </div>
    </GateCard>
  )
}

function ResolutionErrorScreen({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <GateCard
      icon={<ShieldAlert className="h-5 w-5" />}
      title="Couldn't load your organization"
      description="We couldn't read your organization membership. This is usually a temporary connectivity problem."
    >
      <div
        role="alert"
        className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
      >
        {message}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="secondary"
          Icon={LogOut}
          onClick={() => {
            void signOut()
          }}
        >
          Sign out
        </Button>
        <Button Icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      </div>
    </GateCard>
  )
}
