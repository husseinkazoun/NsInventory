import { Link } from 'react-router-dom'
import { type LucideIcon } from 'lucide-react'

type Tone = 'attention' | 'critical' | 'neutral'

const toneClasses: Record<Tone, string> = {
  attention: 'bg-amber-100 text-amber-700',
  critical:  'bg-rose-100 text-rose-700',
  neutral:   'bg-ns-blue-tint text-ns-blue',
}

type Props = {
  to: string
  Icon: LucideIcon
  value: number | string
  label: string
  sub?: string
  tone?: Tone
}

export function StatCard({ to, Icon, value, label, sub, tone = 'neutral' }: Props) {
  return (
    <Link
      to={to}
      className="block rounded-xl bg-white border border-ns-border-soft shadow-ns-stat hover:shadow-ns-stat-hover hover:-translate-y-0.5 transition-all p-4 sm:p-5 no-underline"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`inline-grid place-items-center h-10 w-10 rounded-lg shrink-0 ${toneClasses[tone]}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="ns-stat-value">{value}</div>
          <div className="ns-stat-label">{label}</div>
          {sub && <div className="ns-stat-sub">{sub}</div>}
        </div>
      </div>
    </Link>
  )
}
