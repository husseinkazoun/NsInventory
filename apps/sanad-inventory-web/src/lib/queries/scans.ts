import { FunctionsHttpError } from '@supabase/supabase-js'
import { currentUserId, supabase } from '../supabaseClient'
import { asAppError, isAuthExpiryError, resolveCurrentOrgId } from '../org'
import { createLabAsset } from './labAssets'
import type { AssetCondition } from '../mockData'

export type ScanType = 'intake' | 'condition' | 'missing'
export type PhotoType = 'overview' | 'serial_label' | 'components' | 'condition'

export type ExtractedField = {
  label: string
  value: string
  confidence: number
}

export type ExtractedMissing = {
  component_name: string
  severity: 'minor' | 'medium' | 'critical'
}

export type ExtractedResults = {
  fields?: ExtractedField[]
  detected_condition?: AssetCondition | null
  missing_components?: ExtractedMissing[]
  suggested_lab_asset?: {
    tag?: string
    name?: string
    manufacturer?: string
    model?: string
    serial?: string
  }
}

export type ProcessResponse = ExtractedResults & {
  confidence: number
  /**
   * Vestigial. Nothing sets it any more — configured mode has no offline
   * fallback — but `completeScanSession` still writes it to
   * `activity_log.meta`, where historical rows carry it. Always false today.
   */
  usedOfflineMock?: boolean
  /**
   * True when the values were fabricated rather than derived from the image.
   *
   * Only demo mode (no Supabase configured) ever produces it. In configured
   * mode a response must carry `simulated: false` explicitly; anything else is
   * rejected as a processing failure rather than shown as a result. The UI must
   * say so plainly whenever it is true.
   */
  simulated?: boolean
}

/**
 * The Edge Function refused the caller (401/403).
 *
 * Distinct from "the function is unavailable": a refusal is a real answer and
 * must never be papered over with simulated output.
 */
export class ScanAuthorizationError extends Error {
  readonly status: number
  constructor(status: number) {
    super(
      status === 401
        ? 'Your session is no longer valid. Please sign in again.'
        : 'You do not have permission to run a scan in this organization.',
    )
    this.name = 'ScanAuthorizationError'
    this.status = status
  }
}

/**
 * The Edge Function answered 2xx but the body was empty or not the shape the
 * client expects.
 *
 * Surfaced, never swallowed. Substituting the offline mock for an unusable
 * response would tell the user their image was analysed when nothing usable
 * actually came back.
 */
export class MalformedScanResponseError extends Error {
  constructor() {
    super('The scan service returned an unexpected response.')
    this.name = 'MalformedScanResponseError'
  }
}

/**
 * The scan could not be processed, and the user can retry.
 *
 * Covers a provider timeout/429/4xx/5xx, a network or relay failure, and an
 * empty or malformed response. In a *configured* environment there is no
 * offline fallback: a failure is surfaced, never papered over with fabricated
 * data. `serverMessage`, when present, is the Edge Function's own `{ error }`.
 */
export class ScanProcessingError extends Error {
  constructor(serverMessage?: string) {
    super(
      serverMessage && serverMessage.trim()
        ? serverMessage
        : 'The image could not be analyzed right now. Please try again.',
    )
    this.name = 'ScanProcessingError'
  }
}

/**
 * The Edge Function answered 2xx but did not assert the result was genuine.
 *
 * A real analysis is marked `simulated: false`. A response that says
 * `simulated: true`, or omits the marker entirely, is a placeholder — and in a
 * configured environment there is nothing legitimate that produces one. It is
 * treated as a processing failure so it can never be persisted as a completed
 * scan or turned into an asset. Module-private: callers only see the
 * `ScanProcessingError` it becomes.
 */
