import { Menu, Search, Bell } from 'lucide-react'

type Props = {
  onOpenSidebar: () => void
}

export function Header({ onOpenSidebar }: Props) {
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

      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search…"
            aria-label="Search"
            className="w-full h-9 pl-9 pr-3 rounded-md border border-ns-border-soft bg-slate-50 text-sm placeholder:text-slate-400 focus:outline-none focus:border-ns-blue focus:bg-white focus:ring-4 focus:ring-ns-blue/20"
          />
        </div>
      </div>

      <button
        type="button"
        aria-label="Notifications"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="flex items-center gap-2 pl-2 border-l border-ns-border-soft">
        <div className="h-8 w-8 rounded-full bg-ns-blue text-white grid place-items-center text-xs font-semibold">
          AD
        </div>
        <span className="hidden sm:inline text-sm text-slate-700">Admin</span>
      </div>
    </header>
  )
}
