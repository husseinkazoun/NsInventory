import { PageHeader } from '../components/ui/PageHeader'

export default function Settings() {
  return (
    <>
      <PageHeader pretitle="Operations · Configuration" title="Settings" />
      <div className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card p-6 sm:p-8">
        <h2 className="text-base font-semibold text-ns-navy">Settings — coming soon</h2>
        <p className="mt-2 text-sm text-slate-500 max-w-prose">
          Users, categories, units, and account preferences will live here. The Laravel reference at the repo root implements this surface today.
        </p>
      </div>
    </>
  )
}
