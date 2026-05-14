'use client'

import { useAuth } from '@/components/AuthProvider'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'

type ItemDefinition = {
  ID: string
  Name: string
  IsExpirable: boolean
}

type InventoryItem = {
  ID: string
  HomeID: string
  ItemDefinitionID: string
  Quantity: number
  ExpirationDate?: string
  ItemDefinition: ItemDefinition
}

export default function EditInventoryItem() {
  const { session } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const queryClient = useQueryClient()
  
  const [quantity, setQuantity] = useState<number | ''>('')
  const [expirationDate, setExpirationDate] = useState('')

  // We need to fetch the current homes to get defaultHomeId for query caching purposes, 
  // though we could also just fetch the specific item. Let's just fetch the specific item.
  
  // Actually, there is no GET /inventory/:id endpoint on backend. Let's fetch all inventory for default home
  // and find it. Or I could add a GET endpoint. Since we don't know the home_id offhand without an endpoint, 
  // I will just get all homes and then all inventory for that home.
  // Wait, I can just use the query cache or fetch all. 

  // Since time is limited, I will fetch homes -> find default -> fetch inventory -> find item
  const { data: userHomes } = useQuery({
    queryKey: ['homes'],
    queryFn: async () => {
      const res = await api.get('/homes')
      return res.data
    },
    enabled: !!session,
  })

  const defaultHomeId = useMemo(() => {
    const defaultHome = userHomes?.find((h: any) => h.IsDefault) || userHomes?.[0]
    return defaultHome?.HomeID
  }, [userHomes])

  const { data: inventory } = useQuery({
    queryKey: ['inventory', defaultHomeId],
    queryFn: async () => {
      const res = await api.get(`/inventory?home_id=${defaultHomeId}`)
      return res.data
    },
    enabled: !!defaultHomeId && !!session,
  })

  const item = inventory?.find((i: InventoryItem) => i.ID === id)

  useEffect(() => {
    if (item) {
      setQuantity(item.Quantity)
      if (item.ExpirationDate) {
        setExpirationDate(new Date(item.ExpirationDate).toISOString().split('T')[0])
      }
    }
  }, [item])

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put(`/inventory/${id}`, data),
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

  if (!item) return <div className="p-8">Loading or Item not found...</div>

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Edit Item: {item.ItemDefinition?.Name}</h1>
        <Link href="/" className="text-indigo-600 hover:text-indigo-800">Back to Dashboard</Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
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

          {item.ItemDefinition?.IsExpirable && (
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
              disabled={updateMutation.isPending}
              className="w-full bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Update Item
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
