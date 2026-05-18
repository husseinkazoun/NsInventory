import { supabase } from '../supabaseClient'
import {
  activityByAsset as mockActivity,
  inspectionByAsset as mockInspection,
  missingByAsset as mockMissing,
  type ActivityEvent,
  type ActivityEventType,
  type AssetCondition,
  type InspectionSummary,
  type MissingComponentRecord,
} from '../mockData'

// =====================================================================
// Inspection Summary — latest completed scan_session for this asset.
//
// `scan_sessions.summary` is the JSONB payload we wrote during
// `completeScanSession` (mirrors the Edge Function's `extracted` shape):
//   { confidence, detected_condition?, fields?, missing_components?, ... }
// `issuesFound` is a separate count over open missing_components rows so
// the panel reflects current state, not the count at scan time.
// Returns null when there's no completed scan yet for this asset.
// =====================================================================
export async function getInspectionSummary(
  assetId: string,
): Promise<InspectionSummary | null> {
  if (!supabase) return mockInspection[assetId] ?? null

  type SummaryShape = {
    confidence?: number | null
    detected_condition?: AssetCondition | null
  }

  const { data: session, error: sessErr } = await supabase
    .from('scan_sessions')
    .select('completed_at, summary')
    .eq('lab_asset_id', assetId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (sessErr) throw sessErr

  const { count: missingCount, error: missErr } = await supabase
    .from('missing_components')
    .select('id', { count: 'exact', head: true })
    .eq('lab_asset_id', assetId)
    .eq('status', 'missing')
  if (missErr) throw missErr

  if (!session) return null

  const summary = (session.summary ?? {}) as SummaryShape
  return {
    lastScanAt: session.completed_at ? new Date(session.completed_at) : null,
    confidence:
      typeof summary.confidence === 'number' ? summary.confidence : null,
    detectedCondition: summary.detected_condition ?? null,
    issuesFound: missingCount ?? 0,
  }
}

// =====================================================================
// Missing Components — open (status='missing') rows for the asset,
// newest first.
// =====================================================================
export async function listMissingComponents(
  assetId: string,
): Promise<MissingComponentRecord[]> {
  if (!supabase) return mockMissing[assetId] ?? []

  const { data, error } = await supabase
    .from('missing_components')
    .select('id, component_name, severity, detected_at')
    .eq('lab_asset_id', assetId)
    .eq('status', 'missing')
    .order('detected_at', { ascending: false })
  if (error) throw error

  type Row = {
    id: string
    component_name: string
    severity: 'minor' | 'medium' | 'critical'
    detected_at: string
  }
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    componentName: r.component_name,
    severity: r.severity,
    detectedAt: new Date(r.detected_at),
  }))
}

// =====================================================================
// Recent Activity — activity_log rows for entity_type='lab_asset',
// newest first, capped at 20 to keep the panel light.
//
// `performed_by` is collapsed to 'system' (null) or 'user' (any uuid).
// A profiles join for full names is intentionally out of scope here —
// the panel display only needs a short actor label.
// =====================================================================
export async function listRecentActivity(
  assetId: string,
): Promise<ActivityEvent[]> {
  if (!supabase) return mockActivity[assetId] ?? []

  const { data, error } = await supabase
    .from('activity_log')
    .select('id, action, description, performed_at, performed_by')
    .eq('entity_type', 'lab_asset')
    .eq('entity_id', assetId)
    .order('performed_at', { ascending: false })
    .limit(20)
  if (error) throw error

  type Row = {
    id: string
    action: ActivityEventType
    description: string | null
    performed_at: string
    performed_by: string | null
  }
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    type: r.action,
    description: r.description ?? r.action,
    at: new Date(r.performed_at),
    by: r.performed_by ? 'user' : 'system',
  }))
}
