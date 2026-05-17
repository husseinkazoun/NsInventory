import { Link } from 'react-router-dom'
import { ChevronRight, type LucideIcon } from 'lucide-react'

type Props = {
  to: string
  Icon: LucideIcon
  title: string
  description: string
}

export function QuickActionTile({ to, Icon, title, description }: Props) {
  return (
    <Link
      to={to}
      className="group relative flex items-center gap-3 rounded-xl bg-white border border-ns-border-soft shadow-ns-card hover:shadow-ns-stat-hover hover:-translate-y-0.5 transition-all p-4 sm:p-5 overflow-hidden no-underline"
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-ns-blue/85" />
      <span
        aria-hidden="true"
        className="inline-grid place-items-center h-10 w-10 rounded-lg bg-ns-blue-tint text-ns-blue shrink-0"
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="ns-stat-label">{title}</div>
        <div className="ns-stat-sub">{description}</div>
      </div>
      <ChevronRight
        className="h-5 w-5 text-ns-blue opacity-55 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0"
        aria-hidden="true"
      />
    </Link>
  )
}
