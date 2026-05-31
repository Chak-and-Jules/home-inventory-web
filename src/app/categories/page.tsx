'use client'

import { useAuth } from '@/components/AuthProvider'
import { useHome } from '@/components/HomeProvider'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Box, Plus, Trash2, FolderTree } from 'lucide-react'
import type { Category } from '@/types'

export default function Categories() {
  const { session } = useAuth()
  const { currentHomeId } = useHome()
  const queryClient = useQueryClient()
  const [newCatName, setNewCatName] = useState('')
  const [parentCatId, setParentCatId] = useState('')

  const { data: categories, isPending } = useQuery({
    queryKey: ['categories', currentHomeId],
    queryFn: async () => {
      const res = await api.get<Category[]>('/categories')
      return res.data
    },
    enabled: !!session && !!currentHomeId,
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string, parent_id?: string }) => api.post('/categories', data),
    onSuccess: () => {
      setNewCatName('')
      setParentCatId('')
      queryClient.invalidateQueries({ queryKey: ['categories', currentHomeId] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', currentHomeId] })
    }
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (newCatName.trim()) {
      createMutation.mutate({
        name: newCatName,
        parent_id: parentCatId || undefined
      })
    }
  }


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Categories</h1>
        <p className="text-gray-500">Organize your item definitions into categories and subcategories.</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Create New Category</CardTitle>
          <CardDescription>Add a new way to group your items.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2 w-full">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Dairy, Electronics"
                required
              />
            </div>
            <div className="flex-1 space-y-2 w-full">
              <Label htmlFor="parent">Parent Category (Optional)</Label>
              <Select
                id="parent"
                value={parentCatId}
                onChange={(e) => setParentCatId(e.target.value)}
              >
                <option value="">None (Top Level)</option>
                {categories?.map(c => (
                  <option key={c.ID} value={c.ID}>{c.Name}</option>
                ))}
              </Select>
            </div>
            <Button
              type="submit"
              disabled={createMutation.isPending || !newCatName.trim()}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category Name</TableHead>
              <TableHead>Hierarchy</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {isPending && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 rounded-full animate-pulse bg-indigo-200"></div>
                      <div className="w-4 h-4 rounded-full animate-pulse bg-indigo-300"></div>
                      <div className="w-4 h-4 rounded-full animate-pulse bg-indigo-400"></div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            {!isPending && categories?.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-12 text-gray-500">
                  <Box className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                  No categories found.
                </TableCell>
              </TableRow>
            )}
            {categories?.map((cat) => (
              <TableRow key={cat.ID}>
                <TableCell className="font-medium text-gray-900">
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-gray-400" />
                    {cat.Name}
                  </div>
                </TableCell>
                <TableCell className="text-gray-500">
                  {cat.Parent ? (
                    <div className="flex items-center gap-1.5 text-sm">
                      <FolderTree className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-gray-400">{cat.Parent.Name}</span>
                      <span className="text-gray-300">/</span>
                      <span className="text-gray-700">{cat.Name}</span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                      Top Level
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Delete this category?')) {
                        deleteMutation.mutate(cat.ID)
                      }
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 -mr-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
