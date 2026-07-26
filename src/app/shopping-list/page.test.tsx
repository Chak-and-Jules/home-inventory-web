import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ShoppingListPage from './page'
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

describe('Shopping List Page - Predictive Restock Suggestions', () => {
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

    mockApi.onGet('/homes').reply(200, [
      {
        HomeID: homeId,
        Role: 'owner',
        Home: { ID: homeId, Name: 'Test Household' },
      },
    ])
    mockApi.onGet('/shopping-list').reply(200, [])
  })

  it('displays predictive suggestions on shopping list page', async () => {
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
      reason: 'Dishwasher Pods are low.',
    }

    mockApi.onGet('/inventory/insights/restock').reply(200, [mockInsight])

    renderWithProvider(<ShoppingListPage />)

    await waitFor(() => {
      expect(screen.getByText('Predictive Restock Suggestions')).toBeInTheDocument()
      expect(screen.getByText('Dishwasher Pods')).toBeInTheDocument()
      expect(screen.getByText('Dishwasher Pods are low.')).toBeInTheDocument()
    })
  })

  it('allows accepting suggestion and dismisses from section', async () => {
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

    renderWithProvider(<ShoppingListPage />)

    await waitFor(() => {
      expect(screen.getByText('Predictive Restock Suggestions')).toBeInTheDocument()
    })

    const acceptBtn = screen.getByRole('button', { name: 'Accept' })
    await user.click(acceptBtn)

    await waitFor(() => {
      expect(mockApi.history.post.length).toBe(1)
      const postedData = JSON.parse(mockApi.history.post[0].data)
      expect(postedData).toEqual({
        item_definition_id: 'item-2',
        name: 'Milk',
        quantity: 4,
      })
    })

    // Verify Milk is removed from the suggestions list
    await waitFor(() => {
      expect(screen.queryByText('Milk')).not.toBeInTheDocument()
    })
  })

  it('allows dismissing suggestion on shopping list page', async () => {
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
      reason: 'Dishwasher Pods are low.',
    }

    mockApi.onGet('/inventory/insights/restock').reply(200, [mockInsight])

    renderWithProvider(<ShoppingListPage />)

    await waitFor(() => {
      expect(screen.getByText('Predictive Restock Suggestions')).toBeInTheDocument()
    })

    const dismissBtn = screen.getByRole('button', { name: 'Dismiss' })
    await user.click(dismissBtn)

    await waitFor(() => {
      expect(screen.queryByText('Dishwasher Pods')).not.toBeInTheDocument()
    })
  })
})
