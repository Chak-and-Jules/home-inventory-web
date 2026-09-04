'use client';
import { useSignedUrls } from '@/hooks/useSignedUrls';

import { useAuth } from '@/components/AuthProvider';
import { useHome } from '@/components/HomeProvider';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Package,
  Pencil,
  Trash2,
  Home as HomeIcon,
  PackagePlus,
  AlertCircle,
  AlertTriangle,
  Scan,
  Sparkles,
  X,
  Search,
  Check,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Printer, Download, ArrowUp, ArrowDown } from 'lucide-react';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { getExpiryStatus } from '@/lib/inventoryUtils';
import type {
  UserHome,
  InventoryItem,
  AlmostFinishedItemResponse,
  ItemDefinition,
  ProductLookupResponse,
  RestockInsight,
  Category,
} from '@/types';

export default function Dashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { currentHomeId } = useHome();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'expired' | 'expiring_soon'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [inventorySort, setInventorySort] = useState<'newest' | 'expiry'>('newest');

  const [editingQuantityId, setEditingQuantityId] = useState<string | null>(null);
  const [editingQuantityValue, setEditingQuantityValue] = useState<string>('');

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedMobileItem, setSelectedMobileItem] = useState<InventoryItem | null>(null);

  const [shoppingWindowDays, setShoppingWindowDays] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('shoppingWindowDays');
      if (stored) return Number(stored);
    }
    return 7;
  });

  const [dismissedItemIds, setDismissedItemIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dismissedRestockInsights');
      if (stored) {
        try { return JSON.parse(stored); } catch { return []; }
      }
    }
    return [];
  });

  const handleSetShoppingWindowDays = (days: number) => {
    setShoppingWindowDays(days);
    if (typeof window !== 'undefined') {
      localStorage.setItem('shoppingWindowDays', days.toString());
      window.dispatchEvent(new Event('shoppingWindowDaysChanged'));
    }
  };

  const handleDismissRestock = (id: string) => {
    setDismissedItemIds((prev) => {
      const next = [...prev, id];
      if (typeof window !== 'undefined') {
        localStorage.setItem('dismissedRestockInsights', JSON.stringify(next));
        window.dispatchEvent(new Event('dismissedRestockInsightsChanged'));
      }
      return next;
    });
  };

  // Sync state via custom events
  useEffect(() => {
    const sync = () => {
      const storedWindow = localStorage.getItem('shoppingWindowDays');
      if (storedWindow) setShoppingWindowDays(Number(storedWindow));
      const storedDismissed = localStorage.getItem('dismissedRestockInsights');
      if (storedDismissed) {
        try { setDismissedItemIds(JSON.parse(storedDismissed)); } catch {}
      }
    };
    window.addEventListener('shoppingWindowDaysChanged', sync);
    window.addEventListener('dismissedRestockInsightsChanged', sync);
    return () => {
      window.removeEventListener('shoppingWindowDaysChanged', sync);
      window.removeEventListener('dismissedRestockInsightsChanged', sync);
    };
  }, []);

  const { data: userHomes, isPending: isHomesPending } = useQuery({
    queryKey: ['homes'],
    queryFn: async () => {
      const res = await api.get('/homes');
      return res.data;
    },
    enabled: !!session,
  });

  const defaultHome = useMemo(
    () => userHomes?.find((h: UserHome) => h.HomeID === currentHomeId),
    [userHomes, currentHomeId],
  );

  const { data: categories } = useQuery({
    queryKey: ['categories', currentHomeId],
    queryFn: async () => {
      const res = await api.get<Category[]>('/categories', {
        headers: { 'X-Home-Id': currentHomeId },
      });
      return res.data;
    },
    enabled: !!currentHomeId && !!session,
  });

  const { data: inventory, isPending: isInventoryPending } = useQuery({
    queryKey: ['inventory', currentHomeId, inventoryFilter, inventorySort],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (inventoryFilter !== 'all') {
        params.append('filter', inventoryFilter);
      }
      if (inventorySort === 'expiry') {
        params.append('sort', 'expiry');
      }

      const res = await api.get<InventoryItem[]>(`/inventory?${params.toString()}`, {
        headers: { 'X-Home-Id': currentHomeId },
      });
      return res.data;
    },
    enabled: !!currentHomeId && !!session,
  });

  const { data: restockInsights, isPending: isInsightsPending } = useQuery({
    queryKey: ['restock-insights', currentHomeId],
    queryFn: async () => {
      const res = await api.get<RestockInsight[]>('/inventory/insights/restock', {
        headers: { 'X-Home-Id': currentHomeId },
      });
      return res.data;
    },
    enabled: !!currentHomeId && !!session,
  });

  const acceptRestockMutation = useMutation({
    mutationFn: (item: RestockInsight) => {
      const qty = Math.max(1, (item.item_definition.target_quantity || 1) - item.current_stock);
      return api.post('/shopping-list', {
        item_definition_id: item.item_definition.ID,
        name: item.item_definition.Name,
        quantity: qty
      }, {
        headers: { 'X-Home-Id': currentHomeId }
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
      handleDismissRestock(variables.item_definition.ID);
    }
  });

  const filteredInsights = useMemo(() => {
    if (!restockInsights) return [];
    return restockInsights.filter((item) => {
      const isWithinWindow = item.days_left <= shoppingWindowDays;
      const isDismissed = dismissedItemIds.includes(item.item_definition.ID);
      return isWithinWindow && !isDismissed;
    });
  }, [restockInsights, shoppingWindowDays, dismissedItemIds]);

  const filteredInsightsCount = useMemo(() => {
    return filteredInsights.length;
  }, [filteredInsights]);

  // Helper map for Category parent-child relationship display ("Parent > Child")
  const categoryMapById = useMemo(() => {
    const map = new Map<string, Category>();
    if (categories) {
      categories.forEach((cat) => map.set(cat.ID, cat));
    }
    return map;
  }, [categories]);

  const getCategoryDisplayName = (category?: Category | null): string => {
    if (!category) return '—';
    if (category.ParentID && categoryMapById.has(category.ParentID)) {
      const parentName = categoryMapById.get(category.ParentID)?.Name;
      if (parentName) {
        return `${parentName} > ${category.Name}`;
      }
    }
    if (category.Parent?.Name) {
      return `${category.Parent.Name} > ${category.Name}`;
    }
    return category.Name;
  };

  // Build hierarchical category dropdown options for filtering
  const hierarchicalCategoryOptions = useMemo(() => {
    if (!categories || categories.length === 0) return [];

    const categoryGroups = new Map<string, Category[]>();
    categories.forEach((cat) => {
      const parentId = cat.ParentID || 'root';
      if (!categoryGroups.has(parentId)) {
        categoryGroups.set(parentId, []);
      }
      categoryGroups.get(parentId)!.push(cat);
    });

    const topCategories = (categoryGroups.get('root') || []).sort((a, b) =>
      a.Name.localeCompare(b.Name)
    );

    const options: { id: string; label: string }[] = [];
    const addedIds = new Set<string>();

    topCategories.forEach((topCat) => {
      options.push({ id: topCat.ID, label: `- ${topCat.Name}` });
      addedIds.add(topCat.ID);
      const children = (categoryGroups.get(topCat.ID) || []).sort((a, b) =>
        a.Name.localeCompare(b.Name)
      );
      children.forEach((childCat) => {
        options.push({ id: childCat.ID, label: `  ${childCat.Name}` });
        addedIds.add(childCat.ID);
      });
    });

    // Also include any orphan categories whose parent ID was not found in 'root'
    categories.forEach((cat) => {
      if (
        cat.ParentID &&
        !categoryMapById.has(cat.ParentID) &&
        !addedIds.has(cat.ID)
      ) {
        options.push({ id: cat.ID, label: `- ${cat.Name}` });
        addedIds.add(cat.ID);
      }
    });

    return options;
  }, [categories, categoryMapById]);

  // Search and Category Filtered Inventory
  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    let result = inventory;

    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter((item) =>
        item.ItemDefinition?.Name?.toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== 'all') {
      result = result.filter(
        (item) => item.ItemDefinition?.CategoryID === categoryFilter
      );
    }

    return result;
  }, [inventory, debouncedSearchQuery, categoryFilter]);

  // Memoize image paths to prevent recreating the array on every render
  const imagePaths = useMemo(() => {
    // Fast O(N) deduplication as per memory guidelines without intermediate allocations
    const seen = new Set<string>();
    const unique = [];

    if (inventory) {
      for (let i = 0; i < inventory.length; i++) {
        const p = inventory[i].ItemDefinition?.ImageURL;
        if (p && !seen.has(p)) {
          seen.add(p);
          unique.push(p);
        }
      }
    }

    if (restockInsights) {
      for (let i = 0; i < restockInsights.length; i++) {
        const p = restockInsights[i].item_definition?.ImageURL;
        if (p && !seen.has(p)) {
          seen.add(p);
          unique.push(p);
        }
      }
    }

    return unique;
  }, [inventory, restockInsights]);
  const { data: signedUrls } = useSignedUrls(imagePaths);

  const { data: almostFinished, isPending: isAlmostFinishedPending } = useQuery(
    {
      queryKey: ['almost-finished', currentHomeId],
      queryFn: async () => {
        const res = await api.get<AlmostFinishedItemResponse[]>(
          '/inventory/almost-finished',
          { headers: { 'X-Home-Id': currentHomeId } },
        );
        return res.data;
      },
      enabled: !!currentHomeId && !!session,
    },
  );

  const { data: expiringItems, isPending: isExpiringPending } = useQuery({
    queryKey: ['expiring-inventory', currentHomeId],
    queryFn: async () => {
      const res = await api.get<InventoryItem[]>('/inventory/expiring', {
        headers: { 'X-Home-Id': currentHomeId },
      });
      return res.data;
    },
    enabled: !!currentHomeId && !!session,
  });

  const criticalItemsCount = useMemo(() => {
    if (!almostFinished) return 0;
    let count = 0;
    for (let i = 0; i < almostFinished.length; i++) {
      const item = almostFinished[i];
      if (
        item.estimated_days_left !== undefined &&
        item.estimated_days_left !== null &&
        item.estimated_days_left < 3
      ) {
        count++;
      }
    }
    return count;
  }, [almostFinished]);

  const handleExportAlmostFinished = () => {
    if (!almostFinished || almostFinished.length === 0) return;

    const headers = [
      'Item Name',
      'Current Quantity',
      'Reason',
      'Estimated Days Left',
    ];
    const rows = almostFinished.map((item) => [
      item.item_definition.Name,
      item.total_quantity.toString(),
      item.reason,
      item.estimated_days_left?.toString() ?? 'N/A',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `'${cell}'`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `almost_finished_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateQuantityMutation = useMutation({
    mutationFn: ({ id, quantity, expiryDate }: { id: string; quantity: number; expiryDate?: string }) =>
      api.put(
        `/inventory/${id}`,
        {
          quantity,
          expiry_date: expiryDate ? new Date(expiryDate).toISOString() : undefined,
        },
        { headers: { 'X-Home-Id': currentHomeId } }
      ),
    onSuccess: () => {
      setEditingQuantityId(null);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  const handleStartEditingQuantity = (item: InventoryItem) => {
    setEditingQuantityId(item.ID);
    setEditingQuantityValue(item.Quantity.toString());
  };

  const handleSaveQuantity = (item: InventoryItem) => {
    const newQty = parseFloat(editingQuantityValue);
    if (isNaN(newQty) || newQty < 0) {
      setEditingQuantityId(null);
      return;
    }
    updateQuantityMutation.mutate({
      id: item.ID,
      quantity: newQty,
      expiryDate: item.ExpirationDate,
    });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/inventory/${id}`, {
        headers: { "X-Home-Id": currentHomeId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  if (isHomesPending) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isHomesPending && !defaultHome) {
    return (
      <div className="flex flex-col items-center justify-center py-12 max-w-lg mx-auto text-center space-y-4">
        <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-full">
          <HomeIcon className="h-12 w-12 text-indigo-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Welcome to Talo Box
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          You need to create a home before you can start managing inventory.
        </p>
        <Button asChild size="lg" className="mt-4">
          <Link href="/homes">Manage Homes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <HomeIcon className="h-6 w-6 text-indigo-500" />
            {defaultHome.Home.Name}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Overview of your current inventory.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setIsScannerOpen(true)}>
            <Scan className="h-4 w-4 mr-2" />
            Scan Barcode
          </Button>
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
            <TabsTrigger value="inventory">{t('inventory.tabs.inventory')}</TabsTrigger>
            <TabsTrigger value="expiring" className="relative">
              {t('inventory.tabs.expiringSoon')}
              {expiringItems && expiringItems.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-amber-500 rounded-full">
                  {expiringItems.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="almost-finished" className="relative">
              {t('inventory.tabs.almostFinished')}
              {criticalItemsCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                  {criticalItemsCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="smart-insights" className="relative">
              Smart Insights
              {filteredInsightsCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-indigo-600 rounded-full">
                  {filteredInsightsCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="inventory">
          <Card>
            <CardHeader className="pb-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl">Inventory List</CardTitle>
                <CardDescription>Items currently in your home.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[160px] flex-1 sm:flex-initial">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <Input
                    type="text"
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-44 h-9 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700"
                  aria-label="Filter by Category"
                >
                  <option value="all">All Categories</option>
                  {hierarchicalCategoryOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </Select>

                <Select
                  value={inventoryFilter}
                  onChange={(e) => setInventoryFilter(e.target.value as 'all' | 'expired' | 'expiring_soon')}
                  className="w-40 h-9 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700"
                  aria-label={t('inventory.filters.all')}
                >
                  <option value="all">{t('inventory.filters.all')}</option>
                  <option value="expiring_soon">{t('inventory.filters.expiringSoon')}</option>
                  <option value="expired">{t('inventory.filters.expired')}</option>
                </Select>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                    <TableHead className="w-16 rounded-tl-lg hidden sm:table-cell"></TableHead>
                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100">
                      Name
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100 hidden sm:table-cell">
                      Category
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100 text-right">
                      Quantity
                    </TableHead>
                    <TableHead
                      className="font-semibold text-gray-900 dark:text-gray-100 cursor-pointer select-none hidden sm:table-cell"
                      onClick={() => setInventorySort(inventorySort === 'newest' ? 'expiry' : 'newest')}
                      aria-label={`Sort by ${inventorySort === 'newest' ? 'expiry date' : 'newest added'}`}
                    >
                      <div className="flex items-center gap-1">
                        Expires
                        {inventorySort === 'expiry' ? (
                          <ArrowUp className="h-4 w-4" />
                        ) : (
                          <ArrowDown className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="w-24 text-right rounded-tr-lg hidden sm:table-cell">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isInventoryPending ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-32 text-center text-gray-500 dark:text-gray-400"
                      >
                        Loading inventory...
                      </TableCell>
                    </TableRow>
                  ) : !filteredInventory || filteredInventory.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-48 text-center bg-gray-50/30 dark:bg-gray-800/30 rounded-b-lg"
                      >
                        <div className="flex flex-col items-center justify-center space-y-3 text-gray-500 dark:text-gray-400">
                          <Package className="h-10 w-10 text-gray-300 dark:text-gray-500" />
                          <p>
                            {inventory && inventory.length > 0
                              ? "No items match your search or category filter."
                              : "No items found in your inventory."}
                          </p>
                          {(!inventory || inventory.length === 0) && (
                            <Button asChild variant="outline" size="sm">
                              <Link href="/inventory/new">
                                Add your first item
                              </Link>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInventory.map((item) => (
                      <TableRow
                        key={item.ID}
                        onClick={() => {
                          if (window.innerWidth < 640 && editingQuantityId !== item.ID) {
                            setSelectedMobileItem(item);
                          }
                        }}
                        className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors sm:cursor-default cursor-pointer"
                      >
                        <TableCell className="p-4 hidden sm:table-cell">
                          {item.ItemDefinition.ImageURL ? (
                            <div className="w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 overflow-hidden flex items-center justify-center shrink-0">
                              <img
                                src={
                                  signedUrls?.[item.ItemDefinition.ImageURL] ||
                                  item.ItemDefinition.ImageURL
                                }
                                alt={item.ItemDefinition.Name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 text-indigo-300 dark:text-indigo-700" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                          {item.ItemDefinition.Name}
                          <div className="text-xs text-gray-400 dark:text-gray-500 sm:hidden mt-0.5">
                            {getCategoryDisplayName(item.ItemDefinition.Category)}
                            {item.ExpirationDate && (
                              <span className="ml-2 font-medium">
                                · Expires: {new Date(item.ExpirationDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                          {getCategoryDisplayName(item.ItemDefinition.Category)}
                        </TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-gray-300 font-medium">
                          {editingQuantityId === item.ID ? (
                            <div
                              className="flex items-center justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Input
                                type="number"
                                step="any"
                                min="0"
                                value={editingQuantityValue}
                                onChange={(e) => setEditingQuantityValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveQuantity(item);
                                  if (e.key === 'Escape') setEditingQuantityId(null);
                                }}
                                autoFocus
                                className="w-20 h-8 text-right text-sm px-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-indigo-500 dark:border-indigo-400"
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30"
                                onClick={() => handleSaveQuantity(item)}
                                disabled={updateQuantityMutation.isPending}
                                aria-label="Save quantity"
                              >
                                {updateQuantityMutation.isPending ? (
                                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                onClick={() => setEditingQuantityId(null)}
                                aria-label="Cancel editing quantity"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditingQuantity(item);
                              }}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold transition-colors group-hover:bg-indigo-50/70 dark:group-hover:bg-indigo-900/20"
                              title="Click to quickly edit quantity"
                              aria-label={`Edit quantity for ${item.ItemDefinition.Name}, current quantity ${item.Quantity}`}
                            >
                              <span>{item.Quantity}</span>
                              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                                {item.ItemDefinition.SizeUnit?.Name || ''}
                              </span>
                              <Pencil className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity ml-0.5 text-indigo-500" />
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            {item.ExpirationDate ? (
                              <>
                                {(() => {
                                  const status = getExpiryStatus(item.ExpirationDate);
                                  const formattedDate = new Date(item.ExpirationDate).toLocaleDateString();

                                  if (status === 'expired') {
                                    return (
                                      <div
                                        className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium"
                                        aria-label={t('inventory.status.expired')}
                                      >
                                        <AlertCircle className="h-4 w-4" />
                                        <span>{formattedDate}</span>
                                      </div>
                                    );
                                  } else if (status === 'expiring-soon') {
                                    return (
                                      <div
                                        className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium"
                                        aria-label={t('inventory.status.expiringSoon')}
                                      >
                                        <AlertTriangle className="h-4 w-4" />
                                        <span>{formattedDate}</span>
                                      </div>
                                    );
                                  } else {
                                    return <span>{formattedDate}</span>;
                                  }
                                })()}
                              </>
                            ) : (
                              "—"
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right p-4 hidden sm:table-cell">
                          <div className="flex justify-end items-center">
                            <Button
                              asChild
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Link
                                href={`/inventory/edit/${item.ID}`}
                                aria-label={`Edit ${item.ItemDefinition.Name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 ml-1"
                              disabled={
                                deleteMutation.isPending &&
                                deleteMutation.variables === item.ID
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  window.confirm(
                                    "Are you sure you want to delete this item?",
                                  )
                                ) {
                                  deleteMutation.mutate(item.ID);
                                }
                              }}
                              aria-label={`Delete ${item.ItemDefinition.Name}`}
                            >
                              {deleteMutation.isPending &&
                              deleteMutation.variables === item.ID ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
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

        <TabsContent value="smart-insights">
          <Card>
            <CardHeader className="pb-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
                  Smart Restock Insights
                </CardTitle>
                <CardDescription>
                  Predictive restocking suggestions based on your home consumption rate.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Shopping Window:</span>
                <Select
                  value={shoppingWindowDays.toString()}
                  onChange={(e) => handleSetShoppingWindowDays(Number(e.target.value))}
                  className="w-28"
                  aria-label="Shopping Window Days"
                >
                  <option value="3">3 days</option>
                  <option value="5">5 days</option>
                  <option value="7">7 days</option>
                  <option value="10">10 days</option>
                  <option value="14">14 days</option>
                </Select>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                    <TableHead className="w-16 rounded-tl-lg"></TableHead>
                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100">
                      Item Name
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100 text-right">
                      Current Stock
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100 text-right">
                      Daily Usage (ADC)
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100">
                      Run Out Date
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100">
                      Insight Explanation
                    </TableHead>
                    <TableHead className="w-48 text-right rounded-tr-lg">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isInsightsPending ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-32 text-center text-gray-500 dark:text-gray-400"
                      >
                        Loading smart insights...
                      </TableCell>
                    </TableRow>
                  ) : filteredInsights.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-32 text-center text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-800/30 rounded-b-lg"
                      >
                        You are fully stocked for the next {shoppingWindowDays} days! No predictive suggestions.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInsights.map((item) => (
                      <TableRow
                        key={item.item_definition.ID}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                      >
                        <TableCell className="p-4">
                          {item.item_definition.ImageURL ? (
                            <div className="w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 overflow-hidden flex items-center justify-center shrink-0">
                              <img
                                src={
                                  signedUrls?.[item.item_definition.ImageURL] ||
                                  item.item_definition.ImageURL
                                }
                                alt={item.item_definition.Name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 text-indigo-300 dark:text-indigo-700" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                          {item.item_definition.Name}
                        </TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-gray-300 font-medium font-mono">
                          {item.current_stock} {item.item_definition.SizeUnit?.Name || ''}
                        </TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-gray-300 font-mono">
                          {item.average_daily_consumption.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-gray-500 dark:text-gray-400">
                          <div className="flex flex-col">
                            <span className="font-medium text-amber-600 dark:text-amber-400">
                              {new Date(item.predicted_depletion_date).toLocaleDateString()}
                            </span>
                            <span className="text-xs text-gray-400">
                              ({item.days_left} {item.days_left === 1 ? 'day' : 'days'} left)
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300 text-sm max-w-xs">
                          {item.reason || `You usually use ${item.average_daily_consumption} ${item.item_definition.SizeUnit?.Name || 'units'} per day, and you have ${item.current_stock} left.`}
                        </TableCell>
                        <TableCell className="text-right p-4">
                          <div className="flex justify-end items-center gap-2">
                            <Button
                              onClick={() => acceptRestockMutation.mutate(item)}
                              disabled={acceptRestockMutation.isPending && acceptRestockMutation.variables?.item_definition.ID === item.item_definition.ID}
                              size="sm"
                              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                            >
                              {acceptRestockMutation.isPending && acceptRestockMutation.variables?.item_definition.ID === item.item_definition.ID ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              ) : (
                                "Accept"
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDismissRestock(item.item_definition.ID)}
                              className="text-gray-500 hover:text-red-600"
                            >
                              Dismiss
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

        <TabsContent value="expiring">
          <Card>
            <CardHeader className="pb-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <CardTitle className="text-xl">{t('inventory.expiringSoon.title')}</CardTitle>
                <CardDescription>
                  {t('inventory.expiringSoon.description')}
                </CardDescription>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                    <TableHead className="w-16 rounded-tl-lg"></TableHead>
                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100">
                      {t('inventory.expiringSoon.table.name')}
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100 text-right">
                      {t('inventory.expiringSoon.table.quantity')}
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100">
                      {t('inventory.expiringSoon.table.expires')}
                    </TableHead>
                    <TableHead className="w-24 text-right rounded-tr-lg">
                      {t('inventory.expiringSoon.table.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isExpiringPending ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-32 text-center text-gray-500 dark:text-gray-400"
                      >
                        {t('inventory.expiringSoon.loading')}
                      </TableCell>
                    </TableRow>
                  ) : !expiringItems || expiringItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-32 text-center text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-800/30 rounded-b-lg"
                      >
                        {t('inventory.expiringSoon.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    expiringItems.map((item) => (
                      <TableRow
                        key={item.ID}
                        className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <TableCell className="p-4">
                          {item.ItemDefinition.ImageURL ? (
                            <div className="w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 overflow-hidden flex items-center justify-center shrink-0">
                              <img
                                src={
                                  signedUrls?.[item.ItemDefinition.ImageURL] ||
                                  item.ItemDefinition.ImageURL
                                }
                                alt={item.ItemDefinition.Name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 text-indigo-300 dark:text-indigo-700" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                          {item.ItemDefinition.Name}
                        </TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-gray-300 font-medium">
                          {item.Quantity}{" "}
                          {item.ItemDefinition.SizeUnit?.Name || ''}
                        </TableCell>
                        <TableCell className="text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-2">
                            {item.ExpirationDate ? (
                              <>
                                {(() => {
                                  const status = getExpiryStatus(item.ExpirationDate);
                                  const formattedDate = new Date(item.ExpirationDate).toLocaleDateString();

                                  if (status === 'expired') {
                                    return (
                                      <div
                                        className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium"
                                        aria-label={t('inventory.status.expired')}
                                      >
                                        <AlertCircle className="h-4 w-4" />
                                        <span>{formattedDate}</span>
                                      </div>
                                    );
                                  } else {
                                    return (
                                      <div
                                        className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium"
                                        aria-label={t('inventory.status.expiringSoon')}
                                      >
                                        <AlertTriangle className="h-4 w-4" />
                                        <span>{formattedDate}</span>
                                      </div>
                                    );
                                  }
                                })()}
                              </>
                            ) : (
                              "—"
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right p-4">
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                          >
                            <Link
                              href={`/inventory/edit/${item.ID}`}
                              aria-label={`Edit ${item.ItemDefinition.Name}`}
                            >
                              <Pencil className="h-4 w-4" />
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

        <TabsContent value="almost-finished">
          <Card>
            <CardHeader className="pb-4 border-b border-gray-100 dark:border-gray-700 flex flex-row items-center justify-between print:hidden">
              <div>
                <CardTitle className="text-xl">Almost Finished Items</CardTitle>
                <CardDescription>
                  Items running low that you might need to restock.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportAlmostFinished}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100 rounded-tl-lg">
                      Item Name
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100 text-right">
                      Current Quantity
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100">
                      Reason
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100 text-right">
                      Est. Days Left
                    </TableHead>
                    <TableHead className="w-32 text-right rounded-tr-lg print:hidden">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isAlmostFinishedPending ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-32 text-center text-gray-500 dark:text-gray-400"
                      >
                        Loading almost finished items...
                      </TableCell>
                    </TableRow>
                  ) : !almostFinished || almostFinished.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-32 text-center text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-800/30 rounded-b-lg"
                      >
                        You&apos;re well stocked! No items are currently running
                        low.
                      </TableCell>
                    </TableRow>
                  ) : (
                    almostFinished.map((item) => (
                      <TableRow
                        key={item.item_definition.ID}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                          {item.item_definition.Name}
                        </TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-gray-300">
                          {item.total_quantity}{" "}
                          {item.item_definition.SizeUnit?.Name || ''}
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">
                          {item.reason}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.estimated_days_left !== undefined &&
                          item.estimated_days_left !== null ? (
                            <span
                              className={
                                item.estimated_days_left < 3
                                  ? "text-red-600 font-bold"
                                  : "text-amber-600"
                              }
                            >
                              {item.estimated_days_left}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">
                              N/A
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right print:hidden">
                          <Button asChild variant="outline" size="sm">
                            <Link
                              href={`/inventory/new?itemDefId=${item.item_definition.ID}`}
                            >
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

      {/* Mobile Bottom Sheet Drawer */}
      {selectedMobileItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:hidden">
          <div className="fixed inset-0" onClick={() => setSelectedMobileItem(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-t-2xl p-6 shadow-xl animate-in slide-in-from-bottom duration-300">
            {/* Grabber */}
            <div className="mx-auto w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mb-4" />
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {selectedMobileItem.ItemDefinition.Name}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedMobileItem(null)}
                aria-label="Close details"
              >
                <X className="h-5 w-5 text-gray-500" />
              </Button>
            </div>

            <div className="space-y-4 mb-6">
              {selectedMobileItem.ItemDefinition.ImageURL && (
                <div className="w-full h-48 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      signedUrls?.[selectedMobileItem.ItemDefinition.ImageURL] ||
                      selectedMobileItem.ItemDefinition.ImageURL
                    }
                    alt={selectedMobileItem.ItemDefinition.Name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                    Category
                  </span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {getCategoryDisplayName(selectedMobileItem.ItemDefinition.Category)}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                    Quantity
                  </span>
                  {editingQuantityId === selectedMobileItem.ID ? (
                    <div className="flex items-center gap-1 mt-1">
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        value={editingQuantityValue}
                        onChange={(e) => setEditingQuantityValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveQuantity(selectedMobileItem);
                          if (e.key === 'Escape') setEditingQuantityId(null);
                        }}
                        autoFocus
                        className="w-20 h-8 text-sm px-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-indigo-500 dark:border-indigo-400"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30"
                        onClick={() => handleSaveQuantity(selectedMobileItem)}
                        disabled={updateQuantityMutation.isPending}
                        aria-label="Save quantity"
                      >
                        {updateQuantityMutation.isPending ? (
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        onClick={() => setEditingQuantityId(null)}
                        aria-label="Cancel editing quantity"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartEditingQuantity(selectedMobileItem)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold transition-colors mt-0.5"
                      title="Click to quickly edit quantity"
                    >
                      <span>{selectedMobileItem.Quantity}</span>
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                        {selectedMobileItem.ItemDefinition.SizeUnit?.Name || ""}
                      </span>
                      <Pencil className="h-3 w-3 text-indigo-500 ml-0.5" />
                    </button>
                  )}
                </div>
                {selectedMobileItem.ExpirationDate && (
                  <div className="col-span-2">
                    <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                      Expiration Date
                    </span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium flex items-center gap-1.5 mt-0.5">
                      {(() => {
                        const status = getExpiryStatus(selectedMobileItem.ExpirationDate);
                        const formattedDate = new Date(selectedMobileItem.ExpirationDate).toLocaleDateString();
                        if (status === 'expired') {
                          return (
                            <span className="text-red-600 dark:text-red-400 flex items-center gap-1 font-medium">
                              <AlertCircle className="h-4 w-4" />
                              {formattedDate} (Expired)
                            </span>
                          );
                        } else if (status === 'expiring-soon') {
                          return (
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                              <AlertTriangle className="h-4 w-4" />
                              {formattedDate} (Expiring Soon)
                            </span>
                          );
                        } else {
                          return <span>{formattedDate}</span>;
                        }
                      })()}
                    </span>
                  </div>
                )}
                {selectedMobileItem.ItemDefinition.Description && (
                  <div className="col-span-2">
                    <span className="block text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                      Description
                    </span>
                    <p className="text-gray-700 dark:text-gray-300 mt-1">
                      {selectedMobileItem.ItemDefinition.Description}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                asChild
                variant="outline"
                className="w-full"
              >
                <Link
                  href={`/inventory/edit/${selectedMobileItem.ID}`}
                  aria-label={`Edit ${selectedMobileItem.ItemDefinition.Name}`}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Item
                </Link>
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                disabled={
                  deleteMutation.isPending &&
                  deleteMutation.variables === selectedMobileItem.ID
                }
                onClick={() => {
                  if (
                    window.confirm(
                      "Are you sure you want to delete this item?",
                    )
                  ) {
                    deleteMutation.mutate(selectedMobileItem.ID, {
                      onSuccess: () => {
                        setSelectedMobileItem(null);
                      }
                    });
                  }
                }}
                aria-label={`Delete ${selectedMobileItem.ItemDefinition.Name}`}
              >
                {deleteMutation.isPending &&
                deleteMutation.variables === selectedMobileItem.ID ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Item
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isScannerOpen && (
        <BarcodeScanner
          onScan={async (barcode) => {
            setIsScannerOpen(false);
            try {
              const { data: itemDefs } = await api.get<ItemDefinition[]>('/item-definitions', {
                params: { barcode },
                headers: { 'X-Home-Id': currentHomeId }
              });

              if (itemDefs && itemDefs.length > 0) {
                await api.post('/inventory/scan',
                  { barcode, change: 1 },
                  { headers: { 'X-Home-Id': currentHomeId } }
                );
                queryClient.invalidateQueries({ queryKey: ['inventory'] });
              } else {
                try {
                  const { data: product } = await api.get<ProductLookupResponse>('/products/lookup', {
                    params: { barcode }
                  });

                  const params = new URLSearchParams();
                  params.set('barcode', product.barcode);
                  params.set('name', product.name);
                  if (product.category) params.set('category', product.category);
                  if (product.image_url) params.set('image_url', product.image_url);

                  router.push(`/item-definitions/new?${params.toString()}`);
                } catch (lookupErr) {
                  if (axios.isAxiosError(lookupErr) && lookupErr.response?.status === 404) {
                    router.push(`/item-definitions/new?barcode=${barcode}`);
                  } else {
                    throw lookupErr;
                  }
                }
              }
            } catch (err) {
              console.error('Scan handling failed:', err);
              alert('Failed to process barcode. Please try again.');
            }
          }}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </div>
  );
}
