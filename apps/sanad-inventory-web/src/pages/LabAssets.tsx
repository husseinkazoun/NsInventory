import { Plus, Camera } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { labAssets } from '../lib/mockData'

const statusStyles: Record<string, string> = {
  active:      'bg-emerald-100 text-emerald-700',
  maintenance: 'bg-amber-100 text-amber-700',
  inactive:    'bg-slate-100 text-slate-600',
  disposed:    'bg-rose-100 text-rose-700',
}

export default function LabAssets() {
  return (
    <>
      <PageHeader
        pretitle="Operations · Assets"
        title="Lab Assets"
        actions={
          <>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-ns-border-soft bg-white px-3.5 py-2 text-sm font-medium text-ns-navy hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-ns-blue/15"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              Start Photo Scan
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-ns-blue px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-ns-blue/90 focus:outline-none focus:ring-4 focus:ring-ns-blue/25"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Lab Asset
            </button>
          </>
        }
      />

      <div className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="text-left font-semibold px-4 py-3">Tag</th>
                <th className="text-left font-semibold px-4 py-3">Name</th>
                <th className="text-left font-semibold px-4 py-3">Manufacturer</th>
                <th className="text-left font-semibold px-4 py-3">Location</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-left font-semibold px-4 py-3">Assigned To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ns-border-soft">
              {labAssets.map((a) => (
                <tr key={a.id} className="hover:bg-ns-blue-tint/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{a.tag}</td>
                  <td className="px-4 py-3 text-ns-navy font-medium">{a.name}</td>
                  <td className="px-4 py-3 text-slate-600">{a.manufacturer}</td>
                  <td className="px-4 py-3 text-slate-600">{a.location}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        statusStyles[a.status] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {a.assignedTo ?? <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Mocked data. Asset CRUD, photo scanning, and AI inspection workflows will land in later phases.
      </p>
    </>
  )
}
