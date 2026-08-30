import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Dashboard from './page'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/components/AuthProvider'
import { useHome } from '@/components/HomeProvider'
import { api } from '@/lib/api'
import MockAdapter from 'axios-mock-adapter'

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/components/HomeProvider', () => ({
  useHome: vi.fn(),
}))

vi.mock('@/hooks/useSignedUrls', () => ({
  useSignedUrls: vi.fn(() => ({ data: {} })),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}))

const mockApi = new MockAdapter(api)

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

const renderWithProvider = (ui: React.ReactNode) => {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe('Dashboard Page - Predictive Restock Insights', () => {
  const homeId = 'test-home-id'

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.reset()
    localStorage.clear()

    vi.mocked(useAuth).mockReturnValue({
      session: { user: { id: 'user-1' } },
    } as any)

    vi.mocked(useHome).mockReturnValue({
      currentHomeId: homeId,
    } as any)

    // Standard setups
    mockApi.onGet('/homes').reply(200, [
      {
        HomeID: homeId,
        Role: 'owner',
        Home: { ID: homeId, Name: 'Test Household' },
      },
    ])
    mockApi.onGet('/categories').reply(200, [])
    mockApi.onGet('/inventory').reply(200, [])
    mockApi.onGet('/inventory/almost-finished').reply(200, [])
    mockApi.onGet('/inventory/expiring').reply(200, [])
  })

  it('renders smart insights tab trigger', async () => {
    mockApi.onGet('/inventory/insights/restock').reply(200, [])

    renderWithProvider(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Smart Insights')).toBeInTheDocument()
    })
  })

  it('displays mock insights and allows dismissal', async () => {
    const user = userEvent.setup()
    const mockInsight = {
      item_definition: {
        ID: 'item-1',
        Name: 'Dishwasher Pods',
        IsExpirable: false,
        ImageURL: '',
        target_quantity: 10,
      },
      current_stock: 2,
      average_daily_consumption: 0.5,
      predicted_depletion_date: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString(),
      days_left: 4,
      reason: 'You are running low on Dishwasher Pods based on your consumption rate.',
    }

    mockApi.onGet('/inventory/insights/restock').reply(200, [mockInsight])

    renderWithProvider(<Dashboard />)

    // Click the Smart Insights tab
    await waitFor(() => {
      expect(screen.getByText('Smart Insights')).toBeInTheDocument()
    })

    const smartTab = screen.getByRole('tab', { name: /Smart Insights/i })
    await user.click(smartTab)

    // Verify item is displayed with correct reason
    await waitFor(() => {
      expect(screen.getByText('Dishwasher Pods')).toBeInTheDocument()
      expect(screen.getByText('You are running low on Dishwasher Pods based on your consumption rate.')).toBeInTheDocument()
    })

    // Click Dismiss
    const dismissBtn = screen.getByRole('button', { name: 'Dismiss' })
    await user.click(dismissBtn)

    // Verify it is hidden
    await waitFor(() => {
      expect(screen.queryByText('Dishwasher Pods')).not.toBeInTheDocument()
    })
  })

  it('allows accepting a suggestion and adds it to the shopping list', async () => {
    const user = userEvent.setup()
    const mockInsight = {
      item_definition: {
        ID: 'item-2',
        Name: 'Milk',
        IsExpirable: true,
        ImageURL: '',
        target_quantity: 5,
      },
      current_stock: 1,
      average_daily_consumption: 1.0,
      predicted_depletion_date: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
      days_left: 2,
      reason: '',
    }

    mockApi.onGet('/inventory/insights/restock').reply(200, [mockInsight])
    mockApi.onPost('/shopping-list').reply(201)

    renderWithProvider(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Smart Insights')).toBeInTheDocument()
    })

    const smartTab = screen.getByRole('tab', { name: /Smart Insights/i })
    await user.click(smartTab)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })

    // Click Accept
    const acceptBtn = screen.getByRole('button', { name: 'Accept' })
    await user.click(acceptBtn)

    // Verify API is called with correct params (target_quantity 5 - current_stock 1 = quantity 4)
    await waitFor(() => {
      expect(mockApi.history.post.length).toBe(1)
      const postedData = JSON.parse(mockApi.history.post[0].data)
      expect(postedData).toEqual({
        item_definition_id: 'item-2',
        name: 'Milk',
        quantity: 4,
      })
    })

    // Verify it is hidden after acceptance (dismissed)
    await waitFor(() => {
      expect(screen.queryByText('Milk')).not.toBeInTheDocument()
    })
  })
})

