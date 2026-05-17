import { Link } from 'react-router-dom'
import {
  Plus,
  Clock,
  PackageOpen,
  Wrench,
  AlertTriangle,
  Monitor,
  Package,
  Camera,
  FileText,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionTitle } from '../components/ui/SectionTitle'
import { StatCard } from '../components/ui/StatCard'
import { QuickActionTile } from '../components/ui/QuickActionTile'
import { kpis } from '../lib/mockData'
import { formatNumber as fmt } from '../lib/format'

export default function Dashboard() {
  return (
    <>
      <PageHeader
        pretitle="Operations · Overview"
        title="Dashboard"
        actions={
          <Link
            to="/lab-assets"
            className="inline-flex items-center gap-2 rounded-lg bg-ns-blue px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-ns-blue/90 focus:outline-none focus:ring-4 focus:ring-ns-blue/25"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Lab Asset
          </Link>
        }
      />

      <SectionTitle>Needs Attention</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          to="/purchases"
          tone="attention"
          Icon={Clock}
          value={fmt(kpis.pendingPurchases)}
          label="Pending Purchases"
          sub="Awaiting approval"
        />
        <StatCard
          to="/orders"
          tone="attention"
          Icon={PackageOpen}
          value={fmt(kpis.pendingOrders)}
          label="Pending Orders"
          sub={`${fmt(kpis.ordersTotal)} total · ${fmt(kpis.ordersCompleted)} completed`}
        />
        <StatCard
          to="/lab-assets"
          tone="critical"
          Icon={Wrench}
          value={fmt(kpis.maintenanceDue)}
          label="Maintenance Due"
          sub="Within 7 days"
        />
        <StatCard
          to="/lab-assets"
          tone="critical"
          Icon={AlertTriangle}
          value={fmt(kpis.missingComponents)}
          label="Missing Components"
          sub="Across lab assets"
        />
      </div>

      <SectionTitle>Inventory Pulse</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          to="/lab-assets"
          Icon={Monitor}
          value={fmt(kpis.activeLabAssets)}
          label="Active Lab Assets"
          sub="In service"
        />
        <StatCard
          to="/products"
          Icon={Package}
          value={fmt(kpis.products)}
          label="Products"
          sub={`${fmt(kpis.productsLowStock)} low stock · ${fmt(kpis.categories)} categories`}
        />
        <StatCard
          to="/lab-assets"
          Icon={Camera}
          value={fmt(kpis.recentScans)}
          label="Recent Scans"
          sub="Last 24 hours"
        />
        <StatCard
          to="/quotations"
          Icon={FileText}
          value={fmt(kpis.quotations)}
          label="Quotations"
          sub={`${fmt(kpis.quotationsToday)} today`}
        />
      </div>

      <SectionTitle>Quick Actions</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        <QuickActionTile
          to="/lab-assets"
          Icon={Camera}
          title="Start Photo Scan"
          description="Intake or inspect a lab asset by photo"
        />
        <QuickActionTile
          to="/purchases"
          Icon={PackageOpen}
          title="New Purchase"
          description="Record a procurement order"
        />
        <QuickActionTile
          to="/lab-assets"
          Icon={Plus}
          title="Add Lab Asset"
          description="Register equipment or instruments"
        />
      </div>
    </>
  )
}
