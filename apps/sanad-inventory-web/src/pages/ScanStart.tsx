import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  PackagePlus,
  ScanSearch,
  Upload,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, type BadgeTone } from '../components/ui/Badge'

type Step = 'type' | 'capture' | 'review' | 'done'
type ScanType = 'intake' | 'condition' | 'missing'

const scanTypeOptions: { id: ScanType; title: string; description: string; Icon: typeof PackagePlus }[] = [
  {
    id: 'intake',
    title: 'Intake',
    description: 'Register a new asset by photo. Extract manufacturer, model, and serial automatically.',
    Icon: PackagePlus,
  },
  {
    id: 'condition',
    title: 'Condition Check',
    description: 'Inspect an existing asset. Detect wear, damage, and a condition rating.',
    Icon: ClipboardCheck,
  },
  {
    id: 'missing',
    title: 'Missing Components',
    description: 'Identify missing parts against an expected component set.',
    Icon: ScanSearch,
  },
]

type ExtractedField = { label: string; value: string; confidence: number }
type ExtractedSet = {
  fields: ExtractedField[]
  detectedCondition: string | null
  missing: string[]
}

const mockExtracted: Record<ScanType, ExtractedSet> = {
  intake: {
    fields: [
      { label: 'Manufacturer', value: 'Eppendorf', confidence: 0.94 },
      { label: 'Model',        value: 'MX-9',       confidence: 0.89 },
      { label: 'Serial',       value: '87XJ-3401K', confidence: 0.72 },
      { label: 'Asset class',  value: 'Centrifuge', confidence: 0.91 },
    ],
    detectedCondition: 'good',
    missing: [],
  },
  condition: {
    fields: [
      { label: 'Visible wear',     value: 'Moderate',          confidence: 0.81 },
      { label: 'Surface damage',   value: 'None',              confidence: 0.93 },
      { label: 'Cable integrity',  value: 'Intact',            confidence: 0.86 },
      { label: 'Calibration label',value: 'Expires 2026-12-15',confidence: 0.74 },
    ],
    detectedCondition: 'good',
    missing: [],
  },
  missing: {
    fields: [
      { label: 'Components expected', value: '7', confidence: 1 },
      { label: 'Components detected', value: '5', confidence: 0.88 },
    ],
    detectedCondition: null,
    missing: ['Power cable', 'Spare rotor'],
  },
}

function confidenceTone(c: number): BadgeTone {
  if (c >= 0.9) return 'success'
  if (c >= 0.75) return 'info'
  if (c >= 0.6) return 'warning'
  return 'critical'
}

