/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeProvider, useHome } from './HomeProvider'
import { useAuth } from './AuthProvider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('./AuthProvider', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

function TestComponent() {
  const { currentHomeId, setCurrentHomeId } = useHome()

  return (
    <div>
      <p data-testid="current-home-id">{currentHomeId || 'none'}</p>
      <button onClick={() => setCurrentHomeId('test-home-id')}>
        Set Home ID
      </button>
    </div>
  )
}

describe('HomeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Storage.prototype, 'setItem')
    vi.spyOn(Storage.prototype, 'removeItem')
    vi.mocked(useAuth).mockReturnValue({ session: null } as any)
  })

  it('clears image caches from the previous home', async () => {
    const client = new QueryClient();
    client.setQueryData(['signedUrls', 'user', 'previous-home'], ['private-url']);
    render(<QueryClientProvider client={client}><HomeProvider><TestComponent /></HomeProvider></QueryClientProvider>);
    await waitFor(() => expect(client.getQueryCache().findAll({ queryKey: ['signedUrls'] })).toHaveLength(0));
  })

  it('sets homeId in localStorage when setCurrentHomeId is called', async () => {
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HomeProvider>
          <TestComponent />
        </HomeProvider>
      </QueryClientProvider>
    )

    const button = screen.getByRole('button', { name: 'Set Home ID' })
    await user.click(button)

    expect(localStorage.setItem).toHaveBeenCalledWith('homeId', 'test-home-id')
    expect(screen.getByTestId('current-home-id')).toHaveTextContent('test-home-id')
  })
})
