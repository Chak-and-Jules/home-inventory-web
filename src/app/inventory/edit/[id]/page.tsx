'use client'

import { useAuth } from '@/components/AuthProvider'
import { useHome } from '@/components/HomeProvider'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { InventoryItem } from '@/types'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, PackageCheck } from 'lucide-react'

export default function EditInventoryItem() {
  const { session } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const queryClient = useQueryClient()
  
  const { currentHomeId } = useHome()

  const { data: inventory } = useQuery({
    queryKey: ['inventory', currentHomeId],
    queryFn: async () => {
      const res = await api.get('/inventory')
      return res.data
    },
    enabled: !!currentHomeId && !!session,
  })

  const item = useMemo(() => inventory?.find((i: InventoryItem) => i.ID === id), [inventory, id])

  // Initialize state directly from item if it exists
  const [quantity, setQuantity] = useState<number | ''>('')
  const [expirationDate, setExpirationDate] = useState('')
  const [initialized, setInitialized] = useState(false)

  // Use a ref-like pattern to initialize once without useEffect cascading renders
  if (item && !initialized) {
    setQuantity(item.Quantity)
    if (item.ExpirationDate) {
      setExpirationDate(new Date(item.ExpirationDate).toISOString().split('T')[0])
    }
    setInitialized(true)
  }

  const updateMutation = useMutation({
    mutationFn: (data: unknown) => api.put(`/inventory/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      router.push('/')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (quantity === '') return
    
    updateMutation.mutate({
      quantity: Number(quantity),
      expiration_date: expirationDate ? new Date(expirationDate).toISOString() : undefined
    })
  }

  if (!item && initialized) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-gray-500 mb-4">Item not found.</div>
        <Button asChild>
          <Link href="/">Return to Dashboard</Link>
        </Button>
      </div>
    )
  }

  if (!item) {
     return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild className="p-2 -ml-2 text-gray-500">
           <Link href="/">
             <ArrowLeft className="h-4 w-4" />
             <span className="sr-only">Back</span>
           </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <PackageCheck className="h-6 w-6 text-indigo-500" />
            Edit Item
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader>
           <CardTitle>{item.ItemDefinition?.Name}</CardTitle>
           <CardDescription>Update the quantity or expiration date for this item.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            {item.ItemDefinition?.IsExpirable && (
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
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Updating...' : 'Update Item'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
