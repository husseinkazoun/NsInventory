import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { LabAsset } from '../lib/mockData'
import type { Garment } from '../lib/queries/garments'

// The page is exercised against mocked queries: what is under test is which
// sections render for a garment versus for equipment, not how the data was
// fetched. RLS and the query layer have their own suites.

const getLabAsset = vi.fn()
const getGarmentForAsset = vi.fn()
const getScanPhotoUrl = vi.fn()
const updateGarment = vi.fn()

vi.mock('../lib/queries/labAssets', () => ({
  getLabAsset: (...a: unknown[]) => getLabAsset(...a),
}))
vi.mock('../lib/queries/garments', () => ({
  getGarmentForAsset: (...a: unknown[]) => getGarmentForAsset(...a),
  getScanPhotoUrl: (...a: unknown[]) => getScanPhotoUrl(...a),
  updateGarment: (...a: unknown[]) => updateGarment(...a),
}))
vi.mock('../lib/queries/assetDetailPanels', () => ({
  getInspectionSummary: () => Promise.resolve(null),
  listMissingComponents: () => Promise.resolve([]),
  listRecentActivity: () => Promise.resolve([]),
}))
vi.mock('../lib/permissions', () => ({
  useCapabilities: () => ({ canWrite: true, canDelete: false }),
}))

const LabAssetDetail = (await import('./LabAssetDetail')).default

const ASSET_ID = 'a1111111-1111-4111-8111-111111111111'

function asset(over: Partial<LabAsset> = {}): LabAsset {
  return {
    id: ASSET_ID,
    tag: 'LA-000000000001',
    name: 'Navy jacket',
    manufacturer: 'Eppendorf',
    model: 'MX-9',
    serial: '87XJ-3401K',
    location: 'Shelf 3',
    status: 'active',
    condition: 'good',
    assignedTo: null,
    lastMaintenance: new Date('2026-01-01'),
    nextMaintenance: new Date('2026-12-01'),
    warrantyExpiry: new Date('2027-01-01'),
    ...over,
  }
}

function garment(over: Partial<Garment> = {}): Garment {
  return {
    id: 'g1111111-1111-4111-8111-111111111111',
    labAssetId: ASSET_ID,
    title: 'Navy jacket, size M',
    garmentType: 'Jacket',
    brand: 'Acme',
    sizeLabel: 'M',
    sizeSystem: 'EU',
    material: '80% cotton',
    primaryColor: 'navy',
    secondaryColor: null,
    pattern: null,
    conditionNotes: null,
    flaws: [],
    measurements: {},
    sku: null,
    listingStatus: 'draft',
    purchaseCost: null,
    sellingPrice: null,
    currency: null,
    notes: null,
    scanSessionId: null,
    primaryPhotoScanId: null,
    aiConfidence: 0.81,
    ...over,
  }
}

