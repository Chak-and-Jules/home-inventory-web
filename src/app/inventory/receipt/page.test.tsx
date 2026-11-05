import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ReceiptIntakePage from './page'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { liter, ml } from '@/test/quantityFixtures'

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    session: { user: { id: 'user1', email: 'test@example.com' } },
  }),
}))

vi.mock('@/components/HomeProvider', () => ({
  useHome: () => ({
    currentHomeId: 'home1',
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'receipt.bulkImport') return `Import ${options?.count || 0} Items to Inventory`
      if (key === 'receipt.successMessage') return `Successfully added ${options?.count || 0} items to inventory!`
      return key
    },
  }),
}))

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('ReceiptIntakePage', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    vi.mocked(api.get).mockImplementation((url) => {
      if (url === '/item-definitions') {
        return Promise.resolve({
          data: [
            { ID: 'def1', Name: 'Whole Milk 1L', SizeUnit: { Name: 'L' }, IsExpirable: true },
            { ID: 'def2', Name: 'Whole Wheat Bread', SizeUnit: { Name: 'pc' }, IsExpirable: false },
          ],
        }) as unknown as ReturnType<typeof api.get>
      }
      if (url === '/categories') {
        return Promise.resolve({ data: [{ ID: 'cat1', Name: 'Dairy' }] }) as unknown as ReturnType<typeof api.get>
      }
      if (url === '/size-units') {
        return Promise.resolve({ data: [{ ID: 'su1', Name: 'piece' }] }) as unknown as ReturnType<typeof api.get>
      }
      return Promise.resolve({ data: [] }) as unknown as ReturnType<typeof api.get>
    })
  })

  it('renders upload box initially', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ReceiptIntakePage />
      </QueryClientProvider>
    )

    expect(screen.getByText('receipt.uploadTitle')).toBeInTheDocument()
    expect(screen.getByText('receipt.selectFile')).toBeInTheDocument()
  })

  it('handles receipt upload and displays extracted line items with fuzzy matches', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        job_id: 'job-123',
        status: 'completed',
        line_items: [
          { id: '1', name: 'Whole Milk 1L', quantity: 2, price: 3.49 },
          { id: '2', name: 'Whole Wheat Bread', quantity: 1, price: 2.50 },
        ],
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ReceiptIntakePage />
      </QueryClientProvider>
    )

    const file = new File(['fake-receipt-content'], 'receipt.png', { type: 'image/png' })
    const fileInput = screen.getByLabelText('receipt.selectFile') as HTMLInputElement

    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(screen.getByText(/receipt\.png/i)).toBeInTheDocument()

    const scanButton = screen.getByRole('button', { name: 'receipt.scan' })
    fireEvent.click(scanButton)

    await waitFor(() => {
      expect(screen.getByText('receipt.extractedItems')).toBeInTheDocument()
    })

    // Expect fuzzy matched item definition for 'Whole Milk 1L'
    expect(screen.getByDisplayValue('Whole Milk 1L')).toBeInTheDocument()
  })

  it('allows bulk importing items into inventory', async () => {
    vi.mocked(api.post).mockImplementation((url) => {
      if (url === '/receipts/scan') {
        return Promise.resolve({
          data: {
            job_id: 'job-123',
            status: 'completed',
            line_items: [
              { id: '1', name: 'Whole Milk 1L', quantity: 2, price: 3.49 },
              { id: '2', name: 'Whole Wheat Bread', quantity: 1, price: 2.50 },
            ],
          },
        })
      }
      return Promise.resolve({ data: { message: 'Success' } })
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ReceiptIntakePage />
      </QueryClientProvider>
    )

    // Wait for item definitions query to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/item-definitions', expect.anything())
    })

    const file = new File(['fake-receipt-content'], 'receipt.png', { type: 'image/png' })
    const fileInput = screen.getByLabelText('receipt.selectFile') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })

    const scanButton = screen.getByRole('button', { name: 'receipt.scan' })
    fireEvent.click(scanButton)

    await waitFor(() => {
      expect(screen.getByText('receipt.extractedItems')).toBeInTheDocument()
    })

    const importButton = await screen.findByRole('button', { name: /Import 2 Items to Inventory/i })
    expect(importButton).not.toBeDisabled()
    fireEvent.click(importButton)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/receipts/jobs/job-123/confirm',
        expect.objectContaining({ items: expect.arrayContaining([expect.objectContaining({ item_definition_id: 'def1' })]) }),
        expect.anything()
      )
    })
  })

  it('requires confirmation of the amount unit and submits the job confirmation contract', async () => {
    vi.mocked(api.get).mockImplementation((url) => Promise.resolve({ data:
      url === '/item-definitions' ? [{ ID: 'def1', Name: 'Milk', SizeUnitID: 'l', SizeUnit: liter }] :
      url === '/size-units' ? [liter, ml] :
      url === '/receipts/jobs/job-modern' ? { status: 'completed', items: [{ id: 'line', raw_name: 'Milk', quantity: 2 }] } : []
    }) as ReturnType<typeof api.get>)
    vi.mocked(api.post).mockImplementation((url) => Promise.resolve({ data: url === '/receipts/scan' ? { job_id: 'job-modern', status: 'processing' } : {} }))
    render(<QueryClientProvider client={queryClient}><ReceiptIntakePage /></QueryClientProvider>)
    fireEvent.change(screen.getByLabelText('receipt.selectFile'), { target: { files: [new File(['receipt'], 'receipt.png', { type: 'image/png' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'receipt.scan' }))
    await screen.findByText('receipt.extractedItems', {}, { timeout: 3000 })
    expect(screen.getByRole('button', { name: /Import 0 Items/ })).toBeDisabled()
    const unitSelect = screen.getByLabelText('ui.receiptUnitFor')
    fireEvent.change(unitSelect, { target: { value: 'l' } })
    fireEvent.change(unitSelect, { target: { value: 'ml' } })
    expect(screen.getByLabelText('ui.receiptQuantityFor')).toHaveValue(2000)
    fireEvent.click(screen.getByRole('button', { name: /Import 1 Items/ }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/receipts/jobs/job-modern/confirm', {
      items: [{ raw_name: 'Milk', item_definition_id: 'def1', quantity: 2000, quantity_unit_id: 'ml', price: undefined }],
    }, expect.anything()))
    expect(vi.mocked(api.post).mock.calls.some(([url]) => url === '/inventory')).toBe(false)
  })
})
