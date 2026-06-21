'use client'
import { useSignedUrls } from '@/hooks/useSignedUrls'

import { useAuth } from '@/components/AuthProvider'
import { useHome } from '@/components/HomeProvider'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Package, Pencil, Trash2, Home as HomeIcon, PackagePlus } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Printer, Download } from "lucide-react"
import type { UserHome, InventoryItem, AlmostFinishedItemResponse } from '@/types'

export default function Dashboard() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const { currentHomeId } = useHome()

  // Fetch home details (or rely on homes query if we want to show the name)
  const { data: userHomes, isPending: isHomesPending } = useQuery({
    queryKey: ['homes'],
    queryFn: async () => {
      const res = await api.get('/homes')
      return res.data
    },
    enabled: !!session,
  })

  const defaultHome = useMemo(() => userHomes?.find((h: UserHome) => h.HomeID === currentHomeId), [userHomes, currentHomeId])


  const { data: inventory, isPending: isInventoryPending } = useQuery({
    queryKey: ['inventory', currentHomeId],
    queryFn: async () => {
      const res = await api.get<InventoryItem[]>('/inventory', { headers: { 'X-Home-Id': currentHomeId } })
      return res.data
    },
    enabled: !!currentHomeId && !!session,
  })

  // Memoize image paths to prevent recreating the array on every render
  const imagePaths = useMemo(() => inventory?.map(d => d.ItemDefinition?.ImageURL) || [], [inventory])
  const { data: signedUrls } = useSignedUrls(imagePaths)

  const { data: almostFinished, isPending: isAlmostFinishedPending } = useQuery({
    queryKey: ['almost-finished', currentHomeId],
    queryFn: async () => {
      const res = await api.get<AlmostFinishedItemResponse[]>('/inventory/almost-finished', { headers: { 'X-Home-Id': currentHomeId } })
      return res.data
    },
    enabled: !!currentHomeId && !!session,
  })

  const criticalItemsCount = useMemo(() => {
    if (!almostFinished) return 0;
    return almostFinished.filter(item => item.estimated_days_left !== undefined && item.estimated_days_left !== null && item.estimated_days_left < 3).length;
  }, [almostFinished])



  const handleExportAlmostFinished = () => {
    if (!almostFinished || almostFinished.length === 0) return;

    const headers = ["Item Name", "Current Quantity", "Reason", "Estimated Days Left"];
    const rows = almostFinished.map(item => [
      item.item_definition.Name,
      item.total_quantity.toString(),
      item.reason,
      item.estimated_days_left?.toString() ?? "N/A"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `almost_finished_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/${id}`, { headers: { 'X-Home-Id': currentHomeId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    }
  })

  if (isHomesPending) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!isHomesPending && !defaultHome) {
    return (
      <div className="flex flex-col items-center justify-center py-12 max-w-lg mx-auto text-center space-y-4">
        <div className="bg-indigo-50 p-4 rounded-full">
           <HomeIcon className="h-12 w-12 text-indigo-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome to Talo Box</h2>
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
          <Button asChild>
            <Link href="/inventory/new">
               <PackagePlus className="h-4 w-4 mr-2" />
               Add Item
            </Link>
          </Button>
        </div>
      </div>


      <Tabs defaultValue="inventory" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="almost-finished" className="relative">
              Almost Finished
              {criticalItemsCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                  {criticalItemsCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="inventory">
          <Card>
            <CardHeader className="pb-4 border-b border-gray-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl">Inventory List</CardTitle>
                <CardDescription>Items currently in your home.</CardDescription>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                    <TableHead className="w-16 rounded-tl-lg"></TableHead>
                    <TableHead className="font-semibold text-gray-900">Name</TableHead>
                    <TableHead className="font-semibold text-gray-900">Category</TableHead>
                    <TableHead className="font-semibold text-gray-900 text-right">Quantity</TableHead>
                    <TableHead className="font-semibold text-gray-900">Expires</TableHead>
                    <TableHead className="w-24 text-right rounded-tr-lg">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isInventoryPending ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-gray-500">
                        Loading inventory...
                      </TableCell>
                    </TableRow>
                  ) : !inventory || inventory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-48 text-center bg-gray-50/30 rounded-b-lg">
                        <div className="flex flex-col items-center justify-center text-gray-500 space-y-3">
                          <Package className="h-10 w-10 text-gray-300" />
                          <p>No items found in your inventory.</p>
                          <Button asChild variant="outline" size="sm">
                            <Link href="/inventory/new">Add your first item</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    inventory.map((item) => (
                      <TableRow key={item.ID} className="group hover:bg-gray-50 transition-colors">
                        <TableCell className="p-4">
                          {item.ItemDefinition.ImageURL ? (
                             <div className="w-10 h-10 rounded-md bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                               <img
                                 src={signedUrls[item.ItemDefinition.ImageURL] || item.ItemDefinition.ImageURL}
                                 alt={item.ItemDefinition.Name}
                                 className="w-full h-full object-cover"
                               />
                             </div>
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 text-indigo-300" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-gray-900">
                          {item.ItemDefinition.Name}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {item.ItemDefinition.Category?.Name || '—'}
                        </TableCell>
                        <TableCell className="text-right text-gray-700 font-medium">
                          {item.Quantity} {item.ItemDefinition.SizeUnit?.Name || ''}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {item.ExpirationDate ? new Date(item.ExpirationDate).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-right p-4">
                          <div className="flex justify-end items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-blue-600 hover:bg-blue-50">
                               <Link href={`/inventory/edit/${item.ID}`} aria-label={`Edit ${item.ItemDefinition.Name}`}>
                                 <Pencil className="h-4 w-4" />
                               </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50 ml-1"
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this item?')) {
                                  deleteMutation.mutate(item.ID)
                                }
                              }}
                              aria-label={`Delete ${item.ItemDefinition.Name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="almost-finished">
          <Card>
            <CardHeader className="pb-4 border-b border-gray-100 flex flex-row items-center justify-between print:hidden">
              <div>
                <CardTitle className="text-xl">Almost Finished Items</CardTitle>
                <CardDescription>Items running low that you might need to restock.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportAlmostFinished}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                    <TableHead className="font-semibold text-gray-900 rounded-tl-lg">Item Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 text-right">Current Quantity</TableHead>
                    <TableHead className="font-semibold text-gray-900">Reason</TableHead>
                    <TableHead className="font-semibold text-gray-900 text-right">Est. Days Left</TableHead>
                    <TableHead className="w-32 text-right rounded-tr-lg print:hidden">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isAlmostFinishedPending ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-gray-500">
                        Loading almost finished items...
                      </TableCell>
                    </TableRow>
                  ) : !almostFinished || almostFinished.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-gray-500 bg-gray-50/30 rounded-b-lg">
                        You&apos;re well stocked! No items are currently running low.
                      </TableCell>
                    </TableRow>
                  ) : (
                    almostFinished.map((item) => (
                      <TableRow key={item.item_definition.ID} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-medium text-gray-900">
                          {item.item_definition.Name}
                        </TableCell>
                        <TableCell className="text-right text-gray-700">
                          {item.total_quantity} {item.item_definition.SizeUnit?.Name || ''}
                        </TableCell>
                        <TableCell className="text-gray-700">
                          {item.reason}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.estimated_days_left !== undefined && item.estimated_days_left !== null ? (
                            <span className={item.estimated_days_left < 3 ? "text-red-600 font-bold" : "text-amber-600"}>
                              {item.estimated_days_left}
                            </span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right print:hidden">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/inventory/new?itemDefId=${item.item_definition.ID}`}>
                              Restock
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  )
}
