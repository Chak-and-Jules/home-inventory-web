'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useHome } from '@/components/HomeProvider'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { MaintenanceTask, MaintenanceTaskRequest, ItemDefinition, TaskItemDependencyRequest } from '@/types'

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

  const { currentHomeId } = useHome()

  const { data: itemDefs } = useQuery({
    queryKey: ['itemDefs', currentHomeId],
    queryFn: async () => {
      const res = await api.get<ItemDefinition[]>('/item-definitions', { headers: { 'X-Home-Id': currentHomeId } })
      return res.data
    },
    enabled: !!currentHomeId,
  })

  const [dependencies, setDependencies] = useState<TaskItemDependencyRequest[]>(() =>
    task?.Dependencies?.map(dep => ({
      item_definition_id: dep.ItemDefinitionID,
      quantity_required: dep.QuantityRequired,
    })) || []
  )

  const [selectedItemDefId, setSelectedItemDefId] = useState('')
  const [quantityRequired, setQuantityRequired] = useState(1)

  const handleAddDependency = () => {
    if (!selectedItemDefId) return
    if (dependencies.some(dep => dep.item_definition_id === selectedItemDefId)) {
      alert('This item is already added as a dependency.')
      return
    }
    setDependencies([
      ...dependencies,
      {
        item_definition_id: selectedItemDefId,
        quantity_required: quantityRequired,
      },
    ])
    setSelectedItemDefId('')
    setQuantityRequired(1)
  }

  const handleRemoveDependency = (itemDefId: string) => {
    setDependencies(dependencies.filter(dep => dep.item_definition_id !== itemDefId))
  }

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
      dependencies,
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

          {/* Dependencies Section */}
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-800 pt-4">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              {t('maintenance.dependenciesTitle', { defaultValue: 'Item Dependencies (Consumed on completion)' })}
            </h4>

            {/* List of currently added dependencies */}
            {dependencies.length > 0 ? (
              <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                {dependencies.map((dep) => {
                  const itemDef = itemDefs?.find(d => d.ID === dep.item_definition_id)
                  return (
                    <div key={dep.item_definition_id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-700 text-sm">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {itemDef ? itemDef.Name : 'Loading...'}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 dark:text-gray-400">
                          Qty: {dep.quantity_required} {itemDef?.SizeUnit?.Name || ''}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveDependency(dep.item_definition_id)}
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 flex items-center justify-center"
                          aria-label={`Remove dependency for ${itemDef ? itemDef.Name : ''}`}
                        >
                          &times;
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('maintenance.noDependencies', { defaultValue: 'No item dependencies added yet.' })}
              </p>
            )}

            {/* Add Dependency form block */}
            <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
              <div className="space-y-1">
                <Label htmlFor="dependency-item" className="text-xs">{t('maintenance.selectItem', { defaultValue: 'Select Item' })}</Label>
                <Select
                  id="dependency-item"
                  value={selectedItemDefId}
                  onChange={(e) => setSelectedItemDefId(e.target.value)}
                  aria-label="Select item dependency"
                >
                  <option value="">{t('inventory.selectItem', { defaultValue: 'Select Item...' })}</option>
                  {itemDefs?.map(def => (
                    <option key={def.ID} value={def.ID}>{def.Name}</option>
                  ))}
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="dependency-quantity" className="text-xs">{t('maintenance.quantityRequired', { defaultValue: 'Quantity Required' })}</Label>
                  <Input
                    id="dependency-quantity"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={quantityRequired}
                    onChange={(e) => setQuantityRequired(parseFloat(e.target.value) || 0)}
                    aria-label="Quantity required"
                  />
                </div>
                <Button
                  id="add-dependency-button"
                  type="button"
                  onClick={handleAddDependency}
                  disabled={!selectedItemDefId || quantityRequired <= 0}
                  className="whitespace-nowrap"
                >
                  {t('maintenance.addDependency', { defaultValue: 'Add' })}
                </Button>
              </div>
            </div>
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
