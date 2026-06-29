import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomeUsers from './page'
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
)

describe('HomeUsers Page', () => {
  const homeId = 'test-home-id'

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.reset()
    queryClient.clear()

    vi.mocked(useAuth).mockReturnValue({
      session: { user: { id: 'user-1' } },
    } as any)

    vi.mocked(useHome).mockReturnValue({
      currentHomeId: homeId,
    } as any)
  })

  it('renders users list', async () => {
    const users = [
      {
        UserID: 'user-1',
        HomeID: homeId,
        Role: 'owner',
        User: { id: 'user-1', email: 'owner@example.com' },
      },
      {
        UserID: 'user-2',
        HomeID: homeId,
        Role: 'viewer',
        User: { id: 'user-2', email: 'viewer@example.com' },
      },
    ]

    mockApi.onGet(`/homes/${homeId}/users`).reply(200, users)

    render(<HomeUsers />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('owner@example.com')).toBeInTheDocument()
      expect(screen.getByText('viewer@example.com')).toBeInTheDocument()
    })
  })

  it('adds a new user', async () => {
    const user = userEvent.setup()
    mockApi.onGet(`/homes/${homeId}/users`).reply(200, [])
    mockApi.onPost(`/homes/${homeId}/users`).reply(201)

    render(<HomeUsers />, { wrapper })

    await waitFor(() => {
      expect(screen.queryByText('Loading users...')).not.toBeInTheDocument()
    })

    const emailInput = screen.getByLabelText('User Email')
    const addButton = screen.getByRole('button', { name: 'Add' })

    await user.type(emailInput, 'new@example.com')
    await user.click(addButton)

    await waitFor(() => {
      expect(mockApi.history.post.length).toBe(1)
      expect(JSON.parse(mockApi.history.post[0].data)).toEqual({
        email: 'new@example.com',
        role: 'viewer',
      })
    })
  })

  it('updates user role', async () => {
    const user = userEvent.setup()
    const users = [
      {
        UserID: 'user-2',
        HomeID: homeId,
        Role: 'viewer',
        User: { id: 'user-2', email: 'viewer@example.com' },
      },
    ]

    mockApi.onGet(`/homes/${homeId}/users`).reply(200, users)
    mockApi.onPut(`/homes/${homeId}/users/user-2/role`).reply(200)

    render(<HomeUsers />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('viewer@example.com')).toBeInTheDocument()
    })

    const roleSelect = screen.getByLabelText('Role:')
    await user.selectOptions(roleSelect, 'editor')

    await waitFor(() => {
      expect(mockApi.history.put.length).toBe(1)
      expect(JSON.parse(mockApi.history.put[0].data)).toEqual({
        role: 'editor',
      })
    })
  })

  it('removes a user', async () => {
    const user = userEvent.setup()
    const users = [
      {
        UserID: 'user-2',
        HomeID: homeId,
        Role: 'viewer',
        User: { id: 'user-2', email: 'viewer@example.com' },
      },
    ]

    mockApi.onGet(`/homes/${homeId}/users`).reply(200, users)
    mockApi.onDelete(`/homes/${homeId}/users/user-2`).reply(200)

    vi.stubGlobal('confirm', vi.fn(() => true))

    render(<HomeUsers />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('viewer@example.com')).toBeInTheDocument()
    })

    const removeButton = screen.getByLabelText('Remove user viewer@example.com')
    await user.click(removeButton)

    await waitFor(() => {
      expect(mockApi.history.delete.length).toBe(1)
    })
  })
})
