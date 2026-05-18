import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Microscope,
  Package,
  ShoppingCart,
  PackageOpen,
  FileText,
  Users,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react'
import { BrandMark } from '../brand/BrandMark'

type Item = { to: string; label: string; Icon: LucideIcon }

const items: Item[] = [
  { to: '/dashboard',  label: 'Dashboard',  Icon: LayoutDashboard },
  { to: '/lab-assets', label: 'Lab Assets', Icon: Microscope },
  { to: '/products',   label: 'Products',   Icon: Package },
  { to: '/orders',     label: 'Orders',     Icon: ShoppingCart },
  { to: '/purchases',  label: 'Purchases',  Icon: PackageOpen },
  { to: '/quotations', label: 'Quotations', Icon: FileText },
  { to: '/directory',  label: 'Directory',  Icon: Users },
  { to: '/settings',   label: 'Settings',   Icon: SettingsIcon },
]

type Props = {
  onNavigate?: () => void
}

export function Sidebar({ onNavigate }: Props) {
  return (
    <aside className="flex h-full w-64 flex-col bg-white border-r border-ns-border-soft">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-ns-border-soft">
        <BrandMark size={40} />
        <div className="leading-tight">
          <div className="font-semibold text-ns-navy text-[0.95rem]">Sanad Inventory</div>
          <div className="text-[0.6rem] font-semibold tracking-[0.10em] uppercase text-slate-500 mt-1">
            Smart Inventory System
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-ns-blue-tint text-ns-blue font-semibold'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-ns-navy font-medium',
              ].join(' ')
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-ns-border-soft">
        <div className="text-[0.62rem] uppercase tracking-[0.12em] text-slate-400 font-semibold">
          v0.1 · Prototype
        </div>
        <div className="text-xs text-slate-500 mt-1">
          React/Vite rebuild
        </div>
      </div>
    </aside>
  )
}
