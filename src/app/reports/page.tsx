'use client';

import { useAuth } from '@/components/AuthProvider';
import { useHome } from '@/components/HomeProvider';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next'
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { PieChart as PieChartIcon, Package } from 'lucide-react';
import type { InventoryItem } from '@/types';

const COLORS = [
  '#4f46e5',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
  '#f97316',
];

export default function Reports() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { currentHomeId } = useHome();

  const { data: inventory, isPending: isInventoryPending } = useQuery({
    queryKey: ['inventory', currentHomeId],
    queryFn: async () => {
      const res = await api.get<InventoryItem[]>('/inventory', {
        headers: { 'X-Home-Id': currentHomeId },
      });
      return res.data;
    },
    enabled: !!currentHomeId && !!session,
  });

  const categoryData = useMemo(() => {
    if (!inventory) return [];
    const counts: Record<string, number> = {};
    inventory.forEach((item) => {
      const catName = item.ItemDefinition?.Category?.Name || t('reports.data.uncategorized');
      counts[catName] = (counts[catName] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [inventory, t]);

  const topItemsData = useMemo(() => {
    if (!inventory) return [];
    return [...inventory]
      .sort((a, b) => b.Quantity - a.Quantity)
      .slice(0, 5)
      .map((item) => ({
        name: item.ItemDefinition?.Name || t('reports.data.unknownItem'),
        quantity: item.Quantity,
        unit: item.ItemDefinition?.SizeUnit?.Name || '',
      }));
  }, [inventory, t]);

  const totalUniqueItems = inventory?.length || 0;
  const totalOverallQuantity = useMemo(
    () => inventory?.reduce((sum, item) => sum + item.Quantity, 0) || 0,
    [inventory],
  );

  if (!currentHomeId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 max-w-lg mx-auto text-center space-y-4">
        <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-full">
          <PieChartIcon className="h-12 w-12 text-indigo-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('reports.unavailable.title')}
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          {t('reports.unavailable.description')}
        </p>
        <Button asChild size="lg" className="mt-4">
          <Link href="/homes">{t('reports.unavailable.manageHomes')}</Link>
        </Button>
      </div>
    );
  }

  if (isInventoryPending) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!inventory || inventory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 max-w-lg mx-auto text-center space-y-4">
        <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-full">
          <Package className="h-12 w-12 text-indigo-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('reports.noData.title')}
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          {t('reports.noData.description')}
        </p>
        <Button asChild size="lg" className="mt-4">
          <Link href="/inventory/new">{t('reports.noData.addItem')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <PieChartIcon className="h-6 w-6 text-indigo-500" />
            {t('reports.title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {t('reports.description')}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('reports.stats.totalUniqueItems')}
            </CardTitle>
            <Package className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUniqueItems}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('reports.stats.totalUniqueItemsDesc')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('reports.stats.overallQuantity')}
            </CardTitle>
            <PieChartIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalOverallQuantity.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('reports.stats.overallQuantityDesc')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>{t('reports.charts.itemsByCategory')}</CardTitle>
            <CardDescription>
              {t('reports.charts.itemsByCategoryDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${((percent || 0) * 100).toFixed(0)}%`
                  }
                >
                  {categoryData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>{t('reports.charts.topItemsByQuantity')}</CardTitle>
            <CardDescription>
              {t('reports.charts.topItemsByQuantityDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topItemsData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e5e7eb"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  fontSize={12}
                  tickMargin={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  fontSize={12}
                  tickFormatter={(val) => `${val}`}
                />
                <RechartsTooltip
                  cursor={{ fill: "#f3f4f6" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 shadow-sm rounded-md text-sm">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            {data.name}
                          </p>
                          <p className="text-indigo-600 dark:text-indigo-400">
                            {data.quantity} {data.unit}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="quantity"
                  fill="#4f46e5"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
