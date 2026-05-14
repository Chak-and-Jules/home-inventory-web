'use client'

import { useAuth } from '@/components/AuthProvider'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'

type Category = {
  ID: string
  Name: string
  ParentID: string | null
  Parent?: Category
}

export default function Categories() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string>('')

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get<Category[]>('/categories')
      return res.data
    },
    enabled: !!session,
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string, parent_id?: string }) => 
      api.post('/categories', data),
    onSuccess: () => {
      setName('')
      setParentId('')
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    }
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      createMutation.mutate({ 
        name, 
        parent_id: parentId || undefined 
      })
    }
  }

  if (isLoading) return <div className="p-8">Loading...</div>

  const parentCategories = categories?.filter(c => !c.ParentID) || []

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Manage Categories</h1>
        <Link href="/" className="text-indigo-600 hover:text-indigo-800">Back to Dashboard</Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
        <h2 className="text-xl font-semibold mb-4">Create New Category</h2>
        <form onSubmit={handleCreate} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border rounded-md"
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Category (Optional)</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full px-4 py-2 border rounded-md bg-white"
            >
              <option value="">None</option>
              {parentCategories.map(c => (
                <option key={c.ID} value={c.ID}>{c.Name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            Create
          </button>
        </form>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {categories?.map((cat) => (
            <li key={cat.ID} className="p-4 hover:bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{cat.Name}</h3>
                {cat.Parent && (
                  <p className="text-sm text-gray-500">Child of: {cat.Parent.Name}</p>
                )}
              </div>
              <button
                onClick={() => {
                  if (confirm('Delete this category?')) {
                    deleteMutation.mutate(cat.ID)
                  }
                }}
                className="text-red-600 hover:text-red-900"
              >
                Delete
              </button>
            </li>
          ))}
          {(!categories || categories.length === 0) && (
            <li className="p-4 text-center text-gray-500">No categories found.</li>
          )}
        </ul>
      </div>
    </div>
  )
}
