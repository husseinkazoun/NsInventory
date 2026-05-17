import { PageHeader } from '../components/ui/PageHeader'

export default function Purchases() {
  return (
    <>
      <PageHeader pretitle="Operations · Procurement" title="Purchases" />
      <div className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card p-6 sm:p-8">
        <h2 className="text-base font-semibold text-ns-navy">Purchases — coming soon</h2>
        <p className="mt-2 text-sm text-slate-500 max-w-prose">
          Purchase orders, approval workflow, and daily procurement reports will live here. The Laravel reference at the repo root implements this surface today.
        </p>
      </div>
    </>
  )
}
