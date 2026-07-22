'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pencil, Trash2, Plus, CheckCircle2, Circle } from 'lucide-react'
import { MaintenanceTaskForm } from './MaintenanceTaskForm'
import type { MaintenanceTask } from '@/types'
import { cn } from '@/lib/utils'
import { useHome } from './HomeProvider'

interface MaintenanceTaskListProps {
  inventoryItemId?: string
  showItemName?: boolean
}

export function MaintenanceTaskList({ inventoryItemId, showItemName }: MaintenanceTaskListProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { currentHomeId } = useHome()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<MaintenanceTask | undefined>(undefined)

  const { data: tasks, isPending } = useQuery({
    queryKey: ['maintenance-tasks', inventoryItemId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (inventoryItemId) {
        params.append('inventory_item_id', inventoryItemId)
      }
      const res = await api.get<MaintenanceTask[]>(`/maintenance-tasks?${params.toString()}`, {
        headers: { 'X-Home-Id': currentHomeId }
      })
      return res.data
    },
    enabled: !!currentHomeId,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/maintenance-tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] })
    },
    onError: () => {
      alert(t('maintenance.alerts.failedToDelete'))
    }
  })

  const toggleMutation = useMutation({
    mutationFn: (task: MaintenanceTask) => {
      if (!task.IsCompleted) {
        return api.post(`/maintenance-tasks/${task.ID}/complete`)
      } else {
        return api.put(`/maintenance-tasks/${task.ID}`, {
          ...task,
          is_completed: false,
          inventory_item_id: task.InventoryItemID,
          scheduled_date: task.ScheduledDate,
          description: task.Description,
          frequency: task.Frequency,
          custom_frequency: task.Frequency === 'custom' ? task.CustomFrequency : null,
          custom_frequency_metric: task.Frequency === 'custom' ? task.CustomFrequencyMetric : null,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] })
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { message?: string } } }
      const msg = axiosError?.response?.data?.message || t('maintenance.alerts.failedToUpdate')
      alert(msg)
    },
  })

  const handleEdit = (task: MaintenanceTask) => {
    setEditingTask(task)
    setIsFormOpen(true)
  }

  const handleAddNew = () => {
    setEditingTask(undefined)
    setIsFormOpen(true)
  }

  if (isPending) {
    return <div className="p-4 text-center text-gray-500">{t('reports.inventory.loading', { defaultValue: 'Loading tasks...' })}</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-4 sm:px-0">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          {t('maintenance.title')}
        </h3>
        <Button onClick={handleAddNew} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          {t('maintenance.addTask')}
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              {showItemName && <TableHead>{t('maintenance.item')}</TableHead>}
              <TableHead>{t('categories.tableName')}</TableHead>
              <TableHead>{t('maintenance.scheduledDate')}</TableHead>
              <TableHead>{t('maintenance.frequency')}</TableHead>
              <TableHead className="text-right">{t('categories.tableActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!tasks || tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showItemName ? 6 : 5} className="text-center py-8 text-gray-500">
                  {t('maintenance.noTasks')}
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => (
                <TableRow key={task.ID} className={cn(task.IsCompleted && "opacity-60")}>
                  <TableCell>
                    <button
                      onClick={() => toggleMutation.mutate(task)}
                      disabled={toggleMutation.isPending}
                      className="text-gray-400 hover:text-indigo-600 transition-colors flex items-center justify-center"
                      aria-label={task.IsCompleted ? 'Mark as incomplete' : 'Mark as completed'}
                    >
                      {toggleMutation.isPending && toggleMutation.variables?.ID === task.ID ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
                      ) : task.IsCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </button>
                  </TableCell>
                  {showItemName && (
                    <TableCell className="font-medium">
                      {task.Dependencies && task.Dependencies.length > 0 ? (
                        <div className="space-y-1">
                          {task.Dependencies.map((dep) => (
                            <div key={dep.ID} className="text-xs sm:text-sm">
                              {dep.ItemDefinition?.Name || '—'} (x{dep.QuantityRequired})
                            </div>
                          ))}
                        </div>
                      ) : (
                        task.InventoryItem?.ItemDefinition?.Name || '—'
                      )}
                    </TableCell>
                  )}
                  <TableCell className={cn(task.IsCompleted && "line-through")}>
                    {task.Description}
                  </TableCell>
                  <TableCell>
                    {new Date(task.ScheduledDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {task.Frequency === 'custom' ? (
                      t('maintenance.frequencyCustomDisplay', {
                        count: task.CustomFrequency,
                        metric: task.CustomFrequencyMetric
                          ? t(`maintenance.metric${task.CustomFrequencyMetric.charAt(0).toUpperCase() + task.CustomFrequencyMetric.slice(1)}`)
                          : '',
                        defaultValue: `Every ${task.CustomFrequency} ${task.CustomFrequencyMetric}`
                      })
                    ) : (
                      task.Frequency ? t(`maintenance.frequency${task.Frequency.charAt(0).toUpperCase() + task.Frequency.slice(1)}`) : '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(task)} className="h-8 w-8" aria-label={t('maintenance.editTask')}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 flex items-center justify-center"
                        onClick={() => {
                          if (confirm(t('maintenance.alerts.deleteConfirm'))) {
                            deleteMutation.mutate(task.ID)
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        aria-label={t('maintenance.alerts.deleteConfirm').replace('Are you sure you want to delete this maintenance task?', 'Delete maintenance task')}
                      >
                        {deleteMutation.isPending && deleteMutation.variables === task.ID ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <MaintenanceTaskForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        inventoryItemId={inventoryItemId}
        task={editingTask}
      />
    </div>
  )
}
