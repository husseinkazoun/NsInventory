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

export type LabAsset = {
  id: string
  tag: string
  name: string
  manufacturer: string
  location: string
  status: 'active' | 'maintenance' | 'inactive' | 'disposed'
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'broken'
  assignedTo: string | null
  nextMaintenance: Date | null
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
  {
    id: '1',
    code: 'PR-A1B2C3',
    name: 'Disposable Nitrile Gloves (Box)',
    category: 'Consumables',
    quantity: 124,
    alert: 50,
    price: 12.5,
    updatedAt: new Date('2026-05-12'),
  },
  {
    id: '2',
    code: 'PR-D4E5F6',
    name: 'Sterile Gauze Pads, 4×4',
    category: 'Consumables',
    quantity: 38,
    alert: 60,
    price: 6.2,
    updatedAt: new Date('2026-05-11'),
  },
  {
    id: '3',
    code: 'PR-G7H8I9',
    name: 'Surgical Mask Type II',
    category: 'PPE',
    quantity: 540,
    alert: 200,
    price: 0.35,
    updatedAt: new Date('2026-05-14'),
  },
  {
    id: '4',
    code: 'PR-J0K1L2',
    name: 'Pulse Oximeter, Fingertip',
    category: 'Devices',
    quantity: 12,
    alert: 15,
    price: 28.0,
    updatedAt: new Date('2026-05-09'),
  },
  {
    id: '5',
    code: 'PR-M3N4O5',
    name: 'Digital Thermometer',
    category: 'Devices',
    quantity: 22,
    alert: 20,
    price: 7.5,
    updatedAt: new Date('2026-05-10'),
  },
]

export const labAssets: LabAsset[] = [
  {
    id: '1',
    tag: 'LA-A1B2C3',
    name: 'Centrifuge MX-9',
    manufacturer: 'Eppendorf',
    location: 'Lab 2 · Bench A',
    status: 'active',
    condition: 'good',
    assignedTo: 'Y. Haddad',
    nextMaintenance: new Date('2026-05-22'),
  },
  {
    id: '2',
    tag: 'LA-D4E5F6',
    name: 'pH Meter Pro 700',
    manufacturer: 'Hanna',
    location: 'Lab 1 · Shelf 3',
    status: 'active',
    condition: 'excellent',
    assignedTo: 'L. Mansour',
    nextMaintenance: null,
  },
  {
    id: '3',
    tag: 'LA-G7H8I9',
    name: 'Microscope BX-53',
    manufacturer: 'Olympus',
    location: 'Lab 3 · Workstation 2',
    status: 'maintenance',
    condition: 'fair',
    assignedTo: null,
    nextMaintenance: new Date('2026-05-18'),
  },
  {
    id: '4',
    tag: 'LA-J0K1L2',
    name: 'Analytical Balance',
    manufacturer: 'Sartorius',
    location: 'Storage A',
    status: 'active',
    condition: 'good',
    assignedTo: 'R. Khoury',
    nextMaintenance: new Date('2026-07-01'),
  },
  {
    id: '5',
    tag: 'LA-M3N4O5',
    name: 'Incubator IS-200',
    manufacturer: 'Thermo',
    location: 'Lab 1 · Cabinet 2',
    status: 'inactive',
    condition: 'poor',
    assignedTo: null,
    nextMaintenance: null,
  },
]
