'use client';

import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { useAuth } from '@/components/AuthProvider';
import { useHome } from '@/components/HomeProvider';
import { api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CategoryLoadNotice, CategoryParentField } from '@/components/CategoryParentField';
import { categoryError, categoryParentIssue } from '@/lib/categoryHierarchy';
import { getCategoryOrder } from '@/lib/categoryOptions';
import { useCategories } from '@/hooks/useCategories';
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
import type { Category, CategoryRequest } from '@/types';

export default function Categories() {
  const { currentHomeId } = useHome();
  const { session } = useAuth();
  return <CategoriesForHome key={`${session?.user.uid}:${currentHomeId}`} currentHomeId={currentHomeId} />;
}

function CategoriesForHome({ currentHomeId }: { currentHomeId: string | null }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Edit State
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const editingId = editingCategory?.ID ?? null;
  const [editName, setEditName] = useState('');
  const [editParentId, setEditParentId] = useState('');

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{
    key: 'name' | 'hierarchy';
    direction: 'asc' | 'desc';
  }>({ key: 'hierarchy', direction: 'asc' });

  const categoriesQuery = useCategories(currentHomeId);
  const { data: categories, isPending } = categoriesQuery;
  const [saveError, setSaveError] = useState('');
  const active = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const parentIssue = editingId ? categoryParentIssue(categories || [], editParentId, editingId) : null;

  const updateMutation = useMutation({
    retry: false,
    mutationFn: (data: CategoryRequest & { id: string }) => {
      categoriesQuery.validateParent(data.parent_id || '', data.id);
      return api.put(`/categories/${data.id}`, { name: data.name, parent_id: data.parent_id },
        { headers: { 'X-Home-Id': currentHomeId } });
    },
    onSuccess: () => {
      if (active.current) setEditingCategory(null);
      queryClient.invalidateQueries({
        queryKey: ['categories', currentHomeId],
      });
    },
    onError: (err: unknown) => {
      if (active.current) setSaveError(categoryError(err, t('categories.alerts.failedToUpdate'), t));
      void queryClient.invalidateQueries({ queryKey: ['categories', currentHomeId] });
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
      if (active.current) setSaveError(categoryError(err, t('categories.alerts.failedToDelete'), t));
    },
  });

  const { requestDelete, deleteConfirmation } = useDeleteConfirmation(deleteMutation.mutate);

  const startEdit = (cat: Category) => {
    setSaveError('');
    setEditingCategory(cat);
    setEditName(cat.Name);
    setEditParentId(cat.ParentID || '');
  };

  const cancelEdit = () => {
    setSaveError('');
    setEditingCategory(null);
  };

  const handleSave = (id: string) => {
    setSaveError('');
    if (!editName.trim()) return;
    updateMutation.mutate({
      id,
      name: editName,
      parent_id: editParentId || null,
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

  const sortedCategories = useMemo(() => {
    if (!categories) return [];
    if (sortConfig.key === 'name') return [...categories].sort((a, b) => {
      const result = a.Name.localeCompare(b.Name, i18n.language);
      return sortConfig.direction === 'asc' ? result : -result;
    });
    return getCategoryOrder(categories, i18n.language).map(entry => entry.category);
  }, [categories, sortConfig, i18n.language]);

  const filteredCategories = useMemo(() => {
    if (!sortedCategories) return [];
    if (!debouncedSearchQuery.trim()) return sortedCategories;
    const query = debouncedSearchQuery.toLocaleLowerCase(i18n.language);
    return sortedCategories.filter(
      (cat) =>
        cat.Name.toLocaleLowerCase(i18n.language).includes(query) ||
        (cat.Parent?.Name && cat.Parent.Name.toLocaleLowerCase(i18n.language).includes(query))
    );
  }, [sortedCategories, debouncedSearchQuery, i18n.language]);

  // Keep the user's draft visible if a refresh removes its row (for example a
  // concurrent deletion followed by 404). Validation still uses the live cache,
  // so the obsolete edit cannot be saved; Cancel discards only the local draft.
  const displayedCategories = useMemo(() => {
    if (!editingCategory || filteredCategories.some(category => category.ID === editingCategory.ID)) return filteredCategories;
    return [...filteredCategories, categories?.find(category => category.ID === editingCategory.ID) ?? editingCategory];
  }, [categories, filteredCategories, editingCategory]);

  if (!currentHomeId) return <p>{t('categories.hierarchy.noHome')}</p>;

  return (
    <div className="space-y-6">
      {deleteConfirmation}
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
            {t('categories.addCategory')}
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder={t('categories.searchPlaceholder')}
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
          >{t('ui.clear')}</Button>
        )}
      </div>

      <CategoryLoadNotice query={categoriesQuery} />
      {saveError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}
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
                className="cursor-pointer select-none hidden sm:table-cell"
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
            {!isPending && !categoriesQuery.isError && categories?.length === 0 && displayedCategories.length === 0 && (
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
            {!isPending && !categoriesQuery.isError && categories && categories.length > 0 && displayedCategories.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-12 text-center text-gray-500 dark:text-gray-400"
                >
                  {t('categories.noMatching')}
                </TableCell>
              </TableRow>
            )}
            {displayedCategories.map((cat) => (
              <TableRow
                key={cat.ID}
                aria-busy={updateMutation.isPending && updateMutation.variables?.id === cat.ID}
                className={
                  editingId === cat.ID
                    ? `grid grid-cols-1 sm:table-row transition-opacity ${
                        updateMutation.isPending && updateMutation.variables?.id === cat.ID
                          ? 'opacity-50'
                          : ''
                      }`
                    : ''
                }
              >
                <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    {editingId === cat.ID ? (
                      <Input
                        value={editName}
                        onChange={(e) => { setEditName(e.target.value); setSaveError(''); }}
                        disabled={updateMutation.isPending}
                        placeholder={t('categories.tableName')}
                        className="h-8 max-w-[200px]"
                        aria-label={t('categories.tableName')}
                      />
                    ) : (
                      cat.Name
                    )}
                  </div>
                </TableCell>
                <TableCell className={editingId === cat.ID ? "block sm:table-cell" : "hidden sm:table-cell"}>
                  {editingId === cat.ID ? (
                    <CategoryParentField compact categories={categories} value={editParentId} editingId={editingId}
                      onChange={value => { setEditParentId(value); setSaveError(''); }}
                      disabled={updateMutation.isPending || !categoriesQuery.isSuccess} />
                  ) : cat.ParentID ? (
                    <div className="flex items-center gap-1.5 text-sm">
                      <FolderTree className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                      <span className="text-gray-400 dark:text-gray-500">
                        {cat.Parent?.Name || t('categories.hierarchy.parentUnavailable')}
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
                        disabled={updateMutation.isPending || !editName.trim() || !categoriesQuery.isSuccess || !!parentIssue}
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
                          requestDelete(cat.ID, t('categories.deleteConfirm'));
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 -mr-2"
                      >
                        {deleteMutation.isPending &&
                        deleteMutation.variables === cat.ID ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">{t('ui.delete')}</span>
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
