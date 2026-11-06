import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Page from './page'
import { signUp, signInWithGoogle } from '@/lib/firebase'
import mockRouter from 'next-router-mock'

vi.mock('next/navigation', () => ({ useRouter: () => mockRouter }))
vi.mock('@/lib/firebase', () => ({
  signUp: vi.fn(), signInWithGoogle: vi.fn(), authErrorKey: () => 'auth.invalidCredentials',
}))
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ user: null }) }))

describe('signup', () => {
  beforeEach(() => { vi.clearAllMocks(); mockRouter.setCurrentUrl('/signup') })
  it('signs in with Firebase credentials and waits for profile initialization', async () => {
    render(<Page />)
    await userEvent.type(screen.getByLabelText('auth.emailAddress'), 'test@example.com')
    await userEvent.type(screen.getByLabelText('auth.password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'auth.signUp' }))
    expect(signUp).toHaveBeenCalledWith('test@example.com', 'password123')
    expect(mockRouter.asPath).toBe('/signup')
  })
  it('displays a translated error and allows retry', async () => {
    vi.mocked(signUp).mockRejectedValueOnce(new Error('private SDK detail'))
    render(<Page />)
    await userEvent.type(screen.getByLabelText('auth.emailAddress'), 'test@example.com')
    await userEvent.type(screen.getByLabelText('auth.password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'auth.signUp' }))
    expect(await screen.findByText('auth.invalidCredentials')).toBeInTheDocument()
    expect(screen.queryByText('private SDK detail')).not.toBeInTheDocument()
  })
  it('uses Firebase Google sign-in', async () => {
    render(<Page />)
    await userEvent.click(screen.getByRole('button', { name: 'auth.signUpWithGoogle' }))
    expect(signInWithGoogle).toHaveBeenCalledOnce()
    expect(localStorage.getItem('pending_google_link')).toBeNull()
  })
})
