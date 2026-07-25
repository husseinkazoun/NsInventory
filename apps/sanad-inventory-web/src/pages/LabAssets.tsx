import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Camera, Microscope } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { type AssetStatus, type LabAsset } from '../lib/mockData'
import { listLabAssets } from '../lib/queries/labAssets'
import { useCapabilities } from '../lib/permissions'

function statusTone(s: AssetStatus): BadgeTone {
  if (s === 'active') return 'success'
  if (s === 'maintenance') return 'warning'
  if (s === 'disposed') return 'critical'
  return 'neutral'
}

export default function LabAssets() {
  const navigate = useNavigate()
  // UX only — RLS refuses these writes regardless of what is rendered.
  const { canWrite } = useCapabilities()
  const [assets, setAssets] = useState<LabAsset[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    listLabAssets()
      .then((data) => {
        if (!cancelled) setAssets(data)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setAssets([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const header = (
    <PageHeader
      pretitle="Operations · Assets"
      title="Lab Assets"
      actions={
        canWrite ? (
          <>
            <Button to="/scan/start" variant="secondary" Icon={Camera}>
              Start Photo Scan
            </Button>
            <Button to="/lab-assets/new" Icon={Plus}>
              Add Lab Asset
            </Button>
          </>
        ) : null
      }
    />
  )

  if (assets === null && error === null) {
    return (
      <>
        {header}
        <div className="rounded-xl border border-ns-border-soft bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-ns-card">
          Loading…
        </div>
      </>
    )
  }

  return (
    <>
      {header}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
        >
          Failed to load lab assets: {error}
        </div>
      )}

      {assets && assets.length === 0 && !error ? (
        <EmptyState
          Icon={Microscope}
          title="No lab assets yet"
          description={
            canWrite
              ? 'Get started by adding your first asset or capturing one via photo scan.'
              : 'Nothing has been added to this organization yet. Your role gives read-only access.'
          }
          action={
            canWrite ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button to="/scan/start" variant="secondary" Icon={Camera}>
                  Start Photo Scan
                </Button>
                <Button to="/lab-assets/new" Icon={Plus}>
                  Add Lab Asset
                </Button>
              </div>
            ) : null
          }
        />
      ) : (
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
                {(assets ?? []).map((a) => (
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
      )}

      <p className="mt-4 text-xs text-slate-400">
        Click a row to view asset details. CRUD, scanning, and AI inspection workflows
        will keep landing in subsequent phases.
      </p>
    </>
  )
}
