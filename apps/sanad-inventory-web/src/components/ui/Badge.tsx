import { type ReactNode } from 'react'

export type BadgeTone = 'success' | 'warning' | 'critical' | 'info' | 'neutral'

const tones: Record<BadgeTone, string> = {
  success:  'bg-emerald-100 text-emerald-700',
  warning:  'bg-amber-100 text-amber-700',
  critical: 'bg-rose-100 text-rose-700',
  info:     'bg-ns-blue-tint text-ns-blue',
  neutral:  'bg-slate-100 text-slate-600',
}

type Props = {
  tone?: BadgeTone
  children: ReactNode
}

export function Badge({ tone = 'neutral', children }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
