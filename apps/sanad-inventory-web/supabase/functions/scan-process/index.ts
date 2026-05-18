// supabase/functions/scan-process/index.ts
//
// Sanad Inventory — Photo Scan extraction stub.
//
// Deno serverless function. Returns deterministic mock extracted data
// based on `scan_type`. It does NOT call any AI provider yet — replace
// `mockResults[scanType]` with a real vision provider integration
// (OpenAI, Anthropic Claude Vision, Google Gemini, etc.) when ready.
//
// Deploy:  supabase functions deploy scan-process
// Invoke:  POST https://<project-ref>.supabase.co/functions/v1/scan-process
//
// Request body:
//   {
//     scan_type:        'intake' | 'condition' | 'missing'
//     scan_session_id:  string (uuid)
//     image_path:       string  (storage key in lab-asset-scans)
//     lab_asset_id?:    string | null
//   }
//
// Response:
//   {
//     scan_session_id, scan_type, confidence,
//     extracted: {
//       fields?, detected_condition?, missing_components?, suggested_lab_asset?
//     },
//     generated_at
//   }
//
// Note: this file runs under Deno, not the Vite/TS build. It is excluded
// from `tsconfig.json` via `include: ["src"]`.

// @ts-expect-error — Deno-only import; not resolved during the Vite build.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

type ScanType = 'intake' | 'condition' | 'missing'

type ExtractedField = {
  label: string
  value: string
  confidence: number
}

type Extracted = {
  fields?: ExtractedField[]
  detected_condition?: 'excellent' | 'good' | 'fair' | 'poor' | 'broken' | null
  missing_components?: { component_name: string; severity: 'minor' | 'medium' | 'critical' }[]
  suggested_lab_asset?: {
    tag?: string
    name?: string
    manufacturer?: string
    model?: string
    serial?: string
  }
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function aggregateConfidence(extracted: Extracted): number {
  const fields = extracted.fields ?? []
  if (fields.length === 0) return 0.85
  const sum = fields.reduce(
    (acc, f) => acc + Math.max(0, Math.min(1, f.confidence)),
    0,
  )
  return Math.round((sum / fields.length) * 1000) / 1000
}

// ── Deterministic mock results ────────────────────────────────────────
// TODO: replace this map with a real vision provider call. Read the
// uploaded image from Supabase Storage (lab-asset-scans bucket), send it
// to the provider, and shape the response into `Extracted`.
const mockResults: Record<ScanType, Extracted> = {
  intake: {
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
    fields: [
      { label: 'Visible wear',      value: 'Moderate',           confidence: 0.81 },
      { label: 'Surface damage',    value: 'None',               confidence: 0.93 },
      { label: 'Cable integrity',   value: 'Intact',             confidence: 0.86 },
      { label: 'Calibration label', value: 'Expires 2026-12-15', confidence: 0.74 },
    ],
    detected_condition: 'good',
  },
  missing: {
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    )
  }

  let body: {
    scan_type?: ScanType
    scan_session_id?: string
    image_path?: string
    lab_asset_id?: string | null
  }
  try {
    body = await req.json()
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Bad request', detail: String(err) }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    )
  }

  const scanType: ScanType = body.scan_type ?? 'condition'
  const extracted = mockResults[scanType] ?? mockResults.condition
  const confidence = aggregateConfidence(extracted)

  return new Response(
    JSON.stringify({
      scan_session_id: body.scan_session_id ?? null,
      scan_type: scanType,
      confidence,
      extracted,
      generated_at: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } },
  )
})
