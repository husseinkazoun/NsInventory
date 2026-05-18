import { PageHeader } from '../components/ui/PageHeader'

export default function Orders() {
  return (
    <>
      <PageHeader pretitle="Operations · Sales" title="Orders" />
      <div className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card p-6 sm:p-8">
        <h2 className="text-base font-semibold text-ns-navy">Orders — coming soon</h2>
        <p className="mt-2 text-sm text-slate-500 max-w-prose">
          The orders list, pending queue, and fulfilment workflow will live here. The Laravel reference at the repo root implements this surface today.
        </p>
      </div>
    </>
  )
}
