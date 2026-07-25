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
  usedOfflineMock?: boolean
  /**
   * True when the values were fabricated rather than derived from the image.
   * The Edge Function sets it; the offline fallback is simulated by
   * definition. The UI must say so plainly whenever it is true.
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

/** HTTP status carried by a FunctionsHttpError, when there is one. */
function functionErrorStatus(err: unknown): number | null {
  const context = (err as { context?: { status?: unknown } } | null)?.context
  const status = context?.status
  return typeof status === 'number' ? status : null
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

// ── Demo-mode + Edge-Function-down fallback fixtures ──────────────────
// Mirrors the Edge Function (`supabase/functions/scan-process/index.ts`)
// so the React UI looks identical in either mode.
const offlineMock: Record<ScanType, ProcessResponse> = {
  intake: {
    simulated: true,
    confidence: 0.865,
    fields: [
      { label: 'Manufacturer', value: 'Eppendorf',  confidence: 0.94 },
      { label: 'Model',        value: 'MX-9',       confidence: 0.89 },
      { label: 'Serial',       value: '87XJ-3401K', confidence: 0.72 },
      { label: 'Asset class',  value: 'Centrifuge', confidence: 0.91 },
    ],
    detected_condition: 'good',
    suggested_lab_asset: {
      // No constant tag — see intakeTagForSession().
      name: 'Centrifuge (simulated intake)',
      manufacturer: 'Eppendorf',
      model: 'MX-9',
      serial: '87XJ-3401K',
    },
  },
  condition: {
    simulated: true,
    confidence: 0.835,
    fields: [
      { label: 'Visible wear',      value: 'Moderate',           confidence: 0.81 },
      { label: 'Surface damage',    value: 'None',               confidence: 0.93 },
      { label: 'Cable integrity',   value: 'Intact',             confidence: 0.86 },
      { label: 'Calibration label', value: 'Expires 2026-12-15', confidence: 0.74 },
    ],
    detected_condition: 'good',
  },
  missing: {
    simulated: true,
    confidence: 0.94,
    fields: [
      { label: 'Components expected', value: '7', confidence: 1.0 },
      { label: 'Components detected', value: '5', confidence: 0.88 },
    ],
    missing_components: [
      { component_name: 'Power cable', severity: 'minor' },
      { component_name: 'Spare rotor', severity: 'medium' },
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
// processScanPhoto — calls the Edge Function, falls back to offline mock
// =====================================================================
export async function processScanPhoto(input: {
  scanSessionId: string
  imagePath: string
  scanType: ScanType
  labAssetId?: string | null
}): Promise<ProcessResponse> {
  if (!supabase) {
    return offlineMock[input.scanType]
  }

  try {
    const { data, error } = await supabase.functions.invoke('scan-process', {
      body: {
        scan_type: input.scanType,
        scan_session_id: input.scanSessionId,
        image_path: input.imagePath,
        lab_asset_id: input.labAssetId ?? null,
      },
    })
    if (error) throw error
    if (!data) throw new Error('Empty response from scan-process')

    const extracted = data.extracted ?? {}
    const response: ProcessResponse = {
      // Absent marker is treated as simulated: fail toward honesty, so a
      // future real provider must opt IN to claiming its output is genuine.
      simulated: data.simulated !== false,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
      fields: extracted.fields,
      detected_condition: extracted.detected_condition ?? null,
      missing_components: extracted.missing_components,
      suggested_lab_asset: extracted.suggested_lab_asset,
    }

    // Persist extracted payload onto the photo_scan row.
    await supabase
      .from('photo_scans')
      .update({
        processing_status: 'completed',
        confidence: response.confidence,
        extracted,
        processed_at: new Date().toISOString(),
      })
      .eq('scan_session_id', input.scanSessionId)
      .eq('image_path', input.imagePath)

    return response
  } catch (err) {
    // An expired credential is not an "Edge Function is down" condition —
    // masking it with mock output would hide the real problem. Re-throw so the
    // session-expiry path (sign out + redirect to /login) runs.
    if (isAuthExpiryError(err)) throw asAppError(err)

    // Likewise a refusal. 401 means the credential was rejected; 403 means the
    // caller is not allowed to scan here — a viewer, or another organization's
    // session. Both are real answers, and showing fabricated results instead
    // would tell the user their scan worked when the server declined it.
    const status = functionErrorStatus(err)
    if (status === 401 || status === 403) {
      throw new ScanAuthorizationError(status)
    }

    // Edge Function unreachable / errored — fall back to the offline mock
    // and surface a warning in the UI so users know it's a placeholder.
    const message = err instanceof Error ? err.message : String(err)
    try {
      await supabase
        .from('photo_scans')
        .update({
          processing_status: 'failed',
          error_message:
            'Edge function unavailable; surfaced offline mock to the client. ' +
            message,
        })
        .eq('scan_session_id', input.scanSessionId)
        .eq('image_path', input.imagePath)
    } catch {
      // best-effort; failing to record the failure shouldn't break UX
    }

    return { ...offlineMock[input.scanType], usedOfflineMock: true }
  }
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
