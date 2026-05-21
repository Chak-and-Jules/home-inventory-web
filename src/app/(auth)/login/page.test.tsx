import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Login from './page'
import { supabase } from '@/lib/supabase'
import mockRouter from 'next-router-mock'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
    },
  },
}))

describe('Login Page', () => {
  beforeEach(() => {
    mockRouter.setCurrentUrl('/login')
    jest.clearAllMocks()
  })

  it('renders login form', () => {
    render(<Login />)
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('handles successful login', async () => {
    const mockSignInWithPassword = supabase.auth.signInWithPassword as jest.Mock
    mockSignInWithPassword.mockResolvedValueOnce({ error: null })

    render(<Login />)

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

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
    const mockSignInWithPassword = supabase.auth.signInWithPassword as jest.Mock
    const errorMessage = 'Invalid login credentials'
    mockSignInWithPassword.mockResolvedValueOnce({ error: { message: errorMessage } })

    render(<Login />)

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

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
})
