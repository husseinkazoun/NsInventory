import { type ReactNode } from 'react'

type Props = {
  pretitle?: string
  title: string
  actions?: ReactNode
}

export function PageHeader({ pretitle, title, actions }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {pretitle && (
          <div className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-ns-blue">
            {pretitle}
          </div>
        )}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ns-navy">
          {title}
        </h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
