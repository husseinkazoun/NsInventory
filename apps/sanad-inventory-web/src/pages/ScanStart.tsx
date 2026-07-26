import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  PackagePlus,
  ScanSearch,
  Upload,
  AlertTriangle,
  RefreshCcw,
  Loader2,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import {
  completeScanSession,
  processScanPhoto,
  startScanSession,
  uploadScanPhoto,
  type ProcessResponse,
  type ScanType,
} from '../lib/queries/scans'
import {
  GARMENT_REVIEW_FIELDS,
  conditionFromExtraction,
  confidenceFromExtraction,
  draftFromExtraction,
  needsReviewKeys,
  type AssetConditionValue,
  type GarmentDraft,
} from '../lib/clothing'

const CONDITION_CHOICES: AssetConditionValue[] = [
  'excellent',
  'good',
  'fair',
  'poor',
  'broken',
]

type Step = 'type' | 'capture' | 'review' | 'done'

type ScanTypeOption = {
  id: ScanType
  title: string
  description: string
  Icon: typeof PackagePlus
}

const scanTypeOptions: ScanTypeOption[] = [
  {
    id: 'intake',
    title: 'Intake',
    description:
      'Register a new asset by photo. Extract manufacturer, model, and serial automatically.',
    Icon: PackagePlus,
  },
  {
    id: 'condition',
    title: 'Condition Check',
    description:
      'Inspect an existing asset. Detect wear, damage, and a condition rating.',
    Icon: ClipboardCheck,
  },
  {
    id: 'missing',
    title: 'Missing Components',
    description: 'Identify missing parts against an expected component set.',
    Icon: ScanSearch,
  },
]

function confidenceTone(c: number): BadgeTone {
  if (c >= 0.9) return 'success'
  if (c >= 0.75) return 'info'
  if (c >= 0.6) return 'warning'
  return 'critical'
}

function severityTone(s: 'minor' | 'medium' | 'critical'): BadgeTone {
  if (s === 'critical') return 'critical'
  if (s === 'medium') return 'warning'
  return 'neutral'
}

