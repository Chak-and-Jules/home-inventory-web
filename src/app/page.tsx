'use client'

import { useAuth } from '@/components/AuthProvider'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Package, Pencil, Trash2, Home as HomeIcon, PackagePlus } from 'lucide-react'

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
  Category?: Category
  SizeUnit?: SizeUnit
  IsExpirable: boolean
  ImageURL: string
}

type InventoryItem = {
  ID: string
  HomeID: string
  ItemDefinitionID: string
  Quantity: number
  ExpirationDate?: string
  ItemDefinition: ItemDefinition
}

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

export default function Dashboard() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  const { data: userHomes } = useQuery({
    queryKey: ['homes'],
    queryFn: async () => {
      const res = await api.get<UserHome[]>('/homes')
      return res.data
    },
    enabled: !!session,
  })

  const defaultHome = useMemo(() => userHomes?.find((h) => h.IsDefault) || userHomes?.[0], [userHomes])

  const { data: inventory, isLoading } = useQuery({
    queryKey: ['inventory', defaultHome?.HomeID],
    queryFn: async () => {
      const res = await api.get<InventoryItem[]>(`/inventory?home_id=${defaultHome?.HomeID}`)
      return res.data
    },
    enabled: !!defaultHome?.HomeID && !!session,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    }
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!defaultHome) {
    return (
      <div className="flex flex-col items-center justify-center py-12 max-w-lg mx-auto text-center space-y-4">
        <div className="bg-indigo-50 p-4 rounded-full">
           <HomeIcon className="h-12 w-12 text-indigo-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome to Home Inventory</h2>
        <p className="text-gray-500">You need to create a home before you can start managing inventory.</p>
        <Button asChild size="lg" className="mt-4">
          <Link href="/homes">Manage Homes</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <HomeIcon className="h-6 w-6 text-indigo-500" />
            {defaultHome.Home.Name}
          </h1>
          <p className="text-gray-500">Overview of your current inventory.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
             <Link href="/homes">Change Home</Link>
          </Button>
          <Button asChild>
            <Link href="/inventory/new">
               <PackagePlus className="h-4 w-4 mr-2" />
               Add Item
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-gray-100">
          <CardTitle>Current Inventory</CardTitle>
          <CardDescription>All items currently tracked in this home.</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]"></TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Expiration</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!inventory || inventory.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                    <Package className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                    <p className="font-medium text-gray-900">Inventory is empty</p>
                    <p className="text-sm mt-1 mb-4">Start by adding your first item to this home.</p>
                    <Button asChild variant="outline" size="sm">
                       <Link href="/inventory/new">Add Item</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              )}
              {inventory?.map((item) => (
                <TableRow key={item.ID}>
                  <TableCell>
                    {item.ItemDefinition?.ImageURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.ItemDefinition.ImageURL} alt="" className="w-8 h-8 rounded object-cover border border-gray-200" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-gray-50 border border-gray-200 flex items-center justify-center">
                        <Package className="h-4 w-4 text-gray-400" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">
                    {item.ItemDefinition?.Name}
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {item.ItemDefinition?.Category?.Name || '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {item.Quantity} <span className="text-gray-400 font-normal text-xs">{item.ItemDefinition?.SizeUnit?.Name}</span>
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {item.ExpirationDate ? new Date(item.ExpirationDate).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                     <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                          <Link href={`/inventory/edit/${item.ID}`}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this item?')) {
                              deleteMutation.mutate(item.ID)
                            }
                          }}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                     </div>
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
