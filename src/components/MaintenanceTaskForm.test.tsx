import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MaintenanceTaskForm } from './MaintenanceTaskForm'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useHome } from '@/components/HomeProvider'
import { api } from '@/lib/api'
import MockAdapter from 'axios-mock-adapter'

vi.mock('@/components/HomeProvider', () => ({
  useHome: vi.fn(),
}))

const mockApi = new MockAdapter(api)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
)

describe('MaintenanceTaskForm Component', () => {
  const homeId = 'test-home-id'
  const onCloseMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.reset()
    queryClient.clear()

    vi.mocked(useHome).mockReturnValue({
      currentHomeId: homeId,
    } as any)

    mockApi.onGet('/item-definitions').reply(200, [])
  })

  it('renders default fields and hides custom frequency fields by default', async () => {
    render(<MaintenanceTaskForm isOpen={true} onClose={onCloseMock} />, { wrapper })

    expect(screen.getByLabelText('maintenance.descriptionLabel')).toBeInTheDocument()
    expect(screen.getByLabelText('maintenance.scheduledDate')).toBeInTheDocument()
    expect(screen.getByLabelText('maintenance.frequency')).toBeInTheDocument()

    expect(screen.queryByLabelText('maintenance.customValueLabel')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('maintenance.customMetricLabel')).not.toBeInTheDocument()
  })

  it('shows custom frequency and metric fields when custom is selected', async () => {
    const user = userEvent.setup()
    render(<MaintenanceTaskForm isOpen={true} onClose={onCloseMock} />, { wrapper })

    const freqSelect = screen.getByLabelText('maintenance.frequency')
    await user.selectOptions(freqSelect, 'custom')

    expect(screen.getByLabelText('maintenance.customValueLabel')).toBeInTheDocument()
    expect(screen.getByLabelText('maintenance.customMetricLabel')).toBeInTheDocument()
  })

  it('submits correct payload for standard frequency (with null custom values)', async () => {
    const user = userEvent.setup()
    mockApi.onPost('/maintenance-tasks').reply(201, {})

    render(<MaintenanceTaskForm isOpen={true} onClose={onCloseMock} />, { wrapper })

    const descInput = screen.getByLabelText('maintenance.descriptionLabel')
    await user.type(descInput, 'Test Task')

    const saveButton = screen.getByRole('button', { name: 'categories.save' })
    await user.click(saveButton)

    await waitFor(() => {
      expect(mockApi.history.post.length).toBe(1)
      const data = JSON.parse(mockApi.history.post[0].data)
      expect(data.description).toBe('Test Task')
      expect(data.frequency).toBe('once')
      expect(data.custom_frequency).toBeNull()
      expect(data.custom_frequency_metric).toBeNull()
    })
    expect(onCloseMock).toHaveBeenCalled()
  })

  it('submits correct payload for custom frequency', async () => {
    const user = userEvent.setup()
    mockApi.onPost('/maintenance-tasks').reply(201, {})

    render(<MaintenanceTaskForm isOpen={true} onClose={onCloseMock} />, { wrapper })

    const descInput = screen.getByLabelText('maintenance.descriptionLabel')
    await user.type(descInput, 'Custom Test Task')

    const freqSelect = screen.getByLabelText('maintenance.frequency')
    await user.selectOptions(freqSelect, 'custom')

    const customValueInput = screen.getByLabelText('maintenance.customValueLabel')
    await user.type(customValueInput, '14')

    const customMetricSelect = screen.getByLabelText('maintenance.customMetricLabel')
    await user.selectOptions(customMetricSelect, 'week')

    const saveButton = screen.getByRole('button', { name: 'categories.save' })
    await user.click(saveButton)

    await waitFor(() => {
      expect(mockApi.history.post.length).toBe(1)
      const data = JSON.parse(mockApi.history.post[0].data)
      expect(data.description).toBe('Custom Test Task')
      expect(data.frequency).toBe('custom')
      expect(data.custom_frequency).toBe(14)
      expect(data.custom_frequency_metric).toBe('week')
    })
    expect(onCloseMock).toHaveBeenCalled()
  })

  it('pre-fills fields when editing a custom frequency task', async () => {
    const task: any = {
      ID: 'task-123',
      Description: 'Edit Task Description',
      ScheduledDate: '2026-07-22T00:00:00Z',
      Frequency: 'custom',
      IsCompleted: false,
      CustomFrequency: 3,
      CustomFrequencyMetric: 'month',
    }

    render(<MaintenanceTaskForm isOpen={true} onClose={onCloseMock} task={task} />, { wrapper })

    expect(screen.getByLabelText('maintenance.descriptionLabel')).toHaveValue('Edit Task Description')
    expect(screen.getByLabelText('maintenance.frequency')).toHaveValue('custom')
    expect(screen.getByLabelText('maintenance.customValueLabel')).toHaveValue(3)
    expect(screen.getByLabelText('maintenance.customMetricLabel')).toHaveValue('month')
  })
})
