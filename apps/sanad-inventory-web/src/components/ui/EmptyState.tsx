import { type ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'

type Props = {
  Icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ Icon, title, description, action }: Props) {
  return (
    <div className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card px-6 py-12 text-center">
      <div
        aria-hidden="true"
        className="inline-grid place-items-center h-12 w-12 rounded-full bg-slate-100 text-slate-500 mx-auto mb-4"
      >
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="text-base font-semibold text-ns-navy">{title}</h2>
      {description && (
        <p className="mt-2 text-sm text-slate-500 max-w-prose mx-auto">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
