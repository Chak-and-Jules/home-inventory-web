import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Homes from './page'
import { api } from '@/lib/api'

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    session: { access_token: 'test-token' },
  }),
}))

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

function renderHomes() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <Homes />
    </QueryClientProvider>
  )
}

describe('Homes page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    vi.mocked(api.post).mockResolvedValue({ data: { ID: 'home-1', Name: 'New Home' } })
  })

  it('posts to /homes when creating a home', async () => {
    const user = userEvent.setup()

    renderHomes()

    const nameInput = await screen.findByPlaceholderText(/vacation house/i)
    await user.type(nameInput, '  New Home  ')
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/homes', { name: 'New Home' })
    })
  })
})
