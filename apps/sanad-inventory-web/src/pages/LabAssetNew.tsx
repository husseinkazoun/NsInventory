import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Save } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import type { AssetCondition, AssetStatus } from '../lib/mockData'

type FormState = {
  name: string
  tag: string
  manufacturer: string
  model: string
  serial: string
  location: string
  assignedTo: string
  condition: AssetCondition
  status: AssetStatus
}

const empty: FormState = {
  name: '',
  tag: '',
  manufacturer: '',
  model: '',
  serial: '',
  location: '',
  assignedTo: '',
  condition: 'good',
  status: 'active',
}

const fieldLabel =
  'block text-xs font-semibold uppercase tracking-wider text-ns-navy-soft mb-1.5'
const fieldInput =
  'w-full h-10 px-3 rounded-lg border border-ns-border-soft bg-white text-sm text-ns-navy placeholder:text-slate-400 focus:outline-none focus:border-ns-blue focus:ring-4 focus:ring-ns-blue/15'

export default function LabAssetNew() {
  const [form, setForm] = useState<FormState>(empty)
  const [submitted, setSubmitted] = useState(false)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitted(true)
  }

  function reset() {
    setForm(empty)
    setSubmitted(false)
  }

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

      <PageHeader pretitle="Operations · Assets" title="Add Lab Asset" />

      {submitted && (
        <div
          role="status"
          className="mb-4 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <div className="flex-1">
            <div className="font-semibold">Mock save — no data was actually persisted.</div>
            <div className="mt-0.5">
              In a real build this would create asset{' '}
              <span className="font-mono">{form.tag || '(no tag)'}</span>{' '}
              and route you to its detail page.
            </div>
          </div>
          <Button variant="ghost" onClick={reset}>
            Add another
          </Button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card p-5 sm:p-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="f-name" className={fieldLabel}>Asset name</label>
            <input
              id="f-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. Centrifuge MX-9"
              className={fieldInput}
            />
          </div>

          <div>
            <label htmlFor="f-tag" className={fieldLabel}>Tag</label>
            <input
              id="f-tag"
              type="text"
              required
              value={form.tag}
              onChange={(e) => update('tag', e.target.value.toUpperCase())}
              placeholder="LA-A1B2C3"
              className={`${fieldInput} font-mono uppercase`}
            />
          </div>

          <div>
            <label htmlFor="f-manufacturer" className={fieldLabel}>Manufacturer</label>
            <input
              id="f-manufacturer"
              type="text"
              value={form.manufacturer}
              onChange={(e) => update('manufacturer', e.target.value)}
              placeholder="Eppendorf"
              className={fieldInput}
            />
          </div>

          <div>
            <label htmlFor="f-model" className={fieldLabel}>Model</label>
            <input
              id="f-model"
              type="text"
              value={form.model}
              onChange={(e) => update('model', e.target.value)}
              placeholder="MX-9"
              className={fieldInput}
            />
          </div>

          <div>
            <label htmlFor="f-serial" className={fieldLabel}>Serial number</label>
            <input
              id="f-serial"
              type="text"
              value={form.serial}
              onChange={(e) => update('serial', e.target.value)}
              placeholder="87XJ-3401K"
              className={`${fieldInput} font-mono`}
            />
          </div>

          <div>
            <label htmlFor="f-location" className={fieldLabel}>Location</label>
            <input
              id="f-location"
              type="text"
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder="Lab 2 · Bench A"
              className={fieldInput}
            />
          </div>

          <div>
            <label htmlFor="f-assigned" className={fieldLabel}>Assigned to</label>
            <input
              id="f-assigned"
              type="text"
              value={form.assignedTo}
              onChange={(e) => update('assignedTo', e.target.value)}
              placeholder="Optional · staff name"
              className={fieldInput}
            />
          </div>

          <div>
            <label htmlFor="f-condition" className={fieldLabel}>Condition</label>
            <select
              id="f-condition"
              value={form.condition}
              onChange={(e) => update('condition', e.target.value as AssetCondition)}
              className={fieldInput}
            >
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
              <option value="broken">Broken</option>
            </select>
          </div>

          <div>
            <label htmlFor="f-status" className={fieldLabel}>Status</label>
            <select
              id="f-status"
              value={form.status}
              onChange={(e) => update('status', e.target.value as AssetStatus)}
              className={fieldInput}
            >
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="inactive">Inactive</option>
              <option value="disposed">Disposed</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <Button to="/lab-assets" variant="secondary">
            Cancel
          </Button>
          <Button type="submit" Icon={Save}>
            Save Lab Asset
          </Button>
        </div>
      </form>

      <p className="mt-4 text-xs text-slate-400">
        Mock form — submissions are not persisted yet.
      </p>
    </>
  )
}
