'use client'

import { useTranslation } from 'react-i18next'
import { MaintenanceTaskList } from '@/components/MaintenanceTaskList'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Wrench } from 'lucide-react'

export default function MaintenanceDashboard() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Wrench className="h-6 w-6 text-indigo-500" />
            {t('maintenance.dashboardTitle')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {t('maintenance.description')}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('maintenance.upcomingTasks')}</CardTitle>
          <CardDescription>
            All maintenance tasks scheduled for items in this home.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MaintenanceTaskList showItemName={true} />
        </CardContent>
      </Card>
    </div>
  )
}
