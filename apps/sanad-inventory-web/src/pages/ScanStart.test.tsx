import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ClothingExtraction } from '../lib/clothing'

// Drives the real review step against mocked scan queries. What is under test
// is that the reviewer can SEE and CORRECT every field — including the ones
// the AI could not read — and that the corrections are what get saved.

const startScanSession = vi.fn()
const uploadScanPhoto = vi.fn()
const processScanPhoto = vi.fn()
const completeScanSession = vi.fn()

vi.mock('../lib/queries/scans', async () => {
  const actual = await vi.importActual<typeof import('../lib/queries/scans')>(
    '../lib/queries/scans',
  )
  return {
    ...actual,
    startScanSession: (...a: unknown[]) => startScanSession(...a),
    uploadScanPhoto: (...a: unknown[]) => uploadScanPhoto(...a),
    processScanPhoto: (...a: unknown[]) => processScanPhoto(...a),
    completeScanSession: (...a: unknown[]) => completeScanSession(...a),
  }
})
vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {},
  currentUserId: () => Promise.resolve('user-1'),
}))

const ScanStart = (await import('./ScanStart')).default

const SESSION = '5ada0000-0000-4000-8000-000000000041'

/** Brand and material deliberately unreadable — the case that matters. */
function clothing(over: Partial<ClothingExtraction> = {}): ClothingExtraction {
  const c = (value: string | null, confidence = 0.9) => ({ value, confidence })
  return {
    garment_type: c('Jacket', 0.93),
    brand: { value: null, confidence: 0.1, evidence: null },
    main_color: c('navy', 0.88),
    secondary_color: c(null, 0.2),
    pattern: c(null, 0.2),
    size_label: c('M', 0.81),
    size_system: c(null, 0.1),
    material_composition: c(null, 0.1),
    label_text: c(null, 0.1),
    style_code: c(null, 0.1),
    suggested_title: c('Navy jacket, size M', 0.86),
    visible_condition: 'good',
    flaws: [],
    style_keywords: [],
    warnings: [],
    needs_human_review: ['brand'],
    ...over,
  }
}

function analysis(over: Record<string, unknown> = {}) {
  return {
    simulated: false,
    confidence: 0.86,
    detected_condition: 'good',
    fields: [
      { label: 'Type', value: 'Jacket', confidence: 0.93 },
      { label: 'Main color', value: 'navy', confidence: 0.88 },
      { label: 'Size', value: 'M', confidence: 0.81 },
    ],
    suggested_lab_asset: { name: 'Navy jacket, size M' },
    clothing: clothing(),
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom implements neither of these. The page uses them for the local
  // preview thumbnail, which is not what these tests are about.
  URL.createObjectURL = vi.fn(() => 'blob:preview') as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
  startScanSession.mockResolvedValue({ id: SESSION })
  uploadScanPhoto.mockResolvedValue({
    photoScanId: 'photo-1',
    imagePath: `org/${SESSION}/p.jpg`,
  })
  processScanPhoto.mockResolvedValue(analysis())
  completeScanSession.mockResolvedValue({ labAssetId: 'asset-1' })
})

/** Walks type -> capture -> review, leaving the review step rendered. */
async function reachReview() {
  render(
    <MemoryRouter>
      <ScanStart />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  await screen.findByText(/capture or upload/i)

  const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'g.jpg', {
    type: 'image/jpeg',
  })
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })

  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  )
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  const form = await screen.findByTestId('garment-review-form')
  // The form appears as soon as the analysis resolves, but `busy` clears one
  // tick later, so the save button still reads "Saving…" at that moment.
  // Waiting for its real label keeps the tests off that race.
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /create asset/i })).toBeDefined(),
  )
  return form
}

const box = (label: string) =>
  screen.getByLabelText(label) as HTMLInputElement

