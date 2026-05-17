import { Link, useNavigate } from 'react-router-dom'
import { Plus, Camera } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { type AssetStatus, labAssets } from '../lib/mockData'

function statusTone(s: AssetStatus): BadgeTone {
  if (s === 'active') return 'success'
  if (s === 'maintenance') return 'warning'
  if (s === 'disposed') return 'critical'
  return 'neutral'
}

export default function LabAssets() {
  const navigate = useNavigate()

  return (
    <>
      <PageHeader
        pretitle="Operations · Assets"
        title="Lab Assets"
        actions={
          <>
            <Button to="/scan/start" variant="secondary" Icon={Camera}>
              Start Photo Scan
            </Button>
            <Button to="/lab-assets/new" Icon={Plus}>
              Add Lab Asset
            </Button>
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
                <tr
                  key={a.id}
                  onClick={() => navigate(`/lab-assets/${a.id}`)}
                  className="hover:bg-ns-blue-tint/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      to={`/lab-assets/${a.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-slate-600 hover:text-ns-blue"
                    >
                      {a.tag}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/lab-assets/${a.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-ns-navy font-medium hover:text-ns-blue"
                    >
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.manufacturer}</td>
                  <td className="px-4 py-3 text-slate-600">{a.location}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(a.status)}>{a.status}</Badge>
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
        Mocked data. Click a row to view asset details. Real CRUD, scanning, and AI inspection workflows will land in later phases.
      </p>
    </>
  )
}
