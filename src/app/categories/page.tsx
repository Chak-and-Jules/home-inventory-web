'use client';

import { AxiosError } from 'axios';
import { useAuth } from '@/components/AuthProvider';
import { useHome } from '@/components/HomeProvider';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Box,
  Trash2,
  FolderTree,
  Edit,
  Save,
  X,
  ArrowUp,
  ArrowDown,
  Plus,
  Search,
} from 'lucide-react';
import type { Category } from '@/types';

export default function Categories() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { currentHomeId } = useHome();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editParentId, setEditParentId] = useState('');

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{
    key: 'name' | 'hierarchy';
    direction: 'asc' | 'desc';
  }>({ key: 'hierarchy', direction: 'asc' });

  const { data: categories, isPending } = useQuery({
    queryKey: ['categories', currentHomeId],
    queryFn: async () => {
      const res = await api.get<Category[]>('/categories', {
        headers: { 'X-Home-Id': currentHomeId },
      });
      return res.data;
    },
    enabled: !!session && !!currentHomeId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; name: string; parent_id?: string }) =>
      api.put(
        `/categories/${data.id}`,
        { name: data.name, parent_id: data.parent_id || undefined },
        { headers: { 'X-Home-Id': currentHomeId } },
      ),
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({
        queryKey: ['categories', currentHomeId],
      });
    },
    onError: (err: unknown) => {
      alert((err as AxiosError<{ error?: string }>).response?.data?.error || t('categories.alerts.failedToUpdate'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/categories/${id}`, {
        headers: { 'X-Home-Id': currentHomeId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['categories', currentHomeId],
      });
    },
    onError: (err: unknown) => {
      alert((err as AxiosError<{ error?: string }>).response?.data?.error || t('categories.alerts.failedToDelete'));
    },
  });

  const startEdit = (cat: Category) => {
    setEditingId(cat.ID);
    setEditName(cat.Name);
    setEditParentId(cat.ParentID || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = (id: string) => {
    if (!editName.trim()) return;
    updateMutation.mutate({
      id,
      name: editName,
      parent_id: editParentId,
    });
  };

  const handleSort = (key: 'name' | 'hierarchy') => {
    setSortConfig((prev) => {
      if (key === 'hierarchy') {
        return { key: 'hierarchy', direction: 'asc' };
      }
      if (prev.key === 'name') {
        return {
          key: 'name',
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { key: 'name', direction: 'asc' };
    });
  };

  const availableParents = useMemo(() => {
    if (!categories || !editingId) return [];
    return categories.filter((c) => c.ID !== editingId);
  }, [categories, editingId]);

  const sortedCategories = useMemo(() => {
    if (!categories) return [];

    const items = [...categories];

    if (sortConfig.key === 'name') {
      return items.sort((a, b) => {
        const result = a.Name.localeCompare(b.Name);
        return sortConfig.direction === 'asc' ? result : -result;
      });
    }

    // Hierarchy sort (Optimized O(N) grouping)
    const categoryMap = new Map<string, Category[]>();

    // Group categories by parent ID
    items.forEach(cat => {
      const parentId = cat.ParentID || 'root';
      if (!categoryMap.has(parentId)) {
        categoryMap.set(parentId, []);
      }
      categoryMap.get(parentId)!.push(cat);
    });

    const getHierarchicalOrder = (parentId: string = 'root'): Category[] => {
      const children = categoryMap.get(parentId) || [];
      return children
        .sort((a, b) => a.Name.localeCompare(b.Name))
        .reduce((acc: Category[], cat) => {
          acc.push(cat);
          const descendants = getHierarchicalOrder(cat.ID);
          acc.push(...descendants);
          return acc;
        }, []);
    };

    return getHierarchicalOrder();
  }, [categories, sortConfig]);

  const filteredCategories = useMemo(() => {
    if (!sortedCategories) return [];
    if (!searchQuery.trim()) return sortedCategories;
    const query = searchQuery.toLowerCase();

    const filtered = [];
    for (let i = 0; i < sortedCategories.length; i++) {
      const cat = sortedCategories[i];
      if (
        cat.Name.toLowerCase().includes(query) ||
        (cat.Parent?.Name && cat.Parent.Name.toLowerCase().includes(query))
      ) {
        filtered.push(cat);
      }
    }
    return filtered;
  }, [sortedCategories, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {t('categories.title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {t('categories.description')}
          </p>
        </div>
        <Button asChild>
          <Link href="/categories/new">
            <Plus className="h-4 w-4 mr-2" />
            {t('categories.addCategory', 'Add Category')}
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder={t('categories.searchPlaceholder', 'Search categories...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery('')}
            className="text-gray-500 hover:text-gray-700"
          >
            Clear
          </Button>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort('name')}
                aria-label={t('categories.tableName')}
              >
                <div className="flex items-center gap-1">
                  {t('categories.tableName')}
                  {sortConfig.key === 'name' &&
                    (sortConfig.direction === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort('hierarchy')}
                aria-label={t('categories.tableHierarchy')}
              >
                <div className="flex items-center gap-1">
                  {t('categories.tableHierarchy')}
                  {sortConfig.key === 'hierarchy' && (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </div>
              </TableHead>
              <TableHead className="text-right">{t('categories.tableActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center py-8 text-gray-500 dark:text-gray-400"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 rounded-full animate-pulse bg-indigo-200 dark:bg-indigo-900/40"></div>
                    <div className="w-4 h-4 rounded-full animate-pulse bg-indigo-300 dark:bg-indigo-900/60"></div>
                    <div className="w-4 h-4 rounded-full animate-pulse bg-indigo-400 dark:bg-indigo-900/80"></div>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!isPending && categories?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-12 text-center text-gray-500 dark:text-gray-400"
                >
                  <Box className="mx-auto mb-3 h-8 w-8 text-gray-400 dark:text-gray-500" />
                  {t('categories.noCategories')}
                </TableCell>
              </TableRow>
            )}
            {!isPending && categories && categories.length > 0 && filteredCategories.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-12 text-center text-gray-500 dark:text-gray-400"
                >
                  {t('categories.noMatchingCategories', 'No matching categories found.')}
                </TableCell>
              </TableRow>
            )}
            {filteredCategories?.map((cat) => (
              <TableRow key={cat.ID}>
                <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    {editingId === cat.ID ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder={t('categories.tableName')}
                        className="h-8 max-w-[200px]"
                        aria-label={t('categories.tableName')}
                      />
                    ) : (
                      cat.Name
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-gray-500 dark:text-gray-400">
                  {editingId === cat.ID ? (
                    <Select
                      value={editParentId}
                      onChange={(e) => setEditParentId(e.target.value)}
                      className="h-8 max-w-[200px]"
                      aria-label={t('categories.parent')}
                    >
                      <option value="">{t('categories.none')}</option>
                      {availableParents.map((c) => (
                        <option key={c.ID} value={c.ID}>
                          {c.Name}
                        </option>
                      ))}
                    </Select>
                  ) : cat.Parent ? (
                    <div className="flex items-center gap-1.5 text-sm">
                      <FolderTree className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                      <span className="text-gray-400 dark:text-gray-500">
                        {cat.Parent.Name}
                      </span>
                      <span className="text-gray-300 dark:text-gray-600">
                        /
                      </span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {cat.Name}
                      </span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-gray-50 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400 ring-1 ring-inset ring-gray-500/10 dark:ring-gray-700">
                      {t('categories.topLevel')}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {editingId === cat.ID ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSave(cat.ID)}
                        disabled={updateMutation.isPending || !editName.trim()}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 mr-1"
                      >
                        <Save className="h-4 w-4 mr-1" /> {t('categories.save')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelEdit}
                        className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      >
                        <X className="h-4 w-4 mr-1" /> {t('categories.cancel')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`${t('categories.edit')} ${cat.Name}`}
                        onClick={() => startEdit(cat)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 mr-1"
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">{t('categories.edit')}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`${t('categories.delete')} ${cat.Name}`}
                        disabled={
                          deleteMutation.isPending &&
                          deleteMutation.variables === cat.ID
                        }
                        onClick={() => {
                          if (confirm(t('categories.deleteConfirm'))) {
                            deleteMutation.mutate(cat.ID);
                          }
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 -mr-2"
                      >
                        {deleteMutation.isPending &&
                        deleteMutation.variables === cat.ID ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
