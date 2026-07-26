import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Camera, Microscope, Shirt } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import {
  type AssetCondition,
  type AssetStatus,
  type LabAsset,
} from '../lib/mockData'
import { listLabAssets } from '../lib/queries/labAssets'
import { getGarmentsForAssets, type Garment } from '../lib/queries/garments'
import { useCapabilities } from '../lib/permissions'

function statusTone(s: AssetStatus): BadgeTone {
  if (s === 'active') return 'success'
  if (s === 'maintenance') return 'warning'
  if (s === 'disposed') return 'critical'
  return 'neutral'
}

function conditionTone(c: AssetCondition): BadgeTone {
  if (c === 'excellent' || c === 'good') return 'success'
  if (c === 'fair') return 'warning'
  return 'critical'
}

/**
 * "Jacket · M" for a garment, or a dash.
 *
 * Kept out of the row markup so the empty case is one decision in one place
 * rather than nested ternaries in JSX.
 */
function garmentSummary(g: Garment): string {
  const parts = [g.garmentType, g.sizeLabel].filter(
    (p): p is string => typeof p === 'string' && p.trim() !== '',
  )
  return parts.join(' · ')
}

export default function LabAssets() {
  const navigate = useNavigate()
  // UX only — RLS refuses these writes regardless of what is rendered.
  const { canWrite } = useCapabilities()
  const [assets, setAssets] = useState<LabAsset[] | null>(null)
  // Keyed by asset id; an asset absent from this map is not clothing.
  const [garments, setGarments] = useState<Record<string, Garment>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    listLabAssets()
      .then(async (data) => {
        if (cancelled) return
        setAssets(data)
        // One request for the whole page rather than one per row. A failure
        // here leaves every asset rendering as before rather than taking the
        // list down — the clothing columns simply stay empty.
        try {
          const found = await getGarmentsForAssets(data.map((a) => a.id))
          if (!cancelled) setGarments(found)
        } catch (e: unknown) {
          console.warn('garment lookup failed:', e)
        }
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
                  {/* One column serves both kinds: a garment shows its type
                      and size, equipment keeps showing its manufacturer. */}
                  <th className="text-left font-semibold px-4 py-3">Type / Manufacturer</th>
                  <th className="text-left font-semibold px-4 py-3">Location</th>
                  <th className="text-left font-semibold px-4 py-3">Condition</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-left font-semibold px-4 py-3">Assigned To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ns-border-soft">
                {(assets ?? []).map((a) => {
                  const garment = garments[a.id] ?? null
                  return (
                  <tr
                    key={a.id}
                    data-testid={garment ? 'asset-row-clothing' : 'asset-row-generic'}
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
                      {/* The shirt icon is how clothing is identified at a
                          glance; it is absent for every other asset. */}
                      {garment && (
                        <Shirt
                          className="inline-block h-3.5 w-3.5 mr-1.5 -mt-0.5 text-ns-blue"
                          aria-label="Clothing item"
                        />
                      )}
                      <Link
                        to={`/lab-assets/${a.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-ns-navy font-medium hover:text-ns-blue"
                      >
                        {a.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {garment
                        ? garmentSummary(garment) || (
                            <span className="text-slate-400">—</span>
                          )
                        : a.manufacturer || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {a.location || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={conditionTone(a.condition)}>{a.condition}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {/* For clothing the listing lifecycle is the useful
                          status; the asset's own status still governs the
                          record and is shown on the detail page. */}
                      {garment ? (
                        <Badge
                          tone={garment.listingStatus === 'sold' ? 'success' : 'neutral'}
                        >
                          {garment.listingStatus}
                        </Badge>
                      ) : (
                        <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {a.assignedTo ?? <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                  )
                })}
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
