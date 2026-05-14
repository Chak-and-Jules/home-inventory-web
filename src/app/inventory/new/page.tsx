'use client'

import { useAuth } from '@/components/AuthProvider'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type ItemDefinition = {
  ID: string
  Name: string
  IsExpirable: boolean
}

type UserHome = {
  HomeID: string
  IsDefault: boolean
}

export default function NewInventoryItem() {
  const { session } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  
  const [definitionId, setDefinitionId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [expirationDate, setExpirationDate] = useState('')

  const { data: userHomes } = useQuery({
    queryKey: ['homes'],
    queryFn: async () => {
      const res = await api.get<UserHome[]>('/homes')
      return res.data
    },
    enabled: !!session,
  })

  const defaultHomeId = useMemo(() => {
    const defaultHome = userHomes?.find(h => h.IsDefault) || userHomes?.[0]
    return defaultHome?.HomeID
  }, [userHomes])

  const { data: itemDefs } = useQuery({
    queryKey: ['itemDefs'],
    queryFn: async () => {
      const res = await api.get<ItemDefinition[]>('/item-definitions')
      return res.data
    },
    enabled: !!session,
  })

  const selectedDef = itemDefs?.find(d => d.ID === definitionId)

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post(`/inventory?home_id=${defaultHomeId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      router.push('/')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!definitionId || !defaultHomeId) return
    
    createMutation.mutate({
      item_definition_id: definitionId,
      quantity,
      expiration_date: expirationDate ? new Date(expirationDate).toISOString() : undefined
    })
  }

  if (!defaultHomeId) return <div className="p-8">No home found. Create a home first.</div>

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Add Inventory Item</h1>
        <Link href="/" className="text-indigo-600 hover:text-indigo-800">Back to Dashboard</Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Definition *</label>
            <select
              value={definitionId}
              onChange={(e) => setDefinitionId(e.target.value)}
              className="w-full px-4 py-2 border rounded-md bg-white"
              required
            >
              <option value="">Select Item</option>
              {itemDefs?.map(def => (
                <option key={def.ID} value={def.ID}>{def.Name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value))}
              className="w-full px-4 py-2 border rounded-md"
              required
            />
          </div>

          {selectedDef?.IsExpirable && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full px-4 py-2 border rounded-md"
              />
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={createMutation.isPending || !definitionId}
              className="w-full bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Add Item
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
