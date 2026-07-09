'use client'

import { AxiosError } from 'axios';
import { useAuth } from '@/components/AuthProvider'
import { useHome } from '@/components/HomeProvider'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { Trash2, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { UserHome } from '@/types'

function HomeUsersContent() {
  const { session } = useAuth()
  const { currentHomeId: homeId } = useHome()
  const queryClient = useQueryClient()

  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('viewer')

  const { data: users, isPending } = useQuery({
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

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Manage Home Users</h1>
        <Link href="/homes" className="text-indigo-600 hover:text-indigo-800">Back to Homes</Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
        <h2 className="text-xl font-semibold mb-4">Add User to Home</h2>
        <form onSubmit={handleAdd} className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="newEmail" className="mb-2 block">User Email</Label>
            <Input
              id="newEmail"
              type="email"
              value={newEmail}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>
          <div className="w-48">
            <Label htmlFor="newRole" className="mb-2 block">Role</Label>
            <Select
              id="newRole"
              value={newRole}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewRole(e.target.value)}
            >
              <option value="viewer">Viewer (Read-only)</option>
              <option value="editor">Editor</option>
              <option value="owner">Owner</option>
            </Select>
          </div>
          <Button
            type="submit"
            disabled={addMutation.isPending}
            className="w-24 mb-1"
          >
            {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : '+ Add'}
          </Button>
        </form>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {isPending && (
            <li className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                 <div className="w-4 h-4 rounded-full animate-pulse bg-indigo-200"></div>
                 <div className="w-4 h-4 rounded-full animate-pulse bg-indigo-300"></div>
                 <div className="w-4 h-4 rounded-full animate-pulse bg-indigo-400"></div>
              </div>
            </li>
          )}
          {!isPending && users?.length === 0 && (
             <li className="p-8 text-center text-gray-500">No users found.</li>
          )}
          {users?.map((u) => (
            <li key={u.UserID} className="p-4 hover:bg-gray-50 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{u.User?.email || u.UserID}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Label htmlFor={`role-${u.UserID}`} className="text-sm text-gray-500 font-normal">Role:</Label>
                  <Select
                    id={`role-${u.UserID}`}
                    value={u.Role.toLowerCase()}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateRoleMutation.mutate({ userId: u.UserID, role: e.target.value })}
                    disabled={updateRoleMutation.isPending && updateRoleMutation.variables?.userId === u.UserID}
                    className="w-32"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="owner">Owner</option>
                  </Select>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm('Remove user from home?')) {
                    removeMutation.mutate(u.UserID)
                  }
                }}
                disabled={removeMutation.isPending && removeMutation.variables === u.UserID}
                aria-label={`Remove user ${u.User?.email || u.UserID}`}
                className="text-red-600 hover:text-red-900 hover:bg-red-50 focus-visible:ring-2"
              >
                {removeMutation.isPending && removeMutation.variables === u.UserID ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove
                  </>
                )}
              </Button>
            </li>
          ))}
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
