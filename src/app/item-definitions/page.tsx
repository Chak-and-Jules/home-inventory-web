'use client'

import { useAuth } from '@/components/AuthProvider'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Package, Plus, Trash2, Image as ImageIcon } from 'lucide-react'

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
    //
    mutationFn: (data: unknown) => api.post('/item-definitions', data),
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

  if (defsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Item Definitions</h1>
        <p className="text-gray-500">Define the types of items you want to track in your inventory.</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Create New Definition</CardTitle>
          <CardDescription>Add a new blueprint for items in your home.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Milk, Batteries"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sizeUnit">Size Unit *</Label>
              <Select
                id="sizeUnit"
                value={sizeUnitId}
                onChange={(e) => setSizeUnitId(e.target.value)}
                required
              >
                <option value="">Select Unit</option>
                {sizeUnits?.map(u => (
                  <option key={u.ID} value={u.ID}>{u.Name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category (Optional)</Label>
              <Select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">None</option>
                {categories?.map(c => (
                  <option key={c.ID} value={c.ID}>{c.Name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="image">Image URL (Optional)</Label>
              <Input
                id="image"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add some details about this item..."
              />
            </div>
            <div className="md:col-span-2 flex items-center justify-between mt-2 pt-4 border-t border-gray-100">
              <Label className="flex items-center gap-2 cursor-pointer font-normal text-gray-700">
                <input
                  type="checkbox"
                  checked={isExpirable}
                  onChange={(e) => setIsExpirable(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 h-4 w-4"
                />
                Has Expiration Date
              </Label>
              <Button
                type="submit"
                disabled={createMutation.isPending || !name.trim() || !sizeUnitId}
              >
                <Plus className="h-4 w-4 mr-2" />
                {createMutation.isPending ? 'Creating...' : 'Create Definition'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemDefs?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-gray-500">
                    <Package className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                    No item definitions found.
                  </TableCell>
                </TableRow>
              )}
              {itemDefs?.map((def) => (
                <TableRow key={def.ID}>
                  <TableCell>
                    {def.ImageURL ? (
                       <div className="relative h-10 w-10 rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                         {/* eslint-disable-next-line @next/next/no-img-element */}
                         <img src={def.ImageURL} alt={def.Name} className="object-cover w-full h-full" />
                       </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-50 border border-gray-200">
                        <ImageIcon className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-gray-900">{def.Name}</div>
                    {def.Description && (
                      <div className="text-xs text-gray-500 truncate max-w-[200px]">{def.Description}</div>
                    )}
                    {def.IsExpirable && (
                       <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 mt-1">
                        Expirable
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-500">{def.Category?.Name || '-'}</TableCell>
                  <TableCell className="text-gray-500">{def.SizeUnit?.Name || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Delete this item definition?')) {
                          deleteMutation.mutate(def.ID)
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
        </div>
      </Card>
    </div>
  )
}
