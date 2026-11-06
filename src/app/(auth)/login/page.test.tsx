import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Page from './page'
import { signIn, signInWithGoogle } from '@/lib/firebase'
import mockRouter from 'next-router-mock'

vi.mock('next/navigation', () => ({ useRouter: () => mockRouter }))
vi.mock('@/lib/firebase', () => ({
  signIn: vi.fn(), signInWithGoogle: vi.fn(), authErrorKey: () => 'auth.invalidCredentials',
}))
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ user: null }) }))

describe('login', () => {
  beforeEach(() => { vi.clearAllMocks(); mockRouter.setCurrentUrl('/login') })
  it('signs in with Firebase credentials and waits for profile initialization', async () => {
    render(<Page />)
    await userEvent.type(screen.getByLabelText('auth.emailAddress'), 'test@example.com')
    await userEvent.type(screen.getByLabelText('auth.password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'auth.signIn' }))
    expect(signIn).toHaveBeenCalledWith('test@example.com', 'password123')
    expect(mockRouter.asPath).toBe('/login')
  })
  it('displays a translated error and allows retry', async () => {
    vi.mocked(signIn).mockRejectedValueOnce(new Error('private SDK detail'))
    render(<Page />)
    await userEvent.type(screen.getByLabelText('auth.emailAddress'), 'test@example.com')
    await userEvent.type(screen.getByLabelText('auth.password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'auth.signIn' }))
    expect(await screen.findByText('auth.invalidCredentials')).toBeInTheDocument()
    expect(screen.queryByText('private SDK detail')).not.toBeInTheDocument()
  })
  it('uses Firebase Google sign-in', async () => {
    render(<Page />)
    await userEvent.click(screen.getByRole('button', { name: 'auth.signInWithGoogle' }))
    expect(signInWithGoogle).toHaveBeenCalledOnce()
    expect(localStorage.getItem('pending_google_link')).toBeNull()
  })
})
