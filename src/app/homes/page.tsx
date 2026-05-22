'use client'

import { useAuth } from '@/components/AuthProvider'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Home as HomeIcon, CheckCircle2, Users, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AxiosError } from 'axios'

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
    mutationFn: (name: string) => api.post('/homes', { name: name.trim() }),
    onSuccess: () => {
      setNewHomeName('')
      queryClient.invalidateQueries({ queryKey: ['homes'] })
    },
    onError: (err: unknown) => {
      const axiosError = err as AxiosError<{ error?: string }>
      alert(axiosError.response?.data?.error || 'Failed to create home')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/homes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homes'] })
    },
    onError: (err: unknown) => {
      const axiosError = err as AxiosError<{ error?: string }>
      alert(axiosError.response?.data?.error || 'Failed to delete home')
    }
  })

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => api.post(`/homes/${id}/default`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homes'] })
    }
  })

  const handleCreate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = newHomeName.trim()
    if (name) {
      createMutation.mutate(name)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Homes</h1>
        <p className="text-gray-500">Manage the homes you belong to.</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Create New Home</CardTitle>
          <CardDescription>Add a new space to manage inventory for.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex gap-3">
            <Input
              type="text"
              value={newHomeName}
              onChange={(e) => setNewHomeName(e.target.value)}
              placeholder="e.g. Vacation House, Main Apartment"
              className="max-w-md"
              required
            />
            <Button type="submit" disabled={createMutation.isPending || !newHomeName.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {userHomes?.map((userHome) => (
          <Card key={userHome.HomeID} className={cn("flex flex-col transition-all hover:shadow-md", userHome.IsDefault && "border-indigo-200 ring-1 ring-indigo-100")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <HomeIcon className="h-5 w-5 text-indigo-500" />
                {userHome.Home.Name}
              </CardTitle>
              {userHome.IsDefault && (
                <CheckCircle2 className="h-5 w-5 text-indigo-600" />
              )}
            </CardHeader>
            <CardContent className="flex-1 pb-2">
              <div className="text-sm text-gray-500 capitalize">Role: {userHome.Role}</div>
            </CardContent>
            <div className="p-4 pt-0 mt-auto flex items-center gap-2 flex-wrap">
               {!userHome.IsDefault && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDefaultMutation.mutate(userHome.HomeID)}
                  className="bg-white border-gray-200 text-gray-700 hover:bg-gray-50 text-xs h-8"
                >
                  Set Default
                </Button>
              )}

              {(userHome.Role === 'owner' || userHome.Role === 'partner') && (
                <Button variant="outline" size="sm" asChild className="bg-white border-gray-200 text-gray-700 hover:bg-gray-50 text-xs h-8">
                  <Link href={`/homes/users?home_id=${userHome.HomeID}`}>
                    <Users className="h-3.5 w-3.5 mr-1.5" />
                    Users
                  </Link>
                </Button>
              )}

              {userHome.Role === 'owner' && (
                 <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this home?')) {
                      deleteMutation.mutate(userHome.HomeID)
                    }
                  }}
                  className="bg-white border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-xs h-8 ml-auto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </Card>
        ))}
        {(!userHomes || userHomes.length === 0) && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-200 rounded-xl">
            <HomeIcon className="mx-auto h-8 w-8 text-gray-400 mb-3" />
            <h3 className="text-sm font-medium text-gray-900">No homes</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new home.</p>
          </div>
        )}
      </div>
    </div>
  )
}
