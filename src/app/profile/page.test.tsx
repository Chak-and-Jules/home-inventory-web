import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import ProfilePage from './page'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '@/lib/api'
import MockAdapter from 'axios-mock-adapter'

// Mock Providers and other dependencies
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { email: 'test@example.com' } } }),
}))

vi.mock('@/components/HomeProvider', () => ({
  useHome: () => ({ setCurrentHomeId: vi.fn() }),
}))

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/profile',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock window.confirm
window.confirm = vi.fn().mockReturnValue(true)

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

const renderPage = (queryClient: QueryClient) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfilePage />
    </QueryClientProvider>
  )
}

describe('ProfilePage - Home Deletion', () => {
  let mock: MockAdapter

  beforeEach(() => {
    mock = new MockAdapter(api)
    vi.clearAllMocks()

    // Mock initial data
    mock.onGet('/languages').reply(200, [])
    mock.onGet('/profiles').reply(200, { language_id: 'en', web_theme: 'Light' })
    mock.onGet('/homes').reply(200, [
      {
        HomeID: 'home-1',
        Role: 'owner',
        IsDefault: true,
        Home: { ID: 'home-1', Name: 'Home 1' },
      },
      {
        HomeID: 'home-2',
        Role: 'owner',
        IsDefault: false,
        Home: { ID: 'home-2', Name: 'Home 2' },
      },
    ])
  })

  it('shows warning dialog when backend returns a warning on delete', async () => {
    mock.onDelete('/homes/home-1').reply(200, {
      warning: 'This is a default home. Are you sure?',
    })

    const queryClient = createTestQueryClient()
    renderPage(queryClient)

    // Switch to Homes tab
    const tabList = await screen.findByRole('tablist')
    const homesTab = within(tabList).getByRole('tab', { name: /profile.tabs.homes/i })
    fireEvent.click(homesTab)

    // Find and click delete button for Home 1
    const deleteBtn = await screen.findByLabelText(/Delete Home 1/i)
    fireEvent.click(deleteBtn)

    // Check if dialog with warning is shown
    expect(await screen.findByText('This is a default home. Are you sure?')).toBeInTheDocument()
    expect(screen.getByText('profile.alerts.deleteHomeWarning')).toBeInTheDocument()
  })

  it('sends approved=true when confirming deletion after warning', async () => {
    mock.onDelete('/homes/home-1').replyOnce(200, {
      warning: 'Warning message',
    })

    mock.onDelete('/homes/home-1', { params: { approved: true } }).reply(200, {})

    const queryClient = createTestQueryClient()
    renderPage(queryClient)

    const tabList = await screen.findByRole('tablist')
    const homesTab = within(tabList).getByRole('tab', { name: /profile.tabs.homes/i })
    fireEvent.click(homesTab)

    const deleteBtn = await screen.findByLabelText(/Delete Home 1/i)
    fireEvent.click(deleteBtn)

    // Wait for dialog
    const confirmBtn = await screen.findByRole('button', { name: /profile.alerts.confirm/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mock.history.delete.length).toBe(2)
      expect(mock.history.delete[1].params).toEqual({ approved: true })
    })

    // Dialog should be closed
    await waitFor(() => {
        expect(screen.queryByText('Warning message')).not.toBeInTheDocument()
    })
  })

  it('shows alert when backend refuses deletion (no warning property, just error)', async () => {
    mock.onDelete('/homes/home-1').reply(400, {
      error: 'Cannot delete the only remaining home',
    })

    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})

    const queryClient = createTestQueryClient()
    renderPage(queryClient)

    const tabList = await screen.findByRole('tablist')
    const homesTab = within(tabList).getByRole('tab', { name: /profile.tabs.homes/i })
    fireEvent.click(homesTab)

    const deleteBtn = await screen.findByLabelText(/Delete Home 1/i)
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('Cannot delete the only remaining home')
    })
  })
})
