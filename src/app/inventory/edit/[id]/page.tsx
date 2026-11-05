'use client'

import { useAuth } from '@/components/AuthProvider'
import { useHome } from '@/components/HomeProvider'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { InventoryItem } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { InventoryInlineForm } from '@/components/InventoryInlineForm'
import { ArrowLeft, PackageCheck } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MaintenanceTaskList } from '@/components/MaintenanceTaskList'
import { useTranslation } from 'react-i18next'

export default function EditInventoryItem() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  
  const { currentHomeId } = useHome()

  const { data: inventory, isPending, isError } = useQuery({
    queryKey: ['inventory', currentHomeId],
    queryFn: async () => {
      const res = await api.get('/inventory', { headers: { 'X-Home-Id': currentHomeId } })
      return res.data
    },
    enabled: !!currentHomeId && !!session,
  })

  const item = useMemo(() => inventory?.find((i: InventoryItem) => i.ID === id), [inventory, id])

  if (isPending) {
     return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (isError || !item) return <p role="alert">{t(isError ? 'ui.loadFailed' : 'ui.itemNotFound')}</p>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild aria-label={t('ui.goBackToDashboard')} className="p-2 -ml-2 text-gray-500">
           <Link href="/">
             <ArrowLeft className="h-4 w-4" />
             <span className="sr-only">{t('ui.back')}</span>
           </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <PackageCheck className="h-6 w-6 text-indigo-500" />{t('ui.editItem', { name: item.ItemDefinition.Name })}</h1>
        </div>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="details">{t('profile.tabs.profileInfo')}</TabsTrigger>
          <TabsTrigger value="maintenance">{t('maintenance.title')}</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
               <CardTitle>{item.ItemDefinition?.Name}</CardTitle>
               <CardDescription>{t('ui.updateTheQuantityOrExpirationDateForThisItem')}</CardDescription>
            </CardHeader>
            <CardContent>
              <InventoryInlineForm item={item} onClose={() => router.push('/')} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
           <MaintenanceTaskList inventoryItemId={id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