export default function ScanStart() {
  const [step, setStep] = useState<Step>('type')
  const [scanType, setScanType] = useState<ScanType>('intake')

  function next() {
    if (step === 'type') setStep('capture')
    else if (step === 'capture') setStep('review')
    else if (step === 'review') setStep('done')
  }

  function back() {
    if (step === 'capture') setStep('type')
    else if (step === 'review') setStep('capture')
    else if (step === 'done') setStep('review')
  }

  function restart() {
    setStep('type')
    setScanType('intake')
  }

  const extracted = mockExtracted[scanType]

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

      <PageHeader pretitle="Operations · Inspection" title="Photo Scan" />

      {/* Stepper */}
      <ol className="mb-6 flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
        {(['type', 'capture', 'review'] as const).map((s, i) => {
          const isActive = step === s
          const isDone =
            (step === 'capture' && s === 'type') ||
            (step === 'review' && (s === 'type' || s === 'capture')) ||
            step === 'done'
          return (
            <li key={s} className="flex items-center gap-2">
              <span
                className={[
                  'inline-grid place-items-center h-6 w-6 rounded-full text-[10px] font-semibold',
                  isActive
                    ? 'bg-ns-blue text-white'
                    : isDone
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500',
                ].join(' ')}
              >
                {i + 1}
              </span>
              <span className={isActive ? 'text-ns-navy' : 'text-slate-500'}>
                {s === 'type' ? 'Choose type' : s === 'capture' ? 'Capture' : 'Review'}
              </span>
              {i < 2 && <span aria-hidden="true" className="h-px w-6 bg-ns-border-soft" />}
            </li>
          )
        })}
      </ol>

      {step === 'type' && (
        <section className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card p-5 sm:p-6">
          <h3 className="text-base font-semibold text-ns-navy">What kind of scan?</h3>
          <p className="mt-1 text-sm text-slate-500">
            Pick the workflow that matches what you're trying to capture.
          </p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {scanTypeOptions.map(({ id, title, description, Icon }) => {
              const selected = scanType === id
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => setScanType(id)}
                  className={[
                    'text-left rounded-xl border p-4 transition-all bg-white',
                    selected
                      ? 'border-ns-blue ring-4 ring-ns-blue/15'
                      : 'border-ns-border-soft hover:border-ns-blue/50',
                  ].join(' ')}
                  aria-pressed={selected}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      'inline-grid place-items-center h-10 w-10 rounded-lg',
                      selected ? 'bg-ns-blue text-white' : 'bg-ns-blue-tint text-ns-blue',
                    ].join(' ')}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="mt-3 font-semibold text-ns-navy">{title}</div>
                  <div className="mt-1 text-sm text-slate-500">{description}</div>
                </button>
              )
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            <Button to="/lab-assets" variant="secondary">Cancel</Button>
            <Button onClick={next} Icon={ArrowRight}>Continue</Button>
          </div>
        </section>
      )}

      {step === 'capture' && (
        <section className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card p-5 sm:p-6">
          <h3 className="text-base font-semibold text-ns-navy">Capture or upload</h3>
          <p className="mt-1 text-sm text-slate-500">
            Drop an image of the asset, or take a photo with the device camera. (No upload happens yet.)
          </p>

          <div
            aria-hidden="true"
            className="mt-4 rounded-xl border-2 border-dashed border-ns-border-soft bg-slate-50 px-6 py-12 text-center"
          >
            <div className="mx-auto inline-grid place-items-center h-14 w-14 rounded-full bg-white border border-ns-border-soft text-ns-blue">
              <Camera className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Drop a photo here, or use the buttons below.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button variant="secondary" Icon={Camera} disabled>
                Use Camera
              </Button>
              <Button variant="secondary" Icon={Upload} disabled>
                Upload from disk
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" Icon={ArrowLeft} onClick={back}>Back</Button>
            <Button onClick={next} Icon={ArrowRight}>Continue</Button>
          </div>
        </section>
      )}

      {step === 'review' && (
        <section className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card p-5 sm:p-6">
          <h3 className="text-base font-semibold text-ns-navy">Review extracted information</h3>
          <p className="mt-1 text-sm text-slate-500">
            Mock AI results for a <span className="font-medium text-ns-navy">{scanTypeOptions.find(o => o.id === scanType)?.title}</span> scan.
          </p>

          <div className="mt-4 divide-y divide-ns-border-soft border border-ns-border-soft rounded-lg overflow-hidden">
            {extracted.fields.map((f) => (
              <div key={f.label} className="flex items-center justify-between px-4 py-3 text-sm bg-white">
                <span className="text-slate-500">{f.label}</span>
                <span className="flex items-center gap-3">
                  <span className="font-medium text-ns-navy">{f.value}</span>
                  <Badge tone={confidenceTone(f.confidence)}>
                    {Math.round(f.confidence * 100)}%
                  </Badge>
                </span>
              </div>
            ))}
            {extracted.detectedCondition && (
              <div className="flex items-center justify-between px-4 py-3 text-sm bg-white">
                <span className="text-slate-500">Detected condition</span>
                <Badge tone="success">{extracted.detectedCondition}</Badge>
              </div>
            )}
            {extracted.missing.length > 0 && (
              <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm bg-white">
                <span className="text-slate-500">Missing components</span>
                <ul className="text-right text-ns-navy">
                  {extracted.missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" Icon={ArrowLeft} onClick={back}>Back</Button>
            <Button onClick={next} Icon={CheckCircle2}>
              {scanType === 'intake' ? 'Create Asset' : 'Save Inspection'}
            </Button>
          </div>
        </section>
      )}

      {step === 'done' && (
        <section
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center"
        >
          <div className="mx-auto inline-grid place-items-center h-12 w-12 rounded-full bg-white border border-emerald-200 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-emerald-900">Mock scan saved</h3>
          <p className="mt-1 text-sm text-emerald-800">
            In a real build this would persist the scan results and route to the affected asset.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button variant="secondary" onClick={restart}>Start another scan</Button>
            <Button to="/lab-assets">Back to Lab Assets</Button>
          </div>
        </section>
      )}
    </>
  )
}
