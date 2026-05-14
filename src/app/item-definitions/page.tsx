'use client'

import { useAuth } from '@/components/AuthProvider'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'

type Category = {
  ID: string
  Name: string
}

type SizeUnit = {
  ID: string
  Name: string
}

type ItemDefinition = {
  ID: string
  Name: string
  Description: string
  CategoryID?: string
  Category?: Category
  SizeUnitID?: string
  SizeUnit?: SizeUnit
  IsExpirable: boolean
  ImageURL: string
}

export default function ItemDefinitions() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [sizeUnitId, setSizeUnitId] = useState('')
  const [isExpirable, setIsExpirable] = useState(false)
  const [imageUrl, setImageUrl] = useState('')

  const { data: itemDefs, isLoading: defsLoading } = useQuery({
    queryKey: ['itemDefs'],
    queryFn: async () => {
      const res = await api.get<ItemDefinition[]>('/item-definitions')
      return res.data
    },
    enabled: !!session,
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get<Category[]>('/categories')
      return res.data
    },
    enabled: !!session,
  })

  const { data: sizeUnits } = useQuery({
    queryKey: ['sizeUnits'],
    queryFn: async () => {
      const res = await api.get<SizeUnit[]>('/size-units')
      return res.data
    },
    enabled: !!session,
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/item-definitions', data),
    onSuccess: () => {
      setName('')
      setDescription('')
      setCategoryId('')
      setSizeUnitId('')
      setIsExpirable(false)
      setImageUrl('')
      queryClient.invalidateQueries({ queryKey: ['itemDefs'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/item-definitions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itemDefs'] })
    }
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !sizeUnitId) return
    
    createMutation.mutate({
      name,
      description,
      category_id: categoryId || undefined,
      size_unit_id: sizeUnitId,
      is_expirable: isExpirable,
      image_url: imageUrl
    })
  }

  if (defsLoading) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Item Definitions</h1>
        <Link href="/" className="text-indigo-600 hover:text-indigo-800">Back to Dashboard</Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
        <h2 className="text-xl font-semibold mb-4">Create New Definition</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Size Unit *</label>
            <select
              value={sizeUnitId}
              onChange={(e) => setSizeUnitId(e.target.value)}
              className="w-full px-4 py-2 border rounded-md bg-white"
              required
            >
              <option value="">Select Unit</option>
              {sizeUnits?.map(u => (
                <option key={u.ID} value={u.ID}>{u.Name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category (Optional)</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-2 border rounded-md bg-white"
            >
              <option value="">None</option>
              {categories?.map(c => (
                <option key={c.ID} value={c.ID}>{c.Name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (Optional)</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-4 py-2 border rounded-md"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border rounded-md"
              rows={2}
            />
          </div>
          <div className="md:col-span-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={isExpirable}
                onChange={(e) => setIsExpirable(e.target.checked)}
                className="rounded text-indigo-600"
              />
              Has Expiration Date
            </label>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Create Definition
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {itemDefs?.map((def) => (
            <li key={def.ID} className="p-4 hover:bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {def.ImageURL && (
                  <img src={def.ImageURL} alt={def.Name} className="w-12 h-12 object-cover rounded-md" />
                )}
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{def.Name}</h3>
                  <div className="text-sm text-gray-500">
                    Category: {def.Category?.Name || 'None'} | 
                    Unit: {def.SizeUnit?.Name || 'Unknown'} | 
                    Expirable: {def.IsExpirable ? 'Yes' : 'No'}
                  </div>
                  {def.Description && (
                    <p className="text-sm text-gray-600 mt-1">{def.Description}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  if (confirm('Delete this item definition?')) {
                    deleteMutation.mutate(def.ID)
                  }
                }}
                className="text-red-600 hover:text-red-900"
              >
                Delete
              </button>
            </li>
          ))}
          {(!itemDefs || itemDefs.length === 0) && (
            <li className="p-4 text-center text-gray-500">No item definitions found.</li>
          )}
        </ul>
      </div>
    </div>
  )
}
