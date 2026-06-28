'use client'

import React, { Suspense, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/components/AuthProvider'
import { useHome } from '@/components/HomeProvider'
import { ShoppingListItem, UserHome } from '@/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Trash2, Plus } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

function ShoppingListContent() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { currentHomeId } = useHome()
  const queryClient = useQueryClient()

  const { data: userHomes } = useQuery({
    queryKey: ['homes'],
    queryFn: async () => {
      const res = await api.get<UserHome[]>('/homes')
      return res.data
    },
    enabled: !!session,
  })

  const userRole = useMemo(() => {
    const home = userHomes?.find(h => h.HomeID === currentHomeId)
    return home?.Role?.toLowerCase()
  }, [userHomes, currentHomeId])

  const canModify = useMemo(() =>
    userRole === 'owner' || userRole === 'editor' || userRole === 'partner',
  [userRole])

  const [newName, setNewName] = React.useState('')
  const [newQuantity, setNewQuantity] = React.useState('1')
  const [itemToUpdateInventory, setItemToUpdateInventory] = React.useState<ShoppingListItem | null>(null)

  const { data: shoppingList, isPending } = useQuery({
    queryKey: ['shoppingList', currentHomeId],
    queryFn: async () => {
      const res = await api.get<ShoppingListItem[]>(`/homes/${currentHomeId}/shopping-list`)
      return res.data
    },
    enabled: !!session && !!currentHomeId,
  })

  const { autoItems, manualItems } = useMemo(() => {
    const auto = shoppingList?.filter(item => !item.IsManual) || []
    const manual = shoppingList?.filter(item => item.IsManual) || []
    return { autoItems: auto, manualItems: manual }
  }, [shoppingList])

  const createMutation = useMutation({
    mutationFn: (data: { name: string, quantity: number }) =>
      api.post(`/homes/${currentHomeId}/shopping-list`, data),
    onSuccess: () => {
      setNewName('')
      setNewQuantity('1')
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] })
    }
  })

  const updateMutation = useMutation({
    mutationFn: (item: ShoppingListItem) =>
      api.put(`/homes/${currentHomeId}/shopping-list/${item.ID}`, {
        is_bought: !item.IsBought,
        name: item.Name,
        quantity: item.Quantity,
        item_definition_id: item.ItemDefinitionID
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] })
      // If marked as bought and has an item definition, prompt to update inventory
      if (!variables.IsBought && variables.ItemDefinitionID) {
        setItemToUpdateInventory(variables)
      }
    }
  })

  const updateInventoryMutation = useMutation({
    mutationFn: (item: ShoppingListItem) =>
      api.post('/inventory', {
        item_definition_id: item.ItemDefinitionID,
        quantity: item.Quantity
      }, { headers: { 'X-Home-Id': currentHomeId } }),
    onSuccess: () => {
      setItemToUpdateInventory(null)
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/homes/${currentHomeId}/shopping-list/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] })
    }
  })

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    createMutation.mutate({
      name: newName,
      quantity: Number(newQuantity) || 1
    })
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{t('shoppingList.title')}</h1>
          <p className="text-gray-500">{t('shoppingList.description')}</p>
        </div>
      </div>

      {canModify && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{t('shoppingList.addItem')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddManualItem} className="flex flex-col sm:flex-row items-end gap-4">
              <div className="flex-1 space-y-2 w-full">
                <Label htmlFor="itemName">{t('shoppingList.itemName')}</Label>
                <Input
                  id="itemName"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('shoppingList.placeholder')}
                  required
                />
              </div>
              <div className="w-full sm:w-24 space-y-2">
                <Label htmlFor="quantity">{t('shoppingList.quantity')}</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0.01"
                  step="any"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={createMutation.isPending || !newName.trim()} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                {createMutation.isPending ? t('shoppingList.adding') : t('shoppingList.add')}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!itemToUpdateInventory} onOpenChange={(open) => !open && setItemToUpdateInventory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('shoppingList.updateInventoryPrompt.title')}</DialogTitle>
            <DialogDescription>
              {t('shoppingList.updateInventoryPrompt.description', {
                name: itemToUpdateInventory?.Name,
                quantity: itemToUpdateInventory?.Quantity
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemToUpdateInventory(null)}>
              {t('shoppingList.updateInventoryPrompt.skip')}
            </Button>
            <Button onClick={() => itemToUpdateInventory && updateInventoryMutation.mutate(itemToUpdateInventory)}>
              {t('shoppingList.updateInventoryPrompt.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-6">
        {/* Automatically Added Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('shoppingList.automaticallyAdded')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>{t('shoppingList.itemName')}</TableHead>
                  <TableHead className="text-right">{t('shoppingList.quantity')}</TableHead>
                  <TableHead className="w-24 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {autoItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                      {t('shoppingList.empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  autoItems.map((item) => (
                    <TableRow key={item.ID}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={item.IsBought}
                          onChange={() => updateMutation.mutate(item)}
                          disabled={!canModify || (updateMutation.isPending && updateMutation.variables?.ID === item.ID)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Mark ${item.Name} as ${item.IsBought ? 'not bought' : 'bought'}`}
                        />
                      </TableCell>
                      <TableCell className={item.IsBought ? 'line-through text-gray-400' : ''}>
                        {item.Name}
                      </TableCell>
                      <TableCell className={`text-right ${item.IsBought ? 'line-through text-gray-400' : ''}`}>
                        {item.Quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {canModify && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (window.confirm(t('shoppingList.deleteConfirm'))) {
                                deleteMutation.mutate(item.ID)
                              }
                            }}
                            disabled={deleteMutation.isPending && deleteMutation.variables === item.ID}
                            className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                            aria-label={`Delete ${item.Name}`}
                          >
                            {deleteMutation.isPending && deleteMutation.variables === item.ID ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                            ) : (
                                <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Manually Added Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('shoppingList.manuallyAdded')}</CardTitle>
          </CardHeader>
          <CardContent>
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>{t('shoppingList.itemName')}</TableHead>
                  <TableHead className="text-right">{t('shoppingList.quantity')}</TableHead>
                  <TableHead className="w-24 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manualItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                      {t('shoppingList.empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  manualItems.map((item) => (
                    <TableRow key={item.ID}>
                      <TableCell>
                         <input
                          type="checkbox"
                          checked={item.IsBought}
                          onChange={() => updateMutation.mutate(item)}
                          disabled={!canModify || (updateMutation.isPending && updateMutation.variables?.ID === item.ID)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Mark ${item.Name} as ${item.IsBought ? 'not bought' : 'bought'}`}
                        />
                      </TableCell>
                      <TableCell className={item.IsBought ? 'line-through text-gray-400' : ''}>
                        {item.Name}
                      </TableCell>
                      <TableCell className={`text-right ${item.IsBought ? 'line-through text-gray-400' : ''}`}>
                        {item.Quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {canModify && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (window.confirm(t('shoppingList.deleteConfirm'))) {
                                deleteMutation.mutate(item.ID)
                              }
                            }}
                            disabled={deleteMutation.isPending && deleteMutation.variables === item.ID}
                            className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                            aria-label={`Delete ${item.Name}`}
                          >
                            {deleteMutation.isPending && deleteMutation.variables === item.ID ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                            ) : (
                                <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ShoppingListPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ShoppingListContent />
    </Suspense>
  )
}
