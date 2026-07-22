import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Signup from './page'
import { supabase } from '@/lib/supabase'
import mockRouter from 'next-router-mock'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  },
}))

// Mock AuthProvider/useAuth
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: null,
  }),
}))

describe('Signup Page', () => {
  beforeEach(() => {
    mockRouter.setCurrentUrl('/signup')
    vi.clearAllMocks()
    if (typeof window !== 'undefined') {
      window.localStorage.clear()
    }
  })

  it('renders signup form', () => {
    render(<Signup />)
    expect(screen.getByRole('heading', { name: /auth\.createAccount/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/auth\.emailAddress/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/auth\.password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /auth\.signUp$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /auth\.signUpWithGoogle/i })).toBeInTheDocument()
  })

  it('handles successful signup', async () => {
    const mockSignUp = supabase.auth.signUp as ReturnType<typeof vi.fn>
    mockSignUp.mockResolvedValueOnce({ error: null })

    render(<Signup />)

    const emailInput = screen.getByLabelText(/auth\.emailAddress/i)
    const passwordInput = screen.getByLabelText(/auth\.password/i)
    const submitButton = screen.getByRole('button', { name: /auth\.signUp$/i })

    await userEvent.type(emailInput, 'newuser@example.com')
    await userEvent.type(passwordInput, 'password123')
    await userEvent.click(submitButton)

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'newuser@example.com',
      password: 'password123',
    })

    await waitFor(() => {
      expect(screen.getByText(/auth\.accountCreatedSuccess/i)).toBeInTheDocument()
    })
  })

  it('handles Google sign up', async () => {
    const mockSignInWithOAuth = supabase.auth.signInWithOAuth as ReturnType<typeof vi.fn>
    mockSignInWithOAuth.mockResolvedValueOnce({ error: null })

    render(<Signup />)

    const googleButton = screen.getByRole('button', { name: /auth\.signUpWithGoogle/i })
    await userEvent.click(googleButton)

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000/signup',
      },
    })
    expect(localStorage.getItem('pending_google_link')).toBe('true')
  })
})
