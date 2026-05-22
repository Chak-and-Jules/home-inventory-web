import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthProvider'

const mocks = vi.hoisted(() => ({
  fullPageRedirect: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  push: vi.fn(),
  signOut: vi.fn(),
  syncProfile: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/login',
  useRouter: () => ({
    push: mocks.push,
  }),
}))

vi.mock('@/lib/navigation', () => ({
  fullPageRedirect: mocks.fullPageRedirect,
}))

vi.mock('@/lib/api', () => ({
  api: {
    post: mocks.syncProfile,
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signOut: mocks.signOut,
    },
  },
}))

function LogoutButton() {
  const { logout } = useAuth()

  return (
    <button type="button" onClick={() => void logout()}>
      Log out
    </button>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    mocks.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: mocks.unsubscribe,
        },
      },
    })
    mocks.signOut.mockResolvedValue({ error: null })
  })

  it('signs out and reloads to the login page', async () => {
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <LogoutButton />
      </AuthProvider>
    )

    await user.click(screen.getByRole('button', { name: /log out/i }))

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalled()
      expect(mocks.fullPageRedirect).toHaveBeenCalledWith('/login')
    })
  })
})
