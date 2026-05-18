import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { type LucideIcon } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost'

const baseClasses =
  'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium no-underline transition-colors focus:outline-none focus:ring-4'

const variants: Record<Variant, string> = {
  primary:   'bg-ns-blue text-white shadow-sm hover:bg-ns-blue/90 focus:ring-ns-blue/25',
  secondary: 'border border-ns-border-soft bg-white text-ns-navy hover:bg-slate-50 focus:ring-ns-blue/15',
  ghost:     'text-ns-navy hover:bg-slate-100 focus:ring-ns-blue/15',
}

type Props = {
  to?: string
  Icon?: LucideIcon
  variant?: Variant
  type?: 'button' | 'submit'
  onClick?: () => void
  disabled?: boolean
  className?: string
  children: ReactNode
}

export function Button({
  to,
  Icon,
  variant = 'primary',
  type = 'button',
  onClick,
  disabled,
  className = '',
  children,
}: Props) {
  const cls = [
    baseClasses,
    variants[variant],
    disabled ? 'opacity-50 cursor-not-allowed' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {children}
    </>
  )

  if (to && !disabled) {
    return (
      <Link to={to} className={cls}>
        {content}
      </Link>
    )
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {content}
    </button>
  )
}
