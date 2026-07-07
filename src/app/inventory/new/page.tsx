'use client'

import { useAuth } from '@/components/AuthProvider'
import { useHome } from '@/components/HomeProvider'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ItemDefinition } from '@/types'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, PackagePlus } from 'lucide-react'

function NewInventoryItemForm() {
  const { session } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  
  const searchParams = useSearchParams()
  const initialDefId = searchParams.get('itemDefId') || ''

  const [definitionId, setDefinitionId] = useState(initialDefId)
  const [quantity, setQuantity] = useState(1)
  const [expirationDate, setExpirationDate] = useState('')

  const { currentHomeId } = useHome()

  const { data: itemDefs } = useQuery({
    queryKey: ['itemDefs'],
    queryFn: async () => {
      const res = await api.get<ItemDefinition[]>('/item-definitions', { headers: { 'X-Home-Id': currentHomeId } })
      return res.data
    },
    enabled: !!session,
  })

  const selectedDef = useMemo(() => itemDefs?.find(d => d.ID === definitionId), [itemDefs, definitionId])

  const createMutation = useMutation({
    //
    mutationFn: (data: unknown) => api.post('/inventory', data, { headers: { 'X-Home-Id': currentHomeId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      router.push('/')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!definitionId || !currentHomeId) return
    
    createMutation.mutate({
      item_definition_id: definitionId,
      quantity,
      expiry_date: expirationDate ? new Date(expirationDate).toISOString() : undefined
    })
  }

  if (!currentHomeId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-gray-500 mb-4">No home found. You need a home to add inventory.</div>
        <Button asChild>
          <Link href="/homes">Manage Homes</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild aria-label="Go back to dashboard" className="p-2 -ml-2 text-gray-500">
           <Link href="/">
             <ArrowLeft className="h-4 w-4" />
             <span className="sr-only">Back</span>
           </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <PackagePlus className="h-6 w-6 text-indigo-500" />
            Add Inventory Item
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader>
           <CardTitle>Item Details</CardTitle>
           <CardDescription>Select an item from definitions and specify the quantity.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="definition">Item Definition *</Label>
              <Select
                id="definition"
                value={definitionId}
                onChange={(e) => setDefinitionId(e.target.value)}
                required
              >
                <option value="">Select Item...</option>
                {itemDefs?.map(def => (
                  <option key={def.ID} value={def.ID}>{def.Name}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  required
                />
                {selectedDef?.SizeUnit?.Name && (
                  <span className="text-sm text-gray-500 whitespace-nowrap">
                    {selectedDef.SizeUnit.Name}
                  </span>
                )}
              </div>
            </div>

            {selectedDef?.IsExpirable && (
              <div className="space-y-2">
                <Label htmlFor="expiration">Expiration Date</Label>
                <Input
                  id="expiration"
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
              </div>
            )}

            <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
              <Button type="button" variant="outline" asChild>
                <Link href="/">Cancel</Link>
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !definitionId}
              >
                {createMutation.isPending ? 'Adding...' : 'Add Item'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function NewInventoryItem() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    }>
      <NewInventoryItemForm />
    </Suspense>
  )
}
