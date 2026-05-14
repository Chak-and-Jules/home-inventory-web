'use client'

import { useAuth } from '@/components/AuthProvider'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'

type Home = {
  ID: string
  Name: string
}

type UserHome = {
  UserID: string
  HomeID: string
  Role: string
  IsDefault: boolean
  Home: Home
}

export default function Homes() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [newHomeName, setNewHomeName] = useState('')

  const { data: userHomes, isLoading } = useQuery({
    queryKey: ['homes'],
    queryFn: async () => {
      const res = await api.get<UserHome[]>('/homes')
      return res.data
    },
    enabled: !!session,
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post('/homes', { name }),
    onSuccess: () => {
      setNewHomeName('')
      queryClient.invalidateQueries({ queryKey: ['homes'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/homes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homes'] })
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to delete home')
    }
  })

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => api.post(`/homes/${id}/default`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homes'] })
    }
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (newHomeName.trim()) {
      createMutation.mutate(newHomeName)
    }
  }

  if (isLoading) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Manage Homes</h1>
        <Link href="/" className="text-indigo-600 hover:text-indigo-800">Back to Dashboard</Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
        <h2 className="text-xl font-semibold mb-4">Create New Home</h2>
        <form onSubmit={handleCreate} className="flex gap-4">
          <input
            type="text"
            value={newHomeName}
            onChange={(e) => setNewHomeName(e.target.value)}
            placeholder="Home Name"
            className="flex-1 px-4 py-2 border rounded-md"
            required
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </form>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {userHomes?.map((userHome) => (
            <li key={userHome.HomeID} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    {userHome.Home.Name}
                    {userHome.IsDefault && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Default</span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500">Role: {userHome.Role}</p>
                </div>
                <div className="flex gap-4 items-center">
                  {!userHome.IsDefault && (
                    <button
                      onClick={() => setDefaultMutation.mutate(userHome.HomeID)}
                      className="text-sm text-indigo-600 hover:text-indigo-900"
                    >
                      Set as Default
                    </button>
                  )}
                  
                  {(userHome.Role === 'owner' || userHome.Role === 'partner') && (
                    <Link
                      href={`/homes/users?home_id=${userHome.HomeID}`}
                      className="text-sm text-blue-600 hover:text-blue-900"
                    >
                      Manage Users
                    </Link>
                  )}

                  {userHome.Role === 'owner' && (
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this home?')) {
                          deleteMutation.mutate(userHome.HomeID)
                        }
                      }}
                      className="text-sm text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
          {(!userHomes || userHomes.length === 0) && (
            <li className="p-4 text-center text-gray-500">No homes found.</li>
          )}
        </ul>
      </div>
    </div>
  )
}
