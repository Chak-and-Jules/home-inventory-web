'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { MaintenanceTask, MaintenanceTaskRequest } from '@/types'

interface MaintenanceTaskFormProps {
  isOpen: boolean
  onClose: () => void
  inventoryItemId?: string
  task?: MaintenanceTask
}

export function MaintenanceTaskForm({
  isOpen,
  onClose,
  inventoryItemId,
  task,
}: MaintenanceTaskFormProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [description, setDescription] = useState(task?.Description || '')
  const [scheduledDate, setScheduledDate] = useState(
    task?.ScheduledDate
      ? new Date(task.ScheduledDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  )
  const [frequency, setFrequency] = useState(task?.Frequency || 'once')
  const [isCompleted, setIsCompleted] = useState(task?.IsCompleted || false)

  const mutation = useMutation({
    mutationFn: async (data: MaintenanceTaskRequest) => {
      if (task) {
        return api.put(`/maintenance-tasks/${task.ID}`, data)
      }
      return api.post('/maintenance-tasks', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] })
      onClose()
    },
    onError: () => {
      alert(task ? t('maintenance.alerts.failedToUpdate') : t('maintenance.alerts.failedToCreate'))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({
      inventory_item_id: inventoryItemId || task?.InventoryItemID,
      description,
      scheduled_date: new Date(scheduledDate).toISOString(),
      frequency,
      is_completed: isCompleted,
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {task ? t('maintenance.editTask') : t('maintenance.addTask')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="description">{t('maintenance.descriptionLabel')}</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('maintenance.descriptionPlaceholder')}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scheduledDate">{t('maintenance.scheduledDate')}</Label>
            <Input
              id="scheduledDate"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="frequency">{t('maintenance.frequency')}</Label>
            <Select
              id="frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              aria-label={t('maintenance.frequency')}
            >
              <option value="once">{t('maintenance.frequencyOnce')}</option>
              <option value="monthly">{t('maintenance.frequencyMonthly')}</option>
              <option value="yearly">{t('maintenance.frequencyYearly')}</option>
            </Select>
          </div>
          <div className="flex items-center space-x-2 pt-2">
             <input
                id="isCompleted"
                type="checkbox"
                checked={isCompleted}
                onChange={(e) => setIsCompleted(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
             />
             <Label htmlFor="isCompleted" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {t('maintenance.completed')}
             </Label>
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('profile.alerts.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('categories.creating') : t('categories.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
