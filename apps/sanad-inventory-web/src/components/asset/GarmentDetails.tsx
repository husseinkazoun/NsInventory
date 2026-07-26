// Clothing detail panel: the garment fields for an asset, and the workflow
// for correcting them after the scan has been saved.
//
// Rendered only when the asset actually has a `garments` row. Equipment never
// reaches this component, so nothing here needs to defend against a
// non-clothing asset.

import { useEffect, useState } from 'react'
import { Pencil, Save, Shirt, X } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import {
  getScanPhotoUrl,
  updateGarment,
  type Garment,
} from '../../lib/queries/garments'
import { LISTING_STATUSES, type ListingStatus } from '../../lib/clothing'

type Props = {
  garment: Garment
  /** UX only — RLS refuses the write regardless of what is rendered. */
  canWrite: boolean
  onSaved: (updated: Garment) => void
}

type Editable = {
  title: string
  garmentType: string
  brand: string
  sizeLabel: string
  sizeSystem: string
  material: string
  primaryColor: string
  secondaryColor: string
  pattern: string
  conditionNotes: string
  sku: string
  notes: string
  listingStatus: ListingStatus
  purchaseCost: string
  sellingPrice: string
}

// Null becomes '' for the input, and '' becomes null again on save. A cleared
// box means "unknown", which is what NULL says — never an empty string.
const s = (v: string | null) => v ?? ''
const n = (v: number | null) => (v == null ? '' : String(v))

function toEditable(g: Garment): Editable {
  return {
    title: s(g.title),
    garmentType: s(g.garmentType),
    brand: s(g.brand),
    sizeLabel: s(g.sizeLabel),
    sizeSystem: s(g.sizeSystem),
    material: s(g.material),
    primaryColor: s(g.primaryColor),
    secondaryColor: s(g.secondaryColor),
    pattern: s(g.pattern),
    conditionNotes: s(g.conditionNotes),
    sku: s(g.sku),
    notes: s(g.notes),
    listingStatus: g.listingStatus,
    purchaseCost: n(g.purchaseCost),
    sellingPrice: n(g.sellingPrice),
  }
}