describe('the review step is editable', () => {
  it('renders an editable form for a real analysis', async () => {
    await reachReview()
    expect(screen.getByTestId('garment-review-form')).toBeDefined()
  })

  it('pre-fills the values the AI read', async () => {
    await reachReview()
    expect(box('Type').value).toBe('Jacket')
    expect(box('Main color').value).toBe('navy')
    expect(box('Size').value).toBe('M')
    expect(box('Item name').value).toBe('Navy jacket, size M')
  })

  it('shows an unreadable field as an EMPTY, editable box', async () => {
    await reachReview()
    // This is the case `extracted.fields` cannot express: it drops the key
    // entirely, so there would be nothing to type into.
    const brand = box('Brand')
    expect(brand.value).toBe('')
    expect(brand.disabled).toBe(false)
    expect(box('Material').value).toBe('')
  })

  it('does not invent a placeholder value for an unread field', async () => {
    await reachReview()
    for (const label of ['Brand', 'Material', 'Pattern']) {
      expect(box(label).value).toBe('')
    }
  })

  it('keeps the warning that AI suggestions must be checked', async () => {
    await reachReview()
    const notice = screen.getByTestId('ai-review-notice')
    expect(notice.textContent).toMatch(/AI suggestions/i)
    expect(notice.textContent).toMatch(/can be wrong/i)
  })

  it('still shows confidence for the fields that were read', async () => {
    await reachReview()
    expect(screen.getByText('93%')).toBeDefined()
    expect(screen.getByText('81%')).toBeDefined()
  })

  it('shows no confidence score for a field that was not read', async () => {
    await reachReview()
    // A 10% score next to a blank box would imply it read something.
    expect(screen.queryByText('10%')).toBeNull()
    expect(screen.getAllByText(/needs review|not read/i).length).toBeGreaterThan(0)
  })

  it('accepts a correction', async () => {
    await reachReview()
    fireEvent.change(box('Brand'), { target: { value: 'Levi Strauss' } })
    expect(box('Brand').value).toBe('Levi Strauss')
  })
})

describe('saving stores the reviewed values', () => {
  it('sends the corrected value, not the AI original', async () => {
    await reachReview()
    fireEvent.change(box('Type'), { target: { value: 'Blazer' } })
    fireEvent.change(box('Brand'), { target: { value: 'Levi Strauss' } })
    fireEvent.click(screen.getByRole('button', { name: /create asset/i }))

    await waitFor(() => expect(completeScanSession).toHaveBeenCalled())
    const arg = completeScanSession.mock.calls[0][0] as {
      garment: Record<string, string>
    }
    expect(arg.garment.garment_type).toBe('Blazer')
    expect(arg.garment.brand).toBe('Levi Strauss')
  })

  it('sends a field the reviewer left blank as an empty string', async () => {
    await reachReview()
    fireEvent.click(screen.getByRole('button', { name: /create asset/i }))
    await waitFor(() => expect(completeScanSession).toHaveBeenCalled())
    const arg = completeScanSession.mock.calls[0][0] as {
      garment: Record<string, string>
    }
    // Stored as NULL by create_garment_asset — never a fabricated value.
    expect(arg.garment.brand).toBe('')
    expect(arg.garment.material).toBe('')
  })

  it('passes the photo reference so the garment keeps its image', async () => {
    await reachReview()
    fireEvent.click(screen.getByRole('button', { name: /create asset/i }))
    await waitFor(() => expect(completeScanSession).toHaveBeenCalled())
    const arg = completeScanSession.mock.calls[0][0] as { photoScanId: string }
    expect(arg.photoScanId).toBe('photo-1')
  })

  it('sends the reviewed condition', async () => {
    await reachReview()
    fireEvent.change(screen.getByLabelText('Condition'), {
      target: { value: 'fair' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create asset/i }))
    await waitFor(() => expect(completeScanSession).toHaveBeenCalled())
    const arg = completeScanSession.mock.calls[0][0] as { condition: string }
    expect(arg.condition).toBe('fair')
  })

  it('surfaces a failed save and does not advance to the done step', async () => {
    completeScanSession.mockRejectedValue(new Error('insert failed'))
    await reachReview()
    fireEvent.click(screen.getByRole('button', { name: /create asset/i }))
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toMatch(/insert failed/i)
    // Still on review: no asset was created, so nothing is claimed as saved.
    expect(screen.getByTestId('garment-review-form')).toBeDefined()
    expect(screen.queryByText(/asset created/i)).toBeNull()
  })
})

describe('a response with no clothing payload', () => {
  it('falls back to the read-only summary rather than an empty form', async () => {
    processScanPhoto.mockResolvedValue(analysis({ clothing: null }))
    render(
      <MemoryRouter>
        <ScanStart />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText(/capture or upload/i)
    const file = new File([new Uint8Array([0xff])], 'g.jpg', { type: 'image/jpeg' })
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    })
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    )
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => expect(screen.getByText('Jacket')).toBeDefined())
    expect(screen.queryByTestId('garment-review-form')).toBeNull()
  })
})
