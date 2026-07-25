'use client'

import React, { Suspense, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/components/AuthProvider'
import { useHome } from '@/components/HomeProvider'
import { ShoppingListItem, UserHome, RestockInsight } from '@/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Trash2, Plus, Sparkles } from 'lucide-react'
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

  const [shoppingWindowDays, setShoppingWindowDays] = React.useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('shoppingWindowDays');
      if (stored) return Number(stored);
    }
    return 7;
  });

  const [dismissedItemIds, setDismissedItemIds] = React.useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dismissedRestockInsights');
      if (stored) {
        try { return JSON.parse(stored); } catch { return []; }
      }
    }
    return [];
  });

  const handleDismissSuggestion = (id: string) => {
    setDismissedItemIds((prev) => {
      const next = [...prev, id];
      if (typeof window !== 'undefined') {
        localStorage.setItem('dismissedRestockInsights', JSON.stringify(next));
        window.dispatchEvent(new Event('dismissedRestockInsightsChanged'));
      }
      return next;
    });
  };

  // Sync state via custom events
  React.useEffect(() => {
    const sync = () => {
      const storedWindow = localStorage.getItem('shoppingWindowDays');
      if (storedWindow) setShoppingWindowDays(Number(storedWindow));
      const storedDismissed = localStorage.getItem('dismissedRestockInsights');
      if (storedDismissed) {
        try { setDismissedItemIds(JSON.parse(storedDismissed)); } catch {}
      }
    };
    window.addEventListener('shoppingWindowDaysChanged', sync);
    window.addEventListener('dismissedRestockInsightsChanged', sync);
    return () => {
      window.removeEventListener('shoppingWindowDaysChanged', sync);
      window.removeEventListener('dismissedRestockInsightsChanged', sync);
    };
  }, []);

  const { data: restockInsights } = useQuery({
    queryKey: ['restock-insights', currentHomeId],
    queryFn: async () => {
      const res = await api.get<RestockInsight[]>('/inventory/insights/restock', {
        headers: { 'X-Home-Id': currentHomeId }
      });
      return res.data;
    },
    enabled: !!currentHomeId && !!session,
  });

  const acceptSuggestionMutation = useMutation({
    mutationFn: (item: RestockInsight) => {
      const qty = Math.max(1, (item.item_definition.target_quantity || 1) - item.current_stock);
      return api.post('/shopping-list', {
        item_definition_id: item.item_definition.ID,
        name: item.item_definition.Name,
        quantity: qty
      }, {
        headers: { 'X-Home-Id': currentHomeId }
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
      handleDismissSuggestion(variables.item_definition.ID);
    }
  });

  const predictiveSuggestions = useMemo(() => {
    if (!restockInsights) return [];
    return restockInsights.filter(item => {
      const isWithinWindow = item.days_left <= shoppingWindowDays;
      const isDismissed = dismissedItemIds.includes(item.item_definition.ID);
      return isWithinWindow && !isDismissed;
    });
  }, [restockInsights, shoppingWindowDays, dismissedItemIds]);

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
    userRole === 'owner' || userRole === 'editor',
  [userRole])

  const [newName, setNewName] = React.useState('')
  const [newQuantity, setNewQuantity] = React.useState('1')
  const [itemToUpdateInventory, setItemToUpdateInventory] = React.useState<ShoppingListItem | null>(null)

  const { data: shoppingList, isPending } = useQuery({
    queryKey: ['shoppingList', currentHomeId],
    queryFn: async () => {
      const res = await api.get<ShoppingListItem[]>('/shopping-list', { headers: { 'X-Home-Id': currentHomeId } })
      return res.data
    },
    enabled: !!session && !!currentHomeId,
  })

  const { autoItems, manualItems } = useMemo(() => {
    const auto = []
    const manual = []
    if (shoppingList) {
      for (let i = 0; i < shoppingList.length; i++) {
        const item = shoppingList[i];
        if (item.IsAutoGenerated) {
          auto.push(item);
        } else {
          manual.push(item);
        }
      }
    }
    return { autoItems: auto, manualItems: manual }
  }, [shoppingList])

  const createMutation = useMutation({
    mutationFn: (data: { name: string, quantity: number }) =>
      api.post('/shopping-list', data, { headers: { 'X-Home-Id': currentHomeId } }),
    onSuccess: () => {
      setNewName('')
      setNewQuantity('1')
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] })
    }
  })

  const updateMutation = useMutation({
    mutationFn: (item: ShoppingListItem) =>
      api.patch(`/shopping-list/${item.ID}/toggle-bought`),
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
      api.delete(`/shopping-list/${id}`, { headers: { 'X-Home-Id': currentHomeId } }),
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

      {/* Predictive Suggestions */}
      {predictiveSuggestions.length > 0 && (
        <Card className="border-indigo-100 bg-indigo-50/20 dark:bg-indigo-950/10 dark:border-indigo-900/40">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Predictive Restock Suggestions
              </CardTitle>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
              Smart Insights
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {predictiveSuggestions.map((item) => (
                <div key={item.item_definition.ID} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {item.item_definition.Name}
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50">
                        Predictive Suggestion
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {item.reason || `You usually use ${item.average_daily_consumption} units per day, and you have ${item.current_stock} left.`}
                    </p>
                    <p className="text-xs text-gray-400">
                      Predicted to run out on {new Date(item.predicted_depletion_date).toLocaleDateString()} ({item.days_left} {item.days_left === 1 ? 'day' : 'days'} left). Suggested add: <span className="font-semibold">{Math.max(1, (item.item_definition.target_quantity || 1) - item.current_stock)}</span> units.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      onClick={() => acceptSuggestionMutation.mutate(item)}
                      disabled={acceptSuggestionMutation.isPending && acceptSuggestionMutation.variables?.item_definition.ID === item.item_definition.ID}
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                    >
                      {acceptSuggestionMutation.isPending && acceptSuggestionMutation.variables?.item_definition.ID === item.item_definition.ID ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        "Accept"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDismissSuggestion(item.item_definition.ID)}
                      className="text-gray-500 hover:text-red-600 border-gray-200"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
