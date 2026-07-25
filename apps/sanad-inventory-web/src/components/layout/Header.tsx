import { Building2, Menu, LogOut } from 'lucide-react'
import { signOut, useSession } from '../../lib/session'
import { useCurrentOrg } from '../../lib/orgContext'

type Props = {
  onOpenSidebar: () => void
}

/**
 * Active-organization indicator.
 *
 * Single-org users get a plain label; multi-org users get a switcher. Showing
 * the tenant at all times matters once a user can belong to more than one —
 * otherwise "which org did I just file this asset under?" is unanswerable.
 */
function OrgIndicator() {
  const org = useCurrentOrg()
  if (org.status !== 'ready') return null

  if (org.memberships.length < 2) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 text-sm text-slate-600">
        <Building2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
        <span className="max-w-[14rem] truncate">{org.membership.name}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Building2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
      <label htmlFor="org-switcher" className="sr-only">
        Active organization
      </label>
      <select
        id="org-switcher"
        value={org.organizationId}
        onChange={(e) => {
          void org.selectOrganization(e.target.value)
        }}
        className="h-8 max-w-[12rem] rounded-md border border-ns-border-soft bg-white px-2 text-sm text-slate-700 focus:border-ns-blue focus:outline-none focus:ring-4 focus:ring-ns-blue/15"
      >
        {org.memberships.map((m) => (
          <option key={m.organizationId} value={m.organizationId}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('')
  return letters || 'AD'
}

export function Header({ onOpenSidebar }: Props) {
  const { session } = useSession()

  const userMeta = (session?.user?.user_metadata ?? {}) as { name?: string; full_name?: string }
  const email = session?.user?.email ?? null
  const displayName = userMeta.name || userMeta.full_name || email?.split('@')[0] || 'Admin'
  const initials = initialsOf(displayName)
  const authed = Boolean(session)

  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-ns-border-soft bg-white/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <button
        type="button"
        aria-label="Open navigation"
        className="lg:hidden -ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"
        onClick={onOpenSidebar}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="flex-1" />

      <OrgIndicator />

      <div className="flex items-center gap-2 pl-2 border-l border-ns-border-soft">
        <div
          aria-hidden="true"
          className="h-8 w-8 rounded-full bg-ns-blue text-white grid place-items-center text-xs font-semibold"
        >
          {initials}
        </div>
        <div className="hidden sm:flex flex-col leading-tight">
          <span className="text-sm text-slate-700">{displayName}</span>
          {authed && email && (
            <span className="text-[0.65rem] text-slate-400">{email}</span>
          )}
        </div>
        {authed && (
          <button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => {
              void signOut()
            }}
            className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-ns-navy"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </header>
  )
}
