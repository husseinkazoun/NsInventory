// Typed mock data for the React/Vite prototype.
// Swap each export for an API call when the backend lands.

export type Product = {
  id: string
  code: string
  name: string
  category: string
  quantity: number
  alert: number
  price: number
  updatedAt: Date
}

export type AssetStatus = 'active' | 'maintenance' | 'inactive' | 'disposed'
export type AssetCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'broken'

export type LabAsset = {
  id: string
  tag: string
  name: string
  manufacturer: string
  model: string
  serial: string
  location: string
  status: AssetStatus
  condition: AssetCondition
  assignedTo: string | null
  lastMaintenance: Date | null
  nextMaintenance: Date | null
  warrantyExpiry: Date | null
}

export type DashboardKPIs = {
  pendingPurchases: number
  pendingOrders: number
  ordersTotal: number
  ordersCompleted: number
  maintenanceDue: number
  missingComponents: number
  activeLabAssets: number
  products: number
  productsLowStock: number
  categories: number
  recentScans: number
  quotations: number
  quotationsToday: number
}

export const kpis: DashboardKPIs = {
  pendingPurchases: 8,
  pendingOrders: 12,
  ordersTotal: 47,
  ordersCompleted: 31,
  maintenanceDue: 3,
  missingComponents: 2,
  activeLabAssets: 24,
  products: 158,
  productsLowStock: 6,
  categories: 14,
  recentScans: 5,
  quotations: 19,
  quotationsToday: 2,
}

export const products: Product[] = [
  { id: '1', code: 'PR-A1B2C3', name: 'Disposable Nitrile Gloves (Box)', category: 'Consumables', quantity: 124, alert: 50,  price: 12.5, updatedAt: new Date('2026-05-12') },
  { id: '2', code: 'PR-D4E5F6', name: 'Sterile Gauze Pads, 4×4',         category: 'Consumables', quantity: 38,  alert: 60,  price: 6.2,  updatedAt: new Date('2026-05-11') },
  { id: '3', code: 'PR-G7H8I9', name: 'Surgical Mask Type II',           category: 'PPE',         quantity: 540, alert: 200, price: 0.35, updatedAt: new Date('2026-05-14') },
  { id: '4', code: 'PR-J0K1L2', name: 'Pulse Oximeter, Fingertip',       category: 'Devices',     quantity: 12,  alert: 15,  price: 28.0, updatedAt: new Date('2026-05-09') },
  { id: '5', code: 'PR-M3N4O5', name: 'Digital Thermometer',             category: 'Devices',     quantity: 22,  alert: 20,  price: 7.5,  updatedAt: new Date('2026-05-10') },
  { id: '6', code: 'PR-P6Q7R8', name: 'Reagent Kit, ELISA',              category: 'Reagents',    quantity: 9,   alert: 12,  price: 145.0,updatedAt: new Date('2026-05-13') },
  { id: '7', code: 'PR-S9T0U1', name: 'Cotton Swabs, Sterile (Pack)',    category: 'Consumables', quantity: 320, alert: 100, price: 3.4,  updatedAt: new Date('2026-05-08') },
  { id: '8', code: 'PR-V2W3X4', name: 'Lab Coat, Size M',                category: 'PPE',         quantity: 41,  alert: 30,  price: 18.0, updatedAt: new Date('2026-05-07') },
]

export const labAssets: LabAsset[] = [
  {
    id: '1', tag: 'LA-A1B2C3',
    name: 'Centrifuge MX-9', manufacturer: 'Eppendorf', model: 'MX-9', serial: '87XJ-3401K',
    location: 'Lab 2 · Bench A', status: 'active', condition: 'good',
    assignedTo: 'Y. Haddad',
    lastMaintenance: new Date('2026-02-15'),
    nextMaintenance: new Date('2026-05-22'),
    warrantyExpiry: new Date('2027-03-01'),
  },
  {
    id: '2', tag: 'LA-D4E5F6',
    name: 'pH Meter Pro 700', manufacturer: 'Hanna', model: 'Pro 700', serial: 'HI-PRO-118',
    location: 'Lab 1 · Shelf 3', status: 'active', condition: 'excellent',
    assignedTo: 'L. Mansour',
    lastMaintenance: new Date('2026-04-02'),
    nextMaintenance: null,
    warrantyExpiry: new Date('2028-01-20'),
  },
  {
    id: '3', tag: 'LA-G7H8I9',
    name: 'Microscope BX-53', manufacturer: 'Olympus', model: 'BX-53', serial: 'OL-BX53-2004',
    location: 'Lab 3 · Workstation 2', status: 'maintenance', condition: 'fair',
    assignedTo: null,
    lastMaintenance: new Date('2025-12-01'),
    nextMaintenance: new Date('2026-05-18'),
    warrantyExpiry: new Date('2026-09-30'),
  },
  {
    id: '4', tag: 'LA-J0K1L2',
    name: 'Analytical Balance', manufacturer: 'Sartorius', model: 'Quintix 224-1S', serial: 'SAR-Q224-009',
    location: 'Storage A', status: 'active', condition: 'good',
    assignedTo: 'R. Khoury',
    lastMaintenance: new Date('2026-01-12'),
    nextMaintenance: new Date('2026-07-01'),
    warrantyExpiry: new Date('2027-11-12'),
  },
  {
    id: '5', tag: 'LA-M3N4O5',
    name: 'Incubator IS-200', manufacturer: 'Thermo', model: 'Heratherm IS-200', serial: 'TH-IS200-44',
    location: 'Lab 1 · Cabinet 2', status: 'inactive', condition: 'poor',
    assignedTo: null,
    lastMaintenance: new Date('2025-08-20'),
    nextMaintenance: null,
    warrantyExpiry: null,
  },
]

