import { supabase } from '../supabaseClient'
import {
  labAssets as mockLabAssets,
  type AssetCondition,
  type AssetStatus,
  type LabAsset,
} from '../mockData'

/**
 * Hardcoded development organization id (matches `supabase/seed.sql`).
 *
 * TODO(commit-3+): replace with the active organization derived from the
 * signed-in user's `organization_members` rows. For Commit 2 we keep a
 * single seeded org so the query layer can land before auth bootstrap
 * is fleshed out.
 */
export const DEV_ORG_ID = '11111111-1111-1111-1111-111111111111'

// Row shape returned by `lab_assets` queries (snake_case, nullable).
type LabAssetRow = {
  id: string
  tag: string
  name: string
  manufacturer: string | null
  model: string | null
  serial: string | null
  location: string | null
  status: AssetStatus
  condition: AssetCondition
  last_maintenance: string | null
  next_maintenance: string | null
  warranty_expiry: string | null
  assigned_profile: { full_name: string | null } | null
}

// Embedded select: `lab_assets_assigned_to_fkey` is explicitly named in the
// migration so this join is stable.
const SELECT = `
  id, tag, name, manufacturer, model, serial, location,
  status, condition,
  last_maintenance, next_maintenance, warranty_expiry,
  assigned_profile:profiles!lab_assets_assigned_to_fkey ( full_name )
`

function rowToLabAsset(row: LabAssetRow): LabAsset {
  return {
    id: row.id,
    tag: row.tag,
    name: row.name,
    manufacturer: row.manufacturer ?? '',
    model: row.model ?? '',
    serial: row.serial ?? '',
    location: row.location ?? '',
    status: row.status,
    condition: row.condition,
    assignedTo: row.assigned_profile?.full_name ?? null,
    lastMaintenance: row.last_maintenance ? new Date(row.last_maintenance) : null,
    nextMaintenance: row.next_maintenance ? new Date(row.next_maintenance) : null,
    warrantyExpiry:  row.warranty_expiry  ? new Date(row.warranty_expiry)  : null,
  }
}

export async function listLabAssets(): Promise<LabAsset[]> {
  if (!supabase) return mockLabAssets
  const { data, error } = await supabase
    .from('lab_assets')
    .select(SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => rowToLabAsset(r as unknown as LabAssetRow))
}

export async function getLabAsset(id: string): Promise<LabAsset | null> {
  if (!supabase) return mockLabAssets.find((a) => a.id === id) ?? null
  const { data, error } = await supabase
    .from('lab_assets')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? rowToLabAsset(data as unknown as LabAssetRow) : null
}

export type CreateLabAssetInput = {
  name: string
  tag: string
  manufacturer?: string
  model?: string
  serial?: string
  location?: string
  condition: AssetCondition
  status: AssetStatus
}

export async function createLabAsset(input: CreateLabAssetInput): Promise<LabAsset> {
  if (!supabase) {
    // Mock-mode synthesis. Does not mutate the mock array — the React form
    // displays a "Mock save" success alert and stays on the page (per the
    // demo UX defined in earlier commits).
    return {
      id: crypto.randomUUID(),
      tag: input.tag,
      name: input.name,
      manufacturer: input.manufacturer ?? '',
      model: input.model ?? '',
      serial: input.serial ?? '',
      location: input.location ?? '',
      status: input.status,
      condition: input.condition,
      assignedTo: null,
      lastMaintenance: null,
      nextMaintenance: null,
      warrantyExpiry: null,
    }
  }

  const { data, error } = await supabase
    .from('lab_assets')
    .insert({
      organization_id: DEV_ORG_ID,
      tag: input.tag,
      name: input.name,
      manufacturer: input.manufacturer ?? null,
      model: input.model ?? null,
      serial: input.serial ?? null,
      location: input.location ?? null,
      condition: input.condition,
      status: input.status,
    })
    .select(SELECT)
    .single()

  if (error) throw error
  return rowToLabAsset(data as unknown as LabAssetRow)
}
