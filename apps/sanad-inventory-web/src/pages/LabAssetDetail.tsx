import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Microscope,
  ClipboardCheck,
  AlertTriangle,
  Activity,
  Pencil,
  Camera,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import {
  type AssetCondition,
  type AssetStatus,
  activityByAsset,
  getAssetById,
  inspectionByAsset,
  missingByAsset,
} from '../lib/mockData'
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
  const asset = getAssetById(assetId)

  if (!asset) {
    return (
      <>
        <div className="mb-4">
          <Link
            to="/lab-assets"
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-ns-blue"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Lab Assets
          </Link>
        </div>
        <EmptyState
          Icon={Microscope}
          title="Asset not found"
          description={`No lab asset with id "${assetId}" exists in the prototype data.`}
          action={
            <Button to="/lab-assets" variant="secondary">
              Return to list
            </Button>
          }
        />
      </>
    )
  }

  const inspection = inspectionByAsset[asset.id]
  const missing = missingByAsset[asset.id] ?? []
  const activity = activityByAsset[asset.id] ?? []

  return (
    <>
      <div className="mb-4">
        <Link
          to="/lab-assets"
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-ns-blue"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Lab Assets
        </Link>
      </div>

      <PageHeader
        pretitle={`Operations · Assets · ${asset.tag}`}
        title={asset.name}
        actions={
          <>
            <Button to={`/scan/start?asset=${asset.id}`} variant="secondary" Icon={Camera}>
              Inspect by Scan
            </Button>
            <Button variant="primary" Icon={Pencil} disabled>
              Edit
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Asset details */}
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
            <dd className="col-span-2 text-ns-navy">{asset.manufacturer}</dd>

            <dt className="col-span-1 text-slate-500">Model</dt>
            <dd className="col-span-2 text-ns-navy">{asset.model}</dd>

            <dt className="col-span-1 text-slate-500">Serial</dt>
            <dd className="col-span-2 font-mono text-xs text-ns-navy">{asset.serial}</dd>

            <dt className="col-span-1 text-slate-500">Location</dt>
            <dd className="col-span-2 text-ns-navy">{asset.location}</dd>

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

      <p className="mt-6 text-xs text-slate-400">
        Mocked data. Edit, real scanning, and live activity will land in later phases.
      </p>
    </>
  )
}
