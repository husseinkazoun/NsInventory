import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Microscope,
  ClipboardCheck,
  AlertTriangle,
  Activity,
  Camera,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import {
  type ActivityEvent,
  type AssetCondition,
  type AssetStatus,
  type InspectionSummary,
  type LabAsset,
  type MissingComponentRecord,
} from '../lib/mockData'
import { getLabAsset } from '../lib/queries/labAssets'
import {
  getInspectionSummary,
  listMissingComponents,
  listRecentActivity,
} from '../lib/queries/assetDetailPanels'
import { useCapabilities } from '../lib/permissions'
import { formatRelative } from '../lib/format'

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

function severityTone(s: 'minor' | 'medium' | 'critical'): BadgeTone {
  if (s === 'critical') return 'critical'
  if (s === 'medium') return 'warning'
  return 'neutral'
}

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function LabAssetDetail() {
  const { assetId = '' } = useParams<{ assetId: string }>()
  // UX only — RLS refuses these writes regardless of what is rendered.
  const { canWrite } = useCapabilities()
  const [asset, setAsset] = useState<LabAsset | null>(null)
  const [inspection, setInspection] = useState<InspectionSummary | null>(null)
  const [missing, setMissing] = useState<MissingComponentRecord[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErrorMsg(null)
    setAsset(null)
    setInspection(null)
    setMissing([])
    setActivity([])

    // Asset is the gating fetch — its failure surfaces in the error UI.
    // Each panel query has its own catch so one bad panel doesn't take
    // down the page; it just renders its empty state.
    Promise.all([
      getLabAsset(assetId),
      getInspectionSummary(assetId).catch((e: unknown) => {
        console.warn('inspection summary fetch failed:', e)
        return null
      }),
      listMissingComponents(assetId).catch((e: unknown) => {
        console.warn('missing components fetch failed:', e)
        return [] as MissingComponentRecord[]
      }),
      listRecentActivity(assetId).catch((e: unknown) => {
        console.warn('activity log fetch failed:', e)
        return [] as ActivityEvent[]
      }),
    ])
      .then(([a, insp, miss, act]) => {
        if (cancelled) return
        setAsset(a)
        setInspection(insp)
        setMissing(miss)
        setActivity(act)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setErrorMsg(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [assetId])

  const backLink = (
    <div className="mb-4">
      <Link
        to="/lab-assets"
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-ns-blue"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Lab Assets
      </Link>
    </div>
  )

  if (loading) {
    return (
      <>
        {backLink}
        <div className="rounded-xl border border-ns-border-soft bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-ns-card">
          Loading…
        </div>
      </>
    )
  }

  if (errorMsg) {
    return (
      <>
        {backLink}
        <EmptyState
          Icon={AlertTriangle}
          title="Couldn't load asset"
          description={errorMsg}
          action={
            <Button to="/lab-assets" variant="secondary">
              Return to list
            </Button>
          }
        />
      </>
    )
  }

  if (!asset) {
    return (
      <>
        {backLink}
        <EmptyState
          Icon={Microscope}
          title="Asset not found"
          description={`No lab asset with id "${assetId}" exists.`}
          action={
            <Button to="/lab-assets" variant="secondary">
              Return to list
            </Button>
          }
        />
      </>
    )
  }

  return (
    <>
      {backLink}

      <PageHeader
        pretitle={`Operations · Assets · ${asset.tag}`}
        title={asset.name}
        actions={
          canWrite ? (
            <Button
              to={`/scan/start?asset=${asset.id}`}
              variant="secondary"
              Icon={Camera}
            >
              Inspect by Scan
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Details */}
        <section className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card p-5">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ns-navy-soft mb-3">
            Details
          </h3>
          <dl className="grid grid-cols-3 gap-y-3 gap-x-4 text-sm">
            <dt className="col-span-1 text-slate-500">Tag</dt>
            <dd className="col-span-2 font-mono text-xs text-ns-navy">{asset.tag}</dd>

            <dt className="col-span-1 text-slate-500">Status</dt>
            <dd className="col-span-2">
              <Badge tone={statusTone(asset.status)}>{asset.status}</Badge>
            </dd>

            <dt className="col-span-1 text-slate-500">Condition</dt>
            <dd className="col-span-2">
              <Badge tone={conditionTone(asset.condition)}>{asset.condition}</Badge>
            </dd>

            <dt className="col-span-1 text-slate-500">Manufacturer</dt>
            <dd className="col-span-2 text-ns-navy">{asset.manufacturer || <span className="text-slate-400">—</span>}</dd>

            <dt className="col-span-1 text-slate-500">Model</dt>
            <dd className="col-span-2 text-ns-navy">{asset.model || <span className="text-slate-400">—</span>}</dd>

            <dt className="col-span-1 text-slate-500">Serial</dt>
            <dd className="col-span-2 font-mono text-xs text-ns-navy">
              {asset.serial || <span className="text-slate-400 font-sans">—</span>}
            </dd>

            <dt className="col-span-1 text-slate-500">Location</dt>
            <dd className="col-span-2 text-ns-navy">{asset.location || <span className="text-slate-400">—</span>}</dd>

            <dt className="col-span-1 text-slate-500">Assigned to</dt>
            <dd className="col-span-2 text-ns-navy">
              {asset.assignedTo ?? <span className="text-slate-400">Unassigned</span>}
            </dd>

            <dt className="col-span-1 text-slate-500">Last maintenance</dt>
            <dd className="col-span-2 text-ns-navy">{formatDate(asset.lastMaintenance)}</dd>

            <dt className="col-span-1 text-slate-500">Next maintenance</dt>
            <dd className="col-span-2 text-ns-navy">{formatDate(asset.nextMaintenance)}</dd>

            <dt className="col-span-1 text-slate-500">Warranty</dt>
            <dd className="col-span-2 text-ns-navy">{formatDate(asset.warrantyExpiry)}</dd>
          </dl>
        </section>

        {/* Inspection Summary */}
        <section className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card p-5">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ns-navy-soft mb-3">
            <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Inspection Summary
          </h3>
          {inspection && inspection.lastScanAt ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Last scan</span>
                <span className="text-ns-navy">{formatRelative(inspection.lastScanAt)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">AI confidence</span>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                    <span
                      className="block h-full bg-ns-blue"
                      style={{ width: `${Math.round((inspection.confidence ?? 0) * 100)}%` }}
                    />
                  </span>
                  <span className="font-semibold text-ns-navy tabular-nums">
                    {Math.round((inspection.confidence ?? 0) * 100)}%
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Detected condition</span>
                {inspection.detectedCondition ? (
                  <Badge tone={conditionTone(inspection.detectedCondition)}>
                    {inspection.detectedCondition}
                  </Badge>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Issues found</span>
                <span className="font-semibold text-ns-navy tabular-nums">
                  {inspection.issuesFound}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No scans recorded yet. Use{' '}
              <Link to={`/scan/start?asset=${asset.id}`} className="text-ns-blue hover:underline">
                Inspect by Scan
              </Link>{' '}
              to capture the first inspection.
            </p>
          )}
        </section>

        {/* Missing Components */}
        <section className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card p-5">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ns-navy-soft mb-3">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Missing Components
            {missing.length > 0 && (
              <span className="ml-1 text-slate-400 normal-case tracking-normal">({missing.length})</span>
            )}
          </h3>
          {missing.length === 0 ? (
            <p className="text-sm text-slate-500">No missing components detected.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {missing.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between border-b border-ns-border-soft last:border-0 pb-2 last:pb-0"
                >
                  <div>
                    <div className="font-medium text-ns-navy">{m.componentName}</div>
                    <div className="text-xs text-slate-500">Detected {formatRelative(m.detectedAt)}</div>
                  </div>
                  <Badge tone={severityTone(m.severity)}>{m.severity}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent Activity */}
        <section className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card p-5">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ns-navy-soft mb-3">
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            Recent Activity
          </h3>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet.</p>
          ) : (
            <ol className="relative space-y-3 text-sm">
              {activity.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 rounded-full bg-ns-blue shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-ns-navy">{e.description}</div>
                    <div className="text-xs text-slate-500">
                      {formatRelative(e.at)} · {e.by}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  )
}
