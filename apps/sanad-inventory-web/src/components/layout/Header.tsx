import { Menu, LogOut } from 'lucide-react'
import { signOut, useSession } from '../../lib/session'

type Props = {
  onOpenSidebar: () => void
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
