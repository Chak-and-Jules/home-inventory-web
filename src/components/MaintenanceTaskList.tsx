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

interface MaintenanceTaskListProps {
  inventoryItemId?: string
  showItemName?: boolean
}

export function MaintenanceTaskList({ inventoryItemId, showItemName }: MaintenanceTaskListProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<MaintenanceTask | undefined>(undefined)

  const { data: tasks, isPending } = useQuery({
    queryKey: ['maintenance-tasks', inventoryItemId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (inventoryItemId) {
        params.append('inventory_item_id', inventoryItemId)
      }
      const res = await api.get<MaintenanceTask[]>(`/maintenance-tasks?${params.toString()}`)
      return res.data
    },
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
    mutationFn: (task: MaintenanceTask) =>
      api.put(`/maintenance-tasks/${task.ID}`, {
        ...task,
        is_completed: !task.IsCompleted,
        inventory_item_id: task.InventoryItemID,
        scheduled_date: task.ScheduledDate,
        description: task.Description,
        frequency: task.Frequency,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] })
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
                      className="text-gray-400 hover:text-indigo-600 transition-colors"
                      aria-label={task.IsCompleted ? 'Mark as incomplete' : 'Mark as completed'}
                    >
                      {task.IsCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </button>
                  </TableCell>
                  {showItemName && (
                    <TableCell className="font-medium">
                      {task.InventoryItem?.ItemDefinition?.Name || '—'}
                    </TableCell>
                  )}
                  <TableCell className={cn(task.IsCompleted && "line-through")}>
                    {task.Description}
                  </TableCell>
                  <TableCell>
                    {new Date(task.ScheduledDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {task.Frequency ? t(`maintenance.frequency${task.Frequency.charAt(0).toUpperCase() + task.Frequency.slice(1)}`) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(task)} className="h-8 w-8">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                        onClick={() => {
                          if (confirm(t('maintenance.alerts.deleteConfirm'))) {
                            deleteMutation.mutate(task.ID)
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
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
