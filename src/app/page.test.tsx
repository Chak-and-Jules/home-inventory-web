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