describe('Dashboard Page - Inventory Filtering and Quick Quantity Edit', () => {
  const homeId = 'test-home-id'

  const mockCategories = [
    { ID: 'cat-top-1', Name: 'Kitchen', ParentID: null },
    { ID: 'cat-child-1', Name: 'Spices', ParentID: 'cat-top-1' },
    { ID: 'cat-top-2', Name: 'Cleaning', ParentID: null },
  ]

  const mockInventory = [
    {
      ID: 'inv-1',
      Quantity: 5,
      ExpirationDate: '2025-12-31T00:00:00Z',
      ItemDefinition: {
        ID: 'def-1',
        Name: 'Olive Oil',
        CategoryID: 'cat-child-1',
        Category: { ID: 'cat-child-1', Name: 'Spices', ParentID: 'cat-top-1' },
        SizeUnit: { ID: 'unit-1', Name: 'Liters' },
      },
    },
    {
      ID: 'inv-2',
      Quantity: 2,
      ExpirationDate: null,
      ItemDefinition: {
        ID: 'def-2',
        Name: 'Bleach',
        CategoryID: 'cat-top-2',
        Category: { ID: 'cat-top-2', Name: 'Cleaning', ParentID: null },
        SizeUnit: { ID: 'unit-2', Name: 'Bottles' },
      },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.reset()
    localStorage.clear()

    vi.mocked(useAuth).mockReturnValue({
      session: { user: { id: 'user-1' } },
    } as any)

    vi.mocked(useHome).mockReturnValue({
      currentHomeId: homeId,
    } as any)

    mockApi.onGet('/homes').reply(200, [
      {
        HomeID: homeId,
        Role: 'owner',
        Home: { ID: homeId, Name: 'Test Household' },
      },
    ])
    mockApi.onGet('/categories').reply(200, mockCategories)
    mockApi.onGet('/inventory/almost-finished').reply(200, [])
    mockApi.onGet('/inventory/expiring').reply(200, [])
    mockApi.onGet('/inventory/insights/restock').reply(200, [])
    mockApi.onGet(new RegExp('^/inventory(\\?.*)?$')).reply(200, mockInventory)
  })

  it('filters inventory items by search query as you type', async () => {
    const user = userEvent.setup()
    renderWithProvider(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Olive Oil')).toBeInTheDocument()
      expect(screen.getByText('Bleach')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search by name...')
    await user.type(searchInput, 'Olive')

    await waitFor(() => {
      expect(screen.getByText('Olive Oil')).toBeInTheDocument()
      expect(screen.queryByText('Bleach')).not.toBeInTheDocument()
    })
  })

  it('displays category in Top > Child format and filters by selected category option', async () => {
    const user = userEvent.setup()
    renderWithProvider(<Dashboard />)

    await waitFor(() => {
      expect(screen.getAllByText('Kitchen > Spices').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Cleaning').length).toBeGreaterThan(0)
    })

    const categorySelect = screen.getByLabelText('Filter by Category')
    await user.selectOptions(categorySelect, 'cat-child-1')

    await waitFor(() => {
      expect(screen.getByText('Olive Oil')).toBeInTheDocument()
      expect(screen.queryByText('Bleach')).not.toBeInTheDocument()
    })
  })

  it('allows quick inline quantity editing and calls API update', async () => {
    const user = userEvent.setup()
    mockApi.onPut('/inventory/inv-1').reply(200, { message: 'Updated' })

    renderWithProvider(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Olive Oil')).toBeInTheDocument()
    })

    const qtyButton = screen.getByLabelText('Edit quantity for Olive Oil, current quantity 5')
    await user.click(qtyButton)

    const qtyInput = screen.getByDisplayValue('5')
    await user.clear(qtyInput)
    await user.type(qtyInput, '8')

    const saveButton = screen.getByLabelText('Save quantity')
    await user.click(saveButton)

    await waitFor(() => {
      expect(mockApi.history.put.length).toBe(1)
      const data = JSON.parse(mockApi.history.put[0].data)
      expect(data.quantity).toBe(8)
    })
  })
})