class SimulatedResultError extends Error {
  constructor() {
    super(
      'The scan service returned a simulated placeholder instead of a real ' +
        'analysis. Nothing was saved. Please try again.',
    )
    this.name = 'SimulatedResultError'
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * What a failed `scan-process` invocation should become.
 *
 * `auth` is a refusal (401/403) — a real answer about what the caller may do,
 * and the one case the UI must not offer to retry. Everything else is a
 * `failure`: unreachable function, relay failure, any HTTP status, a malformed
 * 2xx body, or a response that never claimed to be genuine. They share one
 * disposition because they share one outcome — mark the row failed, surface a
 * retryable error. There is deliberately no third branch that yields data.
 */
type InvokeDisposition =
  | { kind: 'auth'; status: 401 | 403 }
  | { kind: 'failure' }

function classifyInvokeError(err: unknown): InvokeDisposition {
  // The function returned a non-2xx status. The status decides everything.
  if (err instanceof FunctionsHttpError) {
    const status = (err.context as { status?: unknown } | undefined)?.status
    if (status === 401 || status === 403) return { kind: 'auth', status }
    return { kind: 'failure' }
  }
  // FunctionsFetchError / FunctionsRelayError (unreachable or relay failure),
  // MalformedScanResponseError, SimulatedResultError, anything unrecognised.
  return { kind: 'failure' }
}

/**
 * Turns a *successful* Edge Function body into a ProcessResponse, or throws.
 *
 * Runs in configured mode only, so it enforces the honesty invariant: the body
 * must claim genuineness explicitly with `simulated: false`. `simulated: true`
 * and an absent marker are both rejected — the caller must opt IN to asserting
 * the values came from the image, and silence is never read as consent. An
 * empty or malformed 2xx body is likewise a hard error: neither may quietly
 * become a scan the reviewer believes was analysed.
 */
function parseScanResponse(data: unknown): {
  response: ProcessResponse
  extracted: Record<string, unknown>
} {
  if (!isPlainObject(data)) throw new MalformedScanResponseError()
  const extracted = data.extracted
  if (!isPlainObject(extracted)) throw new MalformedScanResponseError()
  if (data.simulated !== false) throw new SimulatedResultError()

  const response: ProcessResponse = {
    // Proven above, not inferred: the body said so explicitly.
    simulated: false,
    confidence: typeof data.confidence === 'number' ? data.confidence : 0,
    fields: extracted.fields as ProcessResponse['fields'],
    detected_condition:
      (extracted.detected_condition as AssetCondition | null | undefined) ??
      null,
    missing_components:
      extracted.missing_components as ProcessResponse['missing_components'],
    suggested_lab_asset:
      extracted.suggested_lab_asset as ProcessResponse['suggested_lab_asset'],
  }
  return { response, extracted }
}

/**
 * Tag for an asset created by an intake scan.
 *
 * Derived from the scan session, so a retry of the same session produces the
 * same tag rather than a second asset. A constant tag used to collide with
 * `unique (organization_id, tag)` on the second intake scan in any
 * organization.
 */
export function intakeTagForSession(scanSessionId: string): string {
  const compact = scanSessionId.replace(/-/g, '').toUpperCase()
  return `LA-${compact.slice(0, 12)}`
}

// ── Demo-mode fixtures (no Supabase configured) ───────────────────────
// NOT a fallback. These are reachable only when `supabase` is null, i.e. the
// app was built without Supabase env vars. In a configured environment a
// failure surfaces as a retryable error and these are never substituted.
//
// The values are clothing, matching what the Edge Function now actually
// analyses — the old lab-equipment fixtures (centrifuge, rotor, calibration
// label) described a domain the scanner no longer recognises, which read as a
// real capability the product does not have. Every fixture is labelled in the
// value text as well as by `simulated: true`, so a screenshot taken out of
// context still says what it is.
const demoFixtures: Record<ScanType, ProcessResponse> = {
  intake: {
    simulated: true,
    confidence: 0.865,
    fields: [
      { label: 'Type',        value: 'Jacket (demo)',     confidence: 0.91 },
      { label: 'Brand',       value: 'Sample Brand (demo)', confidence: 0.72 },
      { label: 'Main color',  value: 'Navy',              confidence: 0.94 },
      { label: 'Size',        value: 'M',                 confidence: 0.89 },
      { label: 'Material',    value: '80% cotton, 20% polyester', confidence: 0.78 },
    ],
    detected_condition: 'good',
    suggested_lab_asset: {
      // No constant tag — see intakeTagForSession().
      name: 'Navy jacket, size M (simulated intake)',
      manufacturer: 'Sample Brand (demo)',
      model: 'Jacket',
      serial: 'DEMO-STYLE-0001',
    },
  },
  condition: {
    simulated: true,
    confidence: 0.835,
    fields: [
      { label: 'Visible wear',   value: 'Light (demo)',        confidence: 0.81 },
      { label: 'Stains',         value: 'None visible',        confidence: 0.93 },
      { label: 'Seam integrity', value: 'Intact',              confidence: 0.86 },
      { label: 'Care label',     value: 'Legible (demo)',      confidence: 0.74 },
    ],
    detected_condition: 'good',
  },
  missing: {
    simulated: true,
    confidence: 0.94,
    fields: [
      { label: 'Items expected', value: '7', confidence: 1.0 },
      { label: 'Items detected', value: '5', confidence: 0.88 },
    ],
    missing_components: [
      { component_name: 'Matching belt (demo)', severity: 'minor' },
      { component_name: 'Spare button (demo)', severity: 'medium' },
    ],
  },
}

function newId(): string {
  return crypto.randomUUID()
}

// =====================================================================
// startScanSession
// =====================================================================
export async function startScanSession(input: {
  scanType: ScanType
  labAssetId?: string | null
}): Promise<{ id: string }> {
  if (!supabase) {
    return { id: newId() }
  }
  const organizationId = await resolveCurrentOrgId()
  const { data, error } = await supabase
    .from('scan_sessions')
    .insert({
      organization_id: organizationId,
      lab_asset_id: input.labAssetId ?? null,
      scan_type: input.scanType,
      status: 'in_progress',
    })
    .select('id')
    .single()
  if (error) throw asAppError(error)
  return { id: data.id }
}

// =====================================================================
// uploadScanPhoto
// =====================================================================
export async function uploadScanPhoto(input: {
  scanSessionId: string
  file: File
  photoType?: PhotoType
}): Promise<{ photoScanId: string; imagePath: string }> {
  const photoType = input.photoType ?? 'overview'

  if (!supabase) {
    return {
      photoScanId: newId(),
      imagePath: `demo/${input.scanSessionId}/${input.file.name}`,
    }
  }

  // Resolve the org *before* touching Storage. The leading path segment is
  // what `scan_object_org()` parses for storage RLS, so an unresolved org
  // would surface as an opaque 403 on upload instead of a legible error.
  const organizationId = await resolveCurrentOrgId()

  // Path convention: '{organization_id}/{scan_session_id}/{ts}-{rand}.{ext}'.
  const ext = input.file.name.split('.').pop() || 'bin'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const imagePath = `${organizationId}/${input.scanSessionId}/${filename}`

  const { error: uploadError } = await supabase.storage
    .from('lab-asset-scans')
    .upload(imagePath, input.file, {
      contentType: input.file.type || 'application/octet-stream',
      upsert: false,
    })
  if (uploadError) throw asAppError(uploadError)

  const { data, error: insertError } = await supabase
    .from('photo_scans')
    .insert({
      organization_id: organizationId,
      scan_session_id: input.scanSessionId,
      image_path: imagePath,
      photo_type: photoType,
      processing_status: 'pending',
    })
    .select('id')
    .single()
  if (insertError) throw asAppError(insertError)

  return { photoScanId: data.id, imagePath }
}

// =====================================================================
// processScanPhoto — real analysis in Supabase mode; simulated only in demo
// =====================================================================
export async function processScanPhoto(input: {
  scanSessionId: string
  imagePath: string
  scanType: ScanType
  labAssetId?: string | null
}): Promise<ProcessResponse> {
  if (!supabase) {
    // DEMO MODE ONLY (no Supabase configured). The simulated fixture is
    // returned and clearly labelled in the UI. This is the ONLY place a
    // simulated result is ever produced.
    return demoFixtures[input.scanType]
  }

  // ── Configured mode: real analysis, NO offline fallback ──
  // Any failure marks the row failed and surfaces a clear, retryable error;
  // fabricated results are never substituted for a real analysis.
  const { response, extracted } = await runScanProcess(supabase, input)

  // ── Persist the extracted payload onto the photo_scan row ──
  // Outside the invocation error handling: a persistence failure after a
  // successful analysis is not a provider outage, so it surfaces directly.
  const { error: persistError } = await supabase
    .from('photo_scans')
    .update({
      processing_status: 'completed',
      confidence: response.confidence,
      extracted,
      processed_at: new Date().toISOString(),
    })
    .eq('scan_session_id', input.scanSessionId)
    .eq('image_path', input.imagePath)
  if (persistError) throw asAppError(persistError)

  return response
}

type ScanClient = NonNullable<typeof supabase>

type ScanInput = {
  scanSessionId: string
  imagePath: string
  scanType: ScanType
  labAssetId?: string | null
}

/**
 * Invokes `scan-process` and returns the parsed result, or throws.
 *
 * There is NO offline fallback here — this runs only when Supabase is
 * configured. A refusal (401/403) throws ScanAuthorizationError; every other
 * failure (network, relay, any HTTP status, an empty/malformed body, or a
 * response that did not assert `simulated: false`) marks the photo_scan row
 * failed best-effort and throws a retryable ScanProcessingError. A simulated
 * result is never produced or returned here.
 */
async function runScanProcess(
  client: ScanClient,
  input: ScanInput,
): Promise<{ response: ProcessResponse; extracted: Record<string, unknown> }> {
  try {
    const { data, error } = await client.functions.invoke('scan-process', {
      body: {
        scan_type: input.scanType,
        scan_session_id: input.scanSessionId,
        image_path: input.imagePath,
        lab_asset_id: input.labAssetId ?? null,
      },
    })
    if (error) throw error
    return parseScanResponse(data)
  } catch (err) {
    // An expired credential runs the session-expiry path (sign out + redirect).
    if (isAuthExpiryError(err)) throw asAppError(err)

    // 401/403 are refusals — a real answer, never fabricated over.
    const disposition = classifyInvokeError(err)
    if (disposition.kind === 'auth') {
      throw new ScanAuthorizationError(disposition.status)
    }

    // Everything else is a processing failure. Record it (best-effort) and
    // surface a clear, retryable error. No offline mock in configured mode.
    // A dishonest response has no server `{ error }` to relay, so it carries
    // its own explanation.
    const serverMessage =
      err instanceof SimulatedResultError
        ? err.message
        : await readServerMessage(err)
    await markPhotoScanFailed(client, input, err)
    throw new ScanProcessingError(serverMessage)
  }
}

/** Best-effort: records that this scan could not be processed. */
async function markPhotoScanFailed(
  client: ScanClient,
  input: ScanInput,
  err: unknown,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err)
  try {
    await client
      .from('photo_scans')
      .update({
        processing_status: 'failed',
        error_message: 'Image analysis failed: ' + message,
      })
      .eq('scan_session_id', input.scanSessionId)
      .eq('image_path', input.imagePath)
  } catch {
    // best-effort; failing to record the failure shouldn't hide the real error
  }
}

/** Best-effort read of the Edge Function's own `{ error }` message, if present. */
async function readServerMessage(err: unknown): Promise<string | undefined> {
  const context = (err as { context?: unknown } | null)?.context
  if (typeof Response !== 'undefined' && context instanceof Response) {
    try {
      const body = await context.clone().json()
      if (body && typeof body.error === 'string') return body.error
    } catch {
      // no JSON body; fall through to the generic message
    }
  }
  return undefined
}

// =====================================================================
// completeScanSession — marks done, optionally creates asset / missing
// =====================================================================
export async function completeScanSession(input: {
  scanSessionId: string
  scanType: ScanType
  labAssetId?: string | null
  extracted: ProcessResponse
}): Promise<{ labAssetId: string | null }> {
  if (!supabase) {
    return { labAssetId: input.labAssetId ?? null }
  }

  // Configured environment: never turn a simulated/fabricated result into a
  // real asset. Defence in depth — `processScanPhoto` already rejects anything
  // that did not assert genuineness, so a caller reaching here with one built
  // it by hand. The test is `!== false`, not `=== true`: an object that simply
  // omits the marker has not claimed to be real either, and must not become an
  // asset on the strength of a missing field.
  if (input.extracted.simulated !== false) {
    throw new ScanProcessingError(
      'This result was not confirmed as a real analysis and cannot be saved. ' +
        'Re-run the scan.',
    )
  }

  const organizationId = await resolveCurrentOrgId()
  let labAssetId = input.labAssetId ?? null

  // Retry safety, step 1: if this session already produced an asset, reuse it.
  // Completing the same session twice — a double click, or a retry after the
  // missing-components insert failed — must not create a second asset.
  if (!labAssetId) {
    const { data: existingSession } = await supabase
      .from('scan_sessions')
      .select('lab_asset_id')
      .eq('id', input.scanSessionId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (existingSession?.lab_asset_id) {
      labAssetId = existingSession.lab_asset_id as string
    }
  }

  // Intake: auto-create a lab_assets row from the suggested fields.
  if (input.scanType === 'intake' && !labAssetId) {
    const sug = input.extracted.suggested_lab_asset
    // Derived from the session, so a retry computes the same tag rather than
    // a new random one. Any tag the extractor suggests is ignored: a constant
    // suggestion collided with unique (organization_id, tag).
    const tag = intakeTagForSession(input.scanSessionId)
    const name = sug?.name?.trim() || sug?.model?.trim() || 'Untitled asset'
    const condition: AssetCondition =
      input.extracted.detected_condition ?? 'good'

    // Retry safety, step 2: if the row already exists under that tag — a
    // retry that got far enough to insert last time — adopt it instead of
    // failing on the unique constraint.
    const { data: existingAsset } = await supabase
      .from('lab_assets')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('tag', tag)
      .maybeSingle()

    if (existingAsset?.id) {
      labAssetId = existingAsset.id as string
    } else {
      const created = await createLabAsset({
        name,
        tag,
        manufacturer: sug?.manufacturer,
        model: sug?.model,
        serial: sug?.serial,
        condition,
        status: 'active',
      })
      labAssetId = created.id
    }
  }

  // Missing-components scan: bulk-insert findings linked to the asset.
  if (
    input.scanType === 'missing' &&
    labAssetId &&
    input.extracted.missing_components &&
    input.extracted.missing_components.length > 0
  ) {
    const rows = input.extracted.missing_components.map((m) => ({
      organization_id: organizationId,
      lab_asset_id: labAssetId,
      scan_session_id: input.scanSessionId,
      component_name: m.component_name,
      severity: m.severity,
    }))
    const { error: missErr } = await supabase
      .from('missing_components')
      .insert(rows)
    if (missErr) throw asAppError(missErr)
  }

  // Close the session.
  const { error: sessionErr } = await supabase
    .from('scan_sessions')
    .update({
      status: 'completed',
      lab_asset_id: labAssetId,
      summary: input.extracted as unknown as Record<string, unknown>,
      completed_at: new Date().toISOString(),
    })
    .eq('id', input.scanSessionId)
    .eq('organization_id', organizationId)
  if (sessionErr) throw asAppError(sessionErr)

  // Activity log entry — RLS-checked via is_org_member.
  if (labAssetId) {
    const pct = Math.round((input.extracted.confidence ?? 0) * 100)
    const performedBy = await currentUserId()
    await supabase.from('activity_log').insert({
      organization_id: organizationId,
      entity_type: 'lab_asset',
      entity_id: labAssetId,
      action: 'scanned',
      description: `Photo scan completed (${pct}% confidence)`,
      performed_by: performedBy,
      meta: {
        scan_type: input.scanType,
        scan_session_id: input.scanSessionId,
        used_offline_mock: input.extracted.usedOfflineMock ?? false,
      },
    })
  }

  return { labAssetId }
}
