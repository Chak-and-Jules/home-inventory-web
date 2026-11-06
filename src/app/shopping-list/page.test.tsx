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
import { kg } from '@/test/quantityFixtures'

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

  it('shows converted consumption and submits a shortage with its base unit', async () => {
    const user = userEvent.setup()
    mockApi.onGet('/inventory/insights/restock').reply(200, [{
      item_definition: { ID: 'rice', Name: 'Rice', SizeUnitID: 'kg', SizeUnit: kg, TargetQuantity: 1500 },
      current_stock: 800, average_daily_consumption: 100, predicted_depletion_date: '2030-01-01', days_left: 3,
    }])
    mockApi.onPost('/shopping-list').reply(201, {})
    renderWithProvider(<ShoppingListPage />)
    await screen.findByText('You usually use 0.1 kg per day, and you have 0.8 left.')
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(mockApi.history.post).toHaveLength(1))
    expect(JSON.parse(mockApi.history.post[0].data)).toMatchObject({ quantity: 700, quantity_unit_id: 'g', item_definition_id: 'rice' })
  })

  it('retains a valid zero for an unlinked shopping count', async () => {
    const user = userEvent.setup()
    mockApi.onGet('/inventory/insights/restock').reply(200, [])
    mockApi.onPost('/shopping-list').reply(201, {})
    renderWithProvider(<ShoppingListPage />)
    await user.type(await screen.findByLabelText('shoppingList.itemName'), 'Paper')
    await user.clear(screen.getByLabelText('shoppingList.quantity'))
    await user.type(screen.getByLabelText('shoppingList.quantity'), '0')
    await user.click(screen.getByRole('button', { name: 'shoppingList.add' }))
    await waitFor(() => expect(mockApi.history.post).toHaveLength(1))
    expect(JSON.parse(mockApi.history.post[0].data)).toEqual({ name: 'Paper', quantity: 0 })
  })

  it('rejects overly precise unlinked counts before sending a rounded number', async () => {
    const user = userEvent.setup()
    mockApi.onGet('/inventory/insights/restock').reply(200, [])
    mockApi.onPost('/shopping-list').reply(201, {})
    renderWithProvider(<ShoppingListPage />)
    await user.type(await screen.findByLabelText('shoppingList.itemName'), 'Paper')
    await user.clear(screen.getByLabelText('shoppingList.quantity'))
    await user.type(screen.getByLabelText('shoppingList.quantity'), '0.10000000000000000001')
    await user.click(screen.getByRole('button', { name: 'shoppingList.add' }))
    expect(mockApi.history.post).toHaveLength(0)
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid amount')
  })

  it('submits a threshold shortage when the predictive target is already met', async () => {
    const user = userEvent.setup()
    mockApi.onGet('/inventory/insights/restock').reply(200, [{
      item_definition: { ID: 'rice', Name: 'Rice', SizeUnitID: 'kg', SizeUnit: kg, TargetQuantity: 1000, LowStockThreshold: 5000 },
      current_stock: 1000, average_daily_consumption: 100, predicted_depletion_date: '2030-01-01', days_left: 3,
    }])
    mockApi.onPost('/shopping-list').reply(201, {})
    renderWithProvider(<ShoppingListPage />)
    await user.click(await screen.findByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(mockApi.history.post).toHaveLength(1))
    expect(JSON.parse(mockApi.history.post[0].data)).toMatchObject({ quantity: 4000, quantity_unit_id: 'g', item_definition_id: 'rice' })
  })

  it('displays predictive suggestions on shopping list page', async () => {
    const mockInsight = {
      item_definition: {
        ID: 'item-1',
        Name: 'Dishwasher Pods',
        IsExpirable: false,
        ImageURL: '',
        TargetQuantity: 10,
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
      expect(screen.getByText(/You usually use/)).toBeInTheDocument()
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
        TargetQuantity: 5,
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
        TargetQuantity: 10,
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
