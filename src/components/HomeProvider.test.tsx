import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeProvider, useHome } from './HomeProvider'
import { useAuth } from './AuthProvider'

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

  it('sets homeId in localStorage when setCurrentHomeId is called', async () => {
    const user = userEvent.setup()

    render(
      <HomeProvider>
        <TestComponent />
      </HomeProvider>
    )

    const button = screen.getByRole('button', { name: 'Set Home ID' })
    await user.click(button)

    expect(localStorage.setItem).toHaveBeenCalledWith('homeId', 'test-home-id')
    expect(screen.getByTestId('current-home-id')).toHaveTextContent('test-home-id')
  })
})
