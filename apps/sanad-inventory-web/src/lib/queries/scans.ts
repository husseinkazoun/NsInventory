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
}

// ── Demo-mode + Edge-Function-down fallback fixtures ──────────────────
// Mirrors the Edge Function (`supabase/functions/scan-process/index.ts`)
// so the React UI looks identical in either mode.
const offlineMock: Record<ScanType, ProcessResponse> = {
  intake: {
    confidence: 0.865,
    fields: [
      { label: 'Manufacturer', value: 'Eppendorf',  confidence: 0.94 },
      { label: 'Model',        value: 'MX-9',       confidence: 0.89 },
      { label: 'Serial',       value: '87XJ-3401K', confidence: 0.72 },
      { label: 'Asset class',  value: 'Centrifuge', confidence: 0.91 },
    ],
    detected_condition: 'good',
    suggested_lab_asset: {
      tag: 'LA-INTAKE',
      name: 'Centrifuge (intake-detected)',
      manufacturer: 'Eppendorf',
      model: 'MX-9',
      serial: '87XJ-3401K',
    },
  },
  condition: {
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

  // Intake: auto-create a lab_assets row from the suggested fields.
  if (input.scanType === 'intake' && !labAssetId) {
    const sug = input.extracted.suggested_lab_asset
    const tag =
      sug?.tag && sug.tag.trim().length > 0
        ? sug.tag.trim().toUpperCase()
        : `LA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    const name = sug?.name?.trim() || sug?.model?.trim() || 'Untitled asset'
    const condition: AssetCondition =
      input.extracted.detected_condition ?? 'good'

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
