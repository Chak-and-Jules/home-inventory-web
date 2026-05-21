'use client'
import { AxiosError } from 'axios';

import { AxiosError } from 'axios'
import { useAuth } from '@/components/AuthProvider'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AxiosError } from 'axios'

type Profile = {
  ID: string
  Email: string
}

type UserHome = {
  UserID: string
  HomeID: string
  Role: string
  User: Profile
}

function HomeUsersContent() {
  const { session } = useAuth()
  const searchParams = useSearchParams()
  const homeId = searchParams.get('home_id')
  const queryClient = useQueryClient()

  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('viewer')

  const { data: users, isLoading } = useQuery({
    queryKey: ['homeUsers', homeId],
    queryFn: async () => {
      const res = await api.get<UserHome[]>(`/homes/${homeId}/users`)
      return res.data
    },
    enabled: !!session && !!homeId,
  })

  const addMutation = useMutation({
    mutationFn: (data: { email: string, role: string }) => 
      api.post(`/homes/${homeId}/users`, data),
    onSuccess: () => {
      setNewEmail('')
      queryClient.invalidateQueries({ queryKey: ['homeUsers', homeId] })
    },
    onError: (err: unknown) => {
      alert((err as AxiosError<{ error?: string }>).response?.data?.error || 'Failed to add user')
    }
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => 
      api.delete(`/homes/${homeId}/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homeUsers', homeId] })
    },
    onError: (err: unknown) => {
      alert((err as AxiosError<{ error?: string }>).response?.data?.error || 'Failed to remove user')
    }
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string, role: string }) => 
      api.put(`/homes/${homeId}/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homeUsers', homeId] })
    },
    onError: (err: unknown) => {
      alert((err as AxiosError<{ error?: string }>).response?.data?.error || 'Failed to update role')
    }
  })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (newEmail.trim()) {
      addMutation.mutate({ email: newEmail, role: newRole })
    }
  }

  if (!homeId) return <div className="p-8">No home selected.</div>
  if (isLoading) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Manage Home Users</h1>
        <Link href="/homes" className="text-indigo-600 hover:text-indigo-800">Back to Homes</Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
        <h2 className="text-xl font-semibold mb-4">Add User to Home</h2>
        <form onSubmit={handleAdd} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">User Email</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-4 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full px-4 py-2 border rounded-md bg-white"
            >
              <option value="owner">Owner</option>
              <option value="partner">Partner (Co-owner)</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer (Read-only)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {addMutation.isPending ? 'Adding...' : 'Add'}
          </button>
        </form>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {users?.map((u) => (
            <li key={u.UserID} className="p-4 hover:bg-gray-50 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{u.User.Email || u.UserID}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-500">Role:</span>
                  <select
                    value={u.Role}
                    onChange={(e) => updateRoleMutation.mutate({ userId: u.UserID, role: e.target.value })}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="owner">Owner</option>
                    <option value="partner">Partner</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
              <button
                onClick={() => {
                  if (confirm('Remove user from home?')) {
                    removeMutation.mutate(u.UserID)
                  }
                }}
                className="text-red-600 hover:text-red-900 text-sm"
              >
                Remove
              </button>
            </li>
          ))}
          {(!users || users.length === 0) && (
            <li className="p-4 text-center text-gray-500">No users found.</li>
          )}
        </ul>
      </div>
    </div>
  )
}

export default function HomeUsers() {
  return (
    <Suspense fallback={<div className="p-8">Loading users...</div>}>
      <HomeUsersContent />
    </Suspense>
  )
}
