import { PageHeader } from '../components/ui/PageHeader'

export default function Quotations() {
  return (
    <>
      <PageHeader pretitle="Operations · Sales" title="Quotations" />
      <div className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card p-6 sm:p-8">
        <h2 className="text-base font-semibold text-ns-navy">Quotations — coming soon</h2>
        <p className="mt-2 text-sm text-slate-500 max-w-prose">
          Quotation drafting, customer selection, line items, tax/discount handling, and PDF preview will live here. The Laravel reference at the repo root implements this surface today.
        </p>
      </div>
    </>
  )
}