/** '' -> null; a non-numeric string -> null rather than NaN. */
function money(v: string): number | null {
  const t = v.trim()
  if (t === '') return null
  const parsed = Number(t)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

const TEXT_FIELDS: Array<{ key: keyof Editable; label: string }> = [
  { key: 'title', label: 'Item name' },
  { key: 'garmentType', label: 'Type' },
  { key: 'brand', label: 'Brand' },
  { key: 'sizeLabel', label: 'Size' },
  { key: 'sizeSystem', label: 'Size system' },
  { key: 'material', label: 'Material' },
  { key: 'primaryColor', label: 'Main color' },
  { key: 'secondaryColor', label: 'Secondary color' },
  { key: 'pattern', label: 'Pattern' },
  { key: 'sku', label: 'SKU' },
]

function Value({ v }: { v: string | null }) {
  // An unset field reads as "not recorded", not as a blank the viewer might
  // mistake for a value that happens to be empty.
  if (v == null || v === '') {
    return <span className="text-slate-400">Not recorded</span>
  }
  return <span className="text-ns-navy">{v}</span>
}

export function GarmentDetails({ garment, canWrite, onSaved }: Props) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Editable>(() => toEditable(garment))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  // The bucket is private: this is a short-lived signed URL, and storage RLS
  // still applies. A caller who may not read the object gets null, which
  // renders as "no photo" rather than a broken image.
  useEffect(() => {
    let cancelled = false
    setPhotoUrl(null)
    if (!garment.primaryPhotoScanId) return
    getScanPhotoUrl(garment.primaryPhotoScanId)
      .then((url) => {
        if (!cancelled) setPhotoUrl(url)
      })
      .catch(() => {
        if (!cancelled) setPhotoUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [garment.primaryPhotoScanId])

  function edit<K extends keyof Editable>(key: K, value: Editable[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function cancel() {
    setForm(toEditable(garment))
    setError(null)
    setEditing(false)
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateGarment(garment.id, {
        title: form.title,
        garmentType: form.garmentType,
        brand: form.brand,
        sizeLabel: form.sizeLabel,
        sizeSystem: form.sizeSystem,
        material: form.material,
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        pattern: form.pattern,
        conditionNotes: form.conditionNotes,
        sku: form.sku,
        notes: form.notes,
        listingStatus: form.listingStatus,
        purchaseCost: money(form.purchaseCost),
        sellingPrice: money(form.sellingPrice),
      })
      onSaved(updated)
      setEditing(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      data-testid="garment-details"
      className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ns-navy-soft">
          <Shirt className="h-3.5 w-3.5" aria-hidden="true" />
          Garment Details
        </h3>
        {canWrite && !editing && (
          <Button variant="secondary" Icon={Pencil} onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
        >
          {error}
        </div>
      )}

      {photoUrl && (
        <div className="mb-4 rounded-lg overflow-hidden border border-ns-border-soft bg-slate-50">
          <img
            src={photoUrl}
            alt={garment.title ?? 'Garment photo'}
            className="block w-full h-auto max-h-72 object-contain"
          />
        </div>
      )}

      {editing ? (
        <div className="space-y-2">
          {TEXT_FIELDS.map(({ key, label }) => (
            <div
              key={key}
              className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] items-center gap-2"
            >
              <label htmlFor={`g-${key}`} className="text-sm text-slate-500">
                {label}
              </label>
              <input
                id={`g-${key}`}
                type="text"
                value={form[key] as string}
                placeholder="Not recorded"
                onChange={(e) => edit(key, e.target.value as Editable[typeof key])}
                className="w-full rounded-lg border border-ns-border-soft bg-white px-3 py-1.5 text-sm text-ns-navy focus:outline-none focus:ring-2 focus:ring-ns-blue/30 focus:border-ns-blue"
              />
            </div>
          ))}

          <div className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] items-center gap-2">
            <label htmlFor="g-listingStatus" className="text-sm text-slate-500">
              Listing status
            </label>
            <select
              id="g-listingStatus"
              value={form.listingStatus}
              onChange={(e) => edit('listingStatus', e.target.value as ListingStatus)}
              className="w-full rounded-lg border border-ns-border-soft bg-white px-3 py-1.5 text-sm text-ns-navy"
            >
              {LISTING_STATUSES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {(
            [
              ['purchaseCost', 'Purchase cost'],
              ['sellingPrice', 'Selling price'],
            ] as const
          ).map(([key, label]) => (
            <div
              key={key}
              className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] items-center gap-2"
            >
              <label htmlFor={`g-${key}`} className="text-sm text-slate-500">
                {label}
              </label>
              <input
                id={`g-${key}`}
                type="number"
                min="0"
                step="0.01"
                value={form[key]}
                placeholder="Not recorded"
                onChange={(e) => edit(key, e.target.value)}
                className="w-full rounded-lg border border-ns-border-soft bg-white px-3 py-1.5 text-sm text-ns-navy"
              />
            </div>
          ))}

          {(
            [
              ['conditionNotes', 'Condition notes'],
              ['notes', 'Notes'],
            ] as const
          ).map(([key, label]) => (
            <div
              key={key}
              className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] items-start gap-2"
            >
              <label htmlFor={`g-${key}`} className="text-sm text-slate-500 pt-1.5">
                {label}
              </label>
              <textarea
                id={`g-${key}`}
                rows={2}
                value={form[key]}
                placeholder="Not recorded"
                onChange={(e) => edit(key, e.target.value)}
                className="w-full rounded-lg border border-ns-border-soft bg-white px-3 py-1.5 text-sm text-ns-navy"
              />
            </div>
          ))}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" Icon={X} onClick={cancel} disabled={busy}>
              Cancel
            </Button>
            <Button Icon={Save} onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      ) : (
        <dl className="grid grid-cols-3 gap-y-3 gap-x-4 text-sm">
          {TEXT_FIELDS.map(({ key, label }) => (
            <div key={key} className="contents">
              <dt className="col-span-1 text-slate-500">{label}</dt>
              <dd className="col-span-2">
                <Value v={form[key] as string} />
              </dd>
            </div>
          ))}

          <dt className="col-span-1 text-slate-500">Listing status</dt>
          <dd className="col-span-2">
            <Badge tone={garment.listingStatus === 'sold' ? 'success' : 'neutral'}>
              {garment.listingStatus}
            </Badge>
          </dd>

          <dt className="col-span-1 text-slate-500">Purchase cost</dt>
          <dd className="col-span-2">
            <Value v={garment.purchaseCost == null ? null : String(garment.purchaseCost)} />
          </dd>

          <dt className="col-span-1 text-slate-500">Selling price</dt>
          <dd className="col-span-2">
            <Value v={garment.sellingPrice == null ? null : String(garment.sellingPrice)} />
          </dd>

          <dt className="col-span-1 text-slate-500">Condition notes</dt>
          <dd className="col-span-2">
            <Value v={garment.conditionNotes} />
          </dd>

          {garment.flaws.length > 0 && (
            <>
              <dt className="col-span-1 text-slate-500">Flaws</dt>
              <dd className="col-span-2">
                <ul className="space-y-1">
                  {garment.flaws.map((f, i) => (
                    <li key={`${f.location}-${i}`} className="flex items-center gap-2">
                      <Badge tone={f.severity === 'severe' ? 'critical' : 'warning'}>
                        {f.severity}
                      </Badge>
                      <span className="text-ns-navy">
                        {f.location}
                        {f.description ? ` — ${f.description}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </dd>
            </>
          )}

          <dt className="col-span-1 text-slate-500">Notes</dt>
          <dd className="col-span-2">
            <Value v={garment.notes} />
          </dd>
        </dl>
      )}
    </section>
  )
}
