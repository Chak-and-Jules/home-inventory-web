import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Login from './page'
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
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      linkIdentity: vi.fn(),
    },
  },
}))

// Mock AuthProvider/useAuth
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: null,
  }),
}))

describe('Login Page', () => {
  beforeEach(() => {
    mockRouter.setCurrentUrl('/login')
    vi.clearAllMocks()
    if (typeof window !== 'undefined') {
      window.localStorage.clear()
    }
  })

  it('renders login form', () => {
    render(<Login />)
    expect(screen.getByRole('heading', { name: /auth\.welcomeBack/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/auth\.emailAddress/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/auth\.password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^auth\.signIn$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /auth\.signInWithGoogle/i })).toBeInTheDocument()
  })

  it('handles successful login', async () => {
    const mockSignInWithPassword = supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>
    mockSignInWithPassword.mockResolvedValueOnce({ error: null })

    render(<Login />)

    const emailInput = screen.getByLabelText(/auth\.emailAddress/i)
    const passwordInput = screen.getByLabelText(/auth\.password/i)
    const submitButton = screen.getByRole('button', { name: /^auth\.signIn$/i })

    await userEvent.type(emailInput, 'test@example.com')
    await userEvent.type(passwordInput, 'password123')
    await userEvent.click(submitButton)

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    })

    await waitFor(() => {
      expect(mockRouter.asPath).toBe('/')
    })
  })

  it('displays error message on failed login', async () => {
    const mockSignInWithPassword = supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>
    const errorMessage = 'Invalid login credentials'
    mockSignInWithPassword.mockResolvedValueOnce({ error: { message: errorMessage } })

    render(<Login />)

    const emailInput = screen.getByLabelText(/auth\.emailAddress/i)
    const passwordInput = screen.getByLabelText(/auth\.password/i)
    const submitButton = screen.getByRole('button', { name: /^auth\.signIn$/i })

    await userEvent.type(emailInput, 'test@example.com')
    await userEvent.type(passwordInput, 'wrongpassword')
    await userEvent.click(submitButton)

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'wrongpassword',
    })

    const errorElement = await screen.findByText(errorMessage)
    expect(errorElement).toBeInTheDocument()

    // Router should not redirect
    expect(mockRouter.asPath).toBe('/login')
  })

  it('handles Google sign in', async () => {
    const mockSignInWithOAuth = supabase.auth.signInWithOAuth as ReturnType<typeof vi.fn>
    mockSignInWithOAuth.mockResolvedValueOnce({ error: null })

    render(<Login />)

    const googleButton = screen.getByRole('button', { name: /auth\.signInWithGoogle/i })
    await userEvent.click(googleButton)

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000/login',
      },
    })
    expect(localStorage.getItem('pending_google_link')).toBe('true')
  })

  it('triggers linkIdentity after password login if google sign in was pending', async () => {
    const mockSignInWithPassword = supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>
    mockSignInWithPassword.mockResolvedValueOnce({ error: null })

    const mockLinkIdentity = supabase.auth.linkIdentity as ReturnType<typeof vi.fn>
    mockLinkIdentity.mockResolvedValueOnce({ error: null })

    localStorage.setItem('pending_google_link', 'true')

    render(<Login />)

    const emailInput = screen.getByLabelText(/auth\.emailAddress/i)
    const passwordInput = screen.getByLabelText(/auth\.password/i)
    const submitButton = screen.getByRole('button', { name: /^auth\.signIn$/i })

    await userEvent.type(emailInput, 'test@example.com')
    await userEvent.type(passwordInput, 'password123')
    await userEvent.click(submitButton)

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    })

    await waitFor(() => {
      expect(mockLinkIdentity).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:3000/',
        },
      })
      expect(localStorage.getItem('pending_google_link')).toBeNull()
    })
  })
})