function mount() {
  return render(
    <MemoryRouter initialEntries={[`/lab-assets/${ASSET_ID}`]}>
      <Routes>
        <Route path="/lab-assets/:assetId" element={<LabAssetDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getScanPhotoUrl.mockResolvedValue(null)
})

describe('a clothing asset', () => {
  beforeEach(() => {
    getLabAsset.mockResolvedValue(asset())
    getGarmentForAsset.mockResolvedValue(garment())
  })

  it('renders the garment panel', async () => {
    mount()
    expect(await screen.findByTestId('garment-details')).toBeDefined()
  })

  it('shows the clothing fields', async () => {
    mount()
    await screen.findByTestId('garment-details')
    expect(screen.getByText('Jacket')).toBeDefined()
    expect(screen.getByText('M')).toBeDefined()
    expect(screen.getByText('80% cotton')).toBeDefined()
    expect(screen.getByText('navy')).toBeDefined()
  })

  it('hides the equipment identification rows', async () => {
    mount()
    await screen.findByTestId('garment-details')
    // Serial / manufacturer / model mean nothing for a garment.
    expect(screen.queryByText('Serial')).toBeNull()
    expect(screen.queryByText('Manufacturer')).toBeNull()
    expect(screen.queryByText('Model')).toBeNull()
  })

  it('hides maintenance and warranty', async () => {
    mount()
    await screen.findByTestId('garment-details')
    expect(screen.queryByText('Last maintenance')).toBeNull()
    expect(screen.queryByText('Next maintenance')).toBeNull()
    expect(screen.queryByText('Warranty')).toBeNull()
  })

  it('hides the Missing Components section', async () => {
    mount()
    await screen.findByTestId('garment-details')
    expect(screen.queryByText('Missing Components')).toBeNull()
  })

  it('still shows the shared base fields', async () => {
    mount()
    await screen.findByTestId('garment-details')
    // Tag, status and condition belong to the asset and stay visible.
    expect(screen.getByText('LA-000000000001')).toBeDefined()
    expect(screen.getByText('Storage location')).toBeDefined()
    expect(screen.getByText('good')).toBeDefined()
  })

  it('marks an unrecorded field rather than showing a blank', async () => {
    mount()
    await screen.findByTestId('garment-details')
    // secondaryColor / pattern / sku are null on the fixture.
    expect(screen.getAllByText('Not recorded').length).toBeGreaterThan(0)
  })

  it('offers an edit control to a user who may write', async () => {
    mount()
    await screen.findByTestId('garment-details')
    expect(screen.getByRole('button', { name: /edit/i })).toBeDefined()
  })
})

describe('a non-clothing asset is unchanged', () => {
  beforeEach(() => {
    getLabAsset.mockResolvedValue(asset({ name: 'Centrifuge' }))
    // No garment row: this asset is not clothing.
    getGarmentForAsset.mockResolvedValue(null)
  })

  it('renders no garment panel', async () => {
    mount()
    await waitFor(() => expect(screen.getByText('Centrifuge')).toBeDefined())
    expect(screen.queryByTestId('garment-details')).toBeNull()
  })

  it('keeps the equipment identification rows', async () => {
    mount()
    await waitFor(() => expect(screen.getByText('Centrifuge')).toBeDefined())
    expect(screen.getByText('Serial')).toBeDefined()
    expect(screen.getByText('Manufacturer')).toBeDefined()
    expect(screen.getByText('Model')).toBeDefined()
    expect(screen.getByText('87XJ-3401K')).toBeDefined()
  })

  it('keeps maintenance and warranty', async () => {
    mount()
    await waitFor(() => expect(screen.getByText('Centrifuge')).toBeDefined())
    expect(screen.getByText('Last maintenance')).toBeDefined()
    expect(screen.getByText('Next maintenance')).toBeDefined()
    expect(screen.getByText('Warranty')).toBeDefined()
  })

  it('keeps the Missing Components section', async () => {
    mount()
    await waitFor(() => expect(screen.getByText('Centrifuge')).toBeDefined())
    expect(screen.getByText('Missing Components')).toBeDefined()
  })

  it('labels the location as Location, not Storage location', async () => {
    mount()
    await waitFor(() => expect(screen.getByText('Centrifuge')).toBeDefined())
    expect(screen.getByText('Location')).toBeDefined()
    expect(screen.queryByText('Storage location')).toBeNull()
  })
})

describe('when the garment lookup fails', () => {
  it('renders the asset as equipment rather than crashing the page', async () => {
    // Failing open to "equipment" is the safe direction: it shows more, not
    // less, and never hides a section the viewer expects.
    getLabAsset.mockResolvedValue(asset({ name: 'Centrifuge' }))
    getGarmentForAsset.mockRejectedValue(new Error('network'))
    mount()
    await waitFor(() => expect(screen.getByText('Centrifuge')).toBeDefined())
    expect(screen.queryByTestId('garment-details')).toBeNull()
    expect(screen.getByText('Serial')).toBeDefined()
  })
})