export default function ScanStart() {
  const [params] = useSearchParams()
  const presetAssetId = params.get('asset')

  const [step, setStep] = useState<Step>('type')
  const [scanType, setScanType] = useState<ScanType>(
    presetAssetId ? 'condition' : 'intake',
  )
  const [labAssetId, setLabAssetId] = useState<string | null>(presetAssetId)

  const [scanSessionId, setScanSessionId] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imagePath, setImagePath] = useState<string | null>(null)

  const [photoScanId, setPhotoScanId] = useState<string | null>(null)

  const [extracted, setExtracted] = useState<ProcessResponse | null>(null)
  // The reviewer's working copy. Seeded from the AI extraction, then edited.
  // Null until an analysis with a clothing payload arrives; a demo fixture or
  // a non-clothing response leaves the review step read-only as before.
  const [draft, setDraft] = useState<GarmentDraft | null>(null)
  const [condition, setCondition] = useState<AssetConditionValue | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdAssetId, setCreatedAssetId] = useState<string | null>(null)

  function editDraft<K extends keyof GarmentDraft>(
    key: K,
    value: GarmentDraft[K],
  ) {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  }

  // Revoke the object URL when the preview changes / unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // Kick off the scan-process call when entering the review step.
  //
  // `extracted` is deliberately NOT a dependency. It used to be, and setting
  // it inside `.then` re-ran the effect, whose cleanup set `cancelled = true`
  // for the in-flight closure — so the `.finally` that clears `busy` was
  // skipped and the save button could stay disabled reading "Saving…" after a
  // perfectly successful analysis. Keying on the step alone means the effect
  // runs once per entry into review, which is what it was always meant to do.
  useEffect(() => {
    if (step !== 'review') return
    let cancelled = false
    setBusy(true)
    setError(null)
    processScanPhoto({
      scanSessionId: scanSessionId ?? 'demo',
      imagePath: imagePath ?? 'demo',
      scanType,
      labAssetId,
    })
      .then((r) => {
        if (cancelled) return
        setExtracted(r)
        // Seed the editable draft from the FULL extraction, not from
        // `fields` — the latter omits anything the model could not read, and
        // those are exactly the boxes the reviewer needs to fill in.
        if (r.clothing) {
          setDraft(draftFromExtraction(r.clothing))
          setCondition(conditionFromExtraction(r.clothing))
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [step, scanSessionId, imagePath, scanType, labAssetId])

  const continueLabel = useMemo(() => {
    if (scanType === 'intake') return 'Create Asset'
    if (scanType === 'missing') return 'Save Findings'
    return 'Save Inspection'
  }, [scanType])

  // Derived from the ORIGINAL extraction, not the draft: the badge describes
  // how confident the model was in what it read, and that does not change
  // because a human has since corrected the box.
  const confidences = useMemo(
    () => confidenceFromExtraction(extracted?.clothing),
    [extracted],
  )
  const flagged_ = useMemo(
    () => needsReviewKeys(extracted?.clothing),
    [extracted],
  )

  function pickFile(f: File | null) {
    setError(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setFile(f)
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
  }

  function restart() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setStep('type')
    setScanType(presetAssetId ? 'condition' : 'intake')
    setLabAssetId(presetAssetId)
    setScanSessionId(null)
    setFile(null)
    setPreviewUrl(null)
    setImagePath(null)
    setPhotoScanId(null)
    setExtracted(null)
    setDraft(null)
    setCondition(null)
    setError(null)
    setBusy(false)
    setCreatedAssetId(null)
  }

  function back() {
    setError(null)
    if (step === 'capture') setStep('type')
    else if (step === 'review') {
      // Discards the edits along with the analysis: going back means a new
      // photo, so keeping a draft tied to the previous one would be wrong.
      setExtracted(null)
      setDraft(null)
      setCondition(null)
      setStep('capture')
    }
  }

  async function fromTypeNext() {
    setBusy(true)
    setError(null)
    try {
      const { id } = await startScanSession({ scanType, labAssetId })
      setScanSessionId(id)
      setStep('capture')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function fromCaptureNext() {
    setBusy(true)
    setError(null)
    try {
      if (isSupabaseConfigured && file && scanSessionId) {
        const { imagePath: uploadedPath, photoScanId: uploadedId } =
          await uploadScanPhoto({ scanSessionId, file })
        setImagePath(uploadedPath)
        // Recorded so the saved garment can point at the photo it came from.
        setPhotoScanId(uploadedId)
      }
      setStep('review')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function fromReviewNext() {
    if (!extracted) return
    setBusy(true)
    setError(null)
    try {
      const { labAssetId: finalAssetId } = await completeScanSession({
        scanSessionId: scanSessionId ?? 'demo',
        scanType,
        labAssetId,
        extracted,
        // The reviewer's corrected values, not the AI's originals. The
        // original extraction still rides along inside `extracted` and is
        // stored separately for audit.
        garment: draft,
        condition,
        photoScanId,
      })
      setCreatedAssetId(finalAssetId)
      setStep('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="mb-4">
        <Link
          to={presetAssetId ? `/lab-assets/${presetAssetId}` : '/lab-assets'}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-ns-blue"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {presetAssetId ? 'asset' : 'Lab Assets'}
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

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
        >
          {error}
        </div>
      )}

      {step === 'type' && (
        <section className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card p-5 sm:p-6">
          <h3 className="text-base font-semibold text-ns-navy">What kind of scan?</h3>
          <p className="mt-1 text-sm text-slate-500">
            {presetAssetId
              ? 'Default is a condition check because you opened this from an asset.'
              : "Pick the workflow that matches what you're trying to capture."}
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
                      selected
                        ? 'bg-ns-blue text-white'
                        : 'bg-ns-blue-tint text-ns-blue',
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
            <Button to="/lab-assets" variant="secondary">
              Cancel
            </Button>
            <Button onClick={fromTypeNext} Icon={ArrowRight} disabled={busy}>
              {busy ? 'Starting…' : 'Continue'}
            </Button>
          </div>
        </section>
      )}

      {step === 'capture' && (
        <section className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card p-5 sm:p-6">
          <h3 className="text-base font-semibold text-ns-navy">Capture or upload</h3>
          <p className="mt-1 text-sm text-slate-500">
            Pick an image of the asset. On mobile this opens the camera.
          </p>

          {previewUrl ? (
            <div className="mt-4 grid sm:grid-cols-[minmax(0,18rem)_1fr] gap-4 items-start">
              <div className="rounded-xl overflow-hidden border border-ns-border-soft bg-slate-50">
                <img
                  src={previewUrl}
                  alt="Selected scan"
                  className="block w-full h-auto max-h-72 object-contain"
                />
              </div>
              <div className="text-sm text-slate-600">
                <div className="font-medium text-ns-navy">{file?.name}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {file
                    ? `${Math.round(file.size / 1024).toLocaleString()} KB · ${file.type || 'unknown type'}`
                    : ''}
                </div>
                <div className="mt-3">
                  <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-ns-border-soft bg-white px-3.5 py-2 text-sm font-medium text-ns-navy hover:bg-slate-50">
                    <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                    Replace
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
                {!isSupabaseConfigured && (
                  <p className="mt-3 text-xs text-slate-500">
                    Demo mode — the file stays in your browser; no upload happens.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border-2 border-dashed border-ns-border-soft bg-slate-50 px-6 py-12 text-center">
              <div
                aria-hidden="true"
                className="mx-auto inline-grid place-items-center h-14 w-14 rounded-full bg-white border border-ns-border-soft text-ns-blue"
              >
                <Camera className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Choose a photo to continue.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg bg-ns-blue px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-ns-blue/90">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Choose photo
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Live camera capture lands in a later phase.
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" Icon={ArrowLeft} onClick={back}>
              Back
            </Button>
            <Button
              onClick={fromCaptureNext}
              Icon={ArrowRight}
              disabled={busy || !file}
            >
              {busy ? 'Uploading…' : 'Continue'}
            </Button>
          </div>
        </section>
      )}

      {step === 'review' && (
        <section className="rounded-xl bg-white border border-ns-border-soft shadow-ns-card p-5 sm:p-6">
          <h3 className="text-base font-semibold text-ns-navy">
            Review extracted information
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {scanType === 'intake'
              ? 'Intake'
              : scanType === 'missing'
                ? 'Missing-components'
                : 'Condition'}{' '}
            scan results
            {isSupabaseConfigured ? ' from scan-process.' : ' (demo fixture).'}
          </p>

          {/*
            Demo mode only. In a configured environment `processScanPhoto`
            rejects anything not marked `simulated: false`, so a fabricated
            result can never reach this screen — but the notice stays, because
            the demo build renders the same component and must say plainly that
            the values are fixed placeholders.
          */}
          {extracted?.simulated && (
            <div
              role="status"
              data-testid="simulated-notice"
              className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              <AlertTriangle
                className="h-4 w-4 shrink-0 text-amber-600"
                aria-hidden="true"
              />
              <span>
                <strong>Simulated analysis — no image AI was used.</strong> The
                values below are fixed placeholders and are not derived from
                your photo. They are safe to review but must not be treated as
                a real inspection result.
              </span>
            </div>
          )}

          {/*
            Genuine AI result: the values ARE derived from the photo, but the
            model can be wrong. This screen is read-only — there are no editing
            controls yet — so the notice must not tell the reviewer to "correct"
            a field they cannot change. The only remedies actually available are
            to go back for a clearer photo, or to fix the asset after saving.
            Say exactly that until an edit workflow exists.
          */}
          {extracted && extracted.simulated === false && (
            <div
              role="status"
              data-testid="ai-review-notice"
              className="mt-4 flex items-start gap-2 rounded-lg border border-ns-blue/30 bg-ns-blue-tint px-3 py-2 text-xs text-ns-navy"
            >
              <AlertTriangle
                className="h-4 w-4 shrink-0 text-ns-blue"
                aria-hidden="true"
              />
              <span>
                <strong>AI suggestions — check before saving.</strong> These
                values were read from your photo by AI and can be wrong. Review
                every field and correct anything that is wrong before saving.
                Anything the AI could not read is left blank for you to fill
                in — or leave blank if you do not know.
              </span>
            </div>
          )}

          {!extracted && busy && (
            <div className="mt-4 rounded-xl border border-ns-border-soft bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              <Loader2
                className="mx-auto h-5 w-5 animate-spin text-ns-blue"
                aria-hidden="true"
              />
              <div className="mt-2">Analyzing image…</div>
            </div>
          )}

          {/*
            Editable clothing review. Bound to the full extraction, so every
            field appears whether or not the model could read it — an
            unreadable brand is an empty box the reviewer can fill in, not a
            missing row. The confidence badge shows only where a value was
            actually read; there is nothing to score on a blank.
          */}
          {extracted && draft && (
            <div
              data-testid="garment-review-form"
              className="mt-4 border border-ns-border-soft rounded-lg overflow-hidden divide-y divide-ns-border-soft"
            >
              {GARMENT_REVIEW_FIELDS.map((spec) => {
                const conf = confidences[spec.key]
                const flagged = flagged_.has(spec.key)
                return (
                  <div
                    key={spec.key}
                    className="grid grid-cols-1 sm:grid-cols-[10rem_1fr_auto] items-center gap-2 px-4 py-2.5 bg-white"
                  >
                    <label
                      htmlFor={`garment-${spec.key}`}
                      className="text-sm text-slate-500"
                    >
                      {spec.label}
                    </label>
                    <input
                      id={`garment-${spec.key}`}
                      type="text"
                      value={draft[spec.key] as string}
                      placeholder={spec.placeholder ?? 'Not read — add if known'}
                      onChange={(e) => editDraft(spec.key, e.target.value)}
                      className={[
                        'w-full rounded-lg border px-3 py-1.5 text-sm text-ns-navy',
                        'focus:outline-none focus:ring-2 focus:ring-ns-blue/30 focus:border-ns-blue',
                        flagged
                          ? 'border-amber-300 bg-amber-50/40'
                          : 'border-ns-border-soft bg-white',
                      ].join(' ')}
                    />
                    <span className="justify-self-end">
                      {conf == null ? (
                        <span className="text-[11px] text-slate-400">
                          {flagged ? 'needs review' : 'not read'}
                        </span>
                      ) : (
                        <span title="Extraction confidence">
                          <Badge tone={confidenceTone(conf)}>
                            {Math.round(conf * 100)}%
                          </Badge>
                        </span>
                      )}
                    </span>
                  </div>
                )
              })}

              {/* Condition is a choice, not free text — it maps onto the
                  asset condition scale. 'unknown' from the model arrives as
                  null so the reviewer picks rather than inheriting a guess. */}
              <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] items-center gap-2 px-4 py-2.5 bg-white">
                <label
                  htmlFor="garment-condition"
                  className="text-sm text-slate-500"
                >
                  Condition
                </label>
                <select
                  id="garment-condition"
                  value={condition ?? ''}
                  onChange={(e) =>
                    setCondition(
                      e.target.value === ''
                        ? null
                        : (e.target.value as AssetConditionValue),
                    )
                  }
                  className="w-full rounded-lg border border-ns-border-soft bg-white px-3 py-1.5 text-sm text-ns-navy focus:outline-none focus:ring-2 focus:ring-ns-blue/30 focus:border-ns-blue"
                >
                  <option value="">Not assessed</option>
                  {CONDITION_CHOICES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Read-only summary. Used for demo fixtures and for any response
              without a clothing payload, where there is nothing to edit. */}
          {extracted && !draft && (
            <div className="mt-4 divide-y divide-ns-border-soft border border-ns-border-soft rounded-lg overflow-hidden">
              {(extracted.fields ?? []).map((f) => (
                <div
                  key={f.label}
                  className="flex items-center justify-between px-4 py-3 text-sm bg-white"
                >
                  <span className="text-slate-500">{f.label}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium text-ns-navy">{f.value}</span>
                    {/* A demo fixture's score is fabricated; a real one is the
                        model's own confidence. The tooltip distinguishes them
                        so a fixed placeholder is never read as measured. */}
                    <span
                      title={
                        extracted.simulated
                          ? 'Simulated score — not a measured confidence'
                          : 'Extraction confidence'
                      }
                    >
                      <Badge tone={confidenceTone(f.confidence)}>
                        {Math.round(f.confidence * 100)}%
                      </Badge>
                    </span>
                  </span>
                </div>
              ))}

              {extracted.detected_condition && (
                <div className="flex items-center justify-between px-4 py-3 text-sm bg-white">
                  <span className="text-slate-500">Detected condition</span>
                  <Badge tone="success">{extracted.detected_condition}</Badge>
                </div>
              )}

              {extracted.missing_components && extracted.missing_components.length > 0 && (
                <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm bg-white">
                  <span className="text-slate-500">Missing components</span>
                  <ul className="text-right">
                    {extracted.missing_components.map((m) => (
                      <li
                        key={m.component_name}
                        className="flex items-center justify-end gap-2 text-ns-navy"
                      >
                        <span>{m.component_name}</span>
                        <Badge tone={severityTone(m.severity)}>{m.severity}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {scanType === 'intake' && extracted.suggested_lab_asset && (
                <div className="px-4 py-3 text-sm bg-white">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                    Suggested asset
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-y-1 gap-x-4">
                    {extracted.suggested_lab_asset.tag && (
                      <>
                        <span className="text-slate-500">Tag</span>
                        <span className="font-mono text-xs text-ns-navy text-right">
                          {extracted.suggested_lab_asset.tag}
                        </span>
                      </>
                    )}
                    {extracted.suggested_lab_asset.name && (
                      <>
                        <span className="text-slate-500">Name</span>
                        <span className="text-ns-navy text-right">
                          {extracted.suggested_lab_asset.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" Icon={ArrowLeft} onClick={back}>
              Back
            </Button>
            <Button
              onClick={fromReviewNext}
              Icon={CheckCircle2}
              disabled={busy || !extracted}
            >
              {!extracted ? 'Analyzing…' : busy ? 'Saving…' : continueLabel}
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
          <h3 className="mt-3 text-base font-semibold text-emerald-900">
            {isSupabaseConfigured
              ? scanType === 'intake'
                ? 'Asset created'
                : scanType === 'missing'
                  ? 'Findings saved'
                  : 'Inspection saved'
              : 'Mock scan saved'}
          </h3>
          <p className="mt-1 text-sm text-emerald-800">
            {isSupabaseConfigured
              ? 'Persisted to Supabase. Activity log updated.'
              : 'Demo mode — nothing was persisted. Configure Supabase env vars to enable real writes.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button variant="secondary" onClick={restart}>
              Start another scan
            </Button>
            {createdAssetId ? (
              <Button to={`/lab-assets/${createdAssetId}`}>View asset</Button>
            ) : (
              <Button to="/lab-assets">Back to Lab Assets</Button>
            )}
          </div>
        </section>
      )}
    </>
  )
}