// ── Detail-panel data, keyed by asset id ─────────────────────────────────

export type InspectionSummary = {
  lastScanAt: Date | null
  confidence: number | null // 0–1
  detectedCondition: AssetCondition | null
  issuesFound: number
}

export const inspectionByAsset: Record<string, InspectionSummary> = {
  '1': { lastScanAt: new Date('2026-05-14'), confidence: 0.87, detectedCondition: 'good',      issuesFound: 2 },
  '2': { lastScanAt: new Date('2026-05-08'), confidence: 0.93, detectedCondition: 'excellent', issuesFound: 0 },
  '3': { lastScanAt: new Date('2026-05-15'), confidence: 0.71, detectedCondition: 'fair',      issuesFound: 4 },
  '4': { lastScanAt: null,                   confidence: null, detectedCondition: null,        issuesFound: 0 },
  '5': { lastScanAt: new Date('2026-04-30'), confidence: 0.55, detectedCondition: 'poor',      issuesFound: 3 },
}

export type MissingComponentRecord = {
  id: string
  componentName: string
  severity: 'minor' | 'medium' | 'critical'
  detectedAt: Date
}

export const missingByAsset: Record<string, MissingComponentRecord[]> = {
  '1': [
    { id: 'm1', componentName: 'Power cable',  severity: 'minor',  detectedAt: new Date('2026-05-14') },
    { id: 'm2', componentName: 'Spare rotor',  severity: 'medium', detectedAt: new Date('2026-05-14') },
  ],
  '2': [],
  '3': [
    { id: 'm3', componentName: 'Eyepiece (10×)',  severity: 'critical', detectedAt: new Date('2026-05-15') },
    { id: 'm4', componentName: 'Stage clip',      severity: 'minor',    detectedAt: new Date('2026-05-15') },
    { id: 'm5', componentName: 'Halogen bulb',    severity: 'medium',   detectedAt: new Date('2026-05-15') },
    { id: 'm6', componentName: 'Cover slip set',  severity: 'minor',    detectedAt: new Date('2026-05-12') },
  ],
  '4': [],
  '5': [
    { id: 'm7', componentName: 'Temperature probe', severity: 'critical', detectedAt: new Date('2026-04-30') },
    { id: 'm8', componentName: 'Door seal',         severity: 'medium',   detectedAt: new Date('2026-04-30') },
    { id: 'm9', componentName: 'Inner rack',        severity: 'minor',    detectedAt: new Date('2026-04-28') },
  ],
}

export type ActivityEventType = 'created' | 'scanned' | 'assigned' | 'maintenance' | 'condition_changed'

export type ActivityEvent = {
  id: string
  type: ActivityEventType
  description: string
  at: Date
  by: string
}

export const activityByAsset: Record<string, ActivityEvent[]> = {
  '1': [
    { id: 'a1', type: 'scanned',     description: 'Condition scan completed (confidence 87%)', at: new Date('2026-05-14'), by: 'L. Mansour' },
    { id: 'a2', type: 'maintenance', description: 'Quarterly maintenance scheduled',           at: new Date('2026-05-10'), by: 'system' },
    { id: 'a3', type: 'assigned',    description: 'Assigned to Y. Haddad',                     at: new Date('2026-04-22'), by: 'R. Khoury' },
    { id: 'a4', type: 'created',     description: 'Asset registered',                          at: new Date('2025-11-04'), by: 'R. Khoury' },
  ],
  '2': [
    { id: 'a5', type: 'scanned',     description: 'Intake scan completed (confidence 93%)', at: new Date('2026-05-08'), by: 'L. Mansour' },
    { id: 'a6', type: 'assigned',    description: 'Assigned to L. Mansour',                  at: new Date('2026-04-02'), by: 'R. Khoury' },
    { id: 'a7', type: 'created',     description: 'Asset registered',                        at: new Date('2026-04-02'), by: 'R. Khoury' },
  ],
  '3': [
    { id: 'a8',  type: 'scanned',           description: 'Condition scan flagged 4 issues', at: new Date('2026-05-15'), by: 'system' },
    { id: 'a9',  type: 'condition_changed', description: 'Condition lowered to "fair"',     at: new Date('2026-05-15'), by: 'system' },
    { id: 'a10', type: 'maintenance',       description: 'Sent to maintenance queue',       at: new Date('2026-05-15'), by: 'R. Khoury' },
    { id: 'a11', type: 'created',           description: 'Asset registered',                at: new Date('2024-09-10'), by: 'R. Khoury' },
  ],
  '4': [
    { id: 'a12', type: 'assigned', description: 'Assigned to R. Khoury', at: new Date('2026-01-12'), by: 'R. Khoury' },
    { id: 'a13', type: 'created',  description: 'Asset registered',      at: new Date('2026-01-12'), by: 'R. Khoury' },
  ],
  '5': [
    { id: 'a14', type: 'scanned',           description: 'Detected 3 missing components',   at: new Date('2026-04-30'), by: 'system' },
    { id: 'a15', type: 'condition_changed', description: 'Condition lowered to "poor"',     at: new Date('2026-04-30'), by: 'system' },
    { id: 'a16', type: 'maintenance',       description: 'Marked as inactive',              at: new Date('2026-04-30'), by: 'R. Khoury' },
    { id: 'a17', type: 'created',           description: 'Asset registered',                at: new Date('2024-05-18'), by: 'R. Khoury' },
  ],
}

export function getAssetById(id: string): LabAsset | undefined {
  return labAssets.find((a) => a.id === id)
}
