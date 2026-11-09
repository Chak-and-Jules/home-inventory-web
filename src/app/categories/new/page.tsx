'use client';

import { useAuth } from '@/components/AuthProvider';
import { useHome } from '@/components/HomeProvider';
import { api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CategoryLoadNotice, CategoryParentField } from '@/components/CategoryParentField';
import { categoryError, categoryParentIssue } from '@/lib/categoryHierarchy';
import { useCategories } from '@/hooks/useCategories';
import type { CategoryRequest } from '@/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { ArrowLeft, FolderPlus } from 'lucide-react';
import { FormPendingOverlay } from '@/components/FormPendingOverlay';

export default function NewCategory() {
  const { currentHomeId } = useHome();
  const { session } = useAuth();
  return <NewCategoryForHome key={`${session?.user.uid}:${currentHomeId}`} currentHomeId={currentHomeId} />;
}

function NewCategoryForHome({ currentHomeId }: { currentHomeId: string | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [newCatName, setNewCatName] = useState('');
  const [parentCatId, setParentCatId] = useState('');

  const categoriesQuery = useCategories(currentHomeId);
  const categories = categoriesQuery.data;
  const [saveError, setSaveError] = useState('');
  const active = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const parentIssue = categoryParentIssue(categories || [], parentCatId);

  const createMutation = useMutation({
    retry: false,
    mutationFn: (data: CategoryRequest) => {
      categoriesQuery.validateParent(data.parent_id || '');
      return api.post('/categories', data, { headers: { 'X-Home-Id': currentHomeId } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['categories', currentHomeId],
      });
      if (active.current) router.push('/categories');
    },
    onError: (err: unknown) => {
      if (active.current) setSaveError(categoryError(err, t('categories.alerts.failedToCreate'), t));
      void queryClient.invalidateQueries({ queryKey: ['categories', currentHomeId] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    if (newCatName.trim()) {
      createMutation.mutate({
        name: newCatName,
        parent_id: parentCatId || null,
      });
    }
  };

  if (!currentHomeId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-gray-500 mb-4">{t('ui.noHomeFoundYouNeedAHomeToAddCategories')}</div>
        <Button asChild>
          <Link href="/homes">{t('ui.manageHomes')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild aria-label={t('ui.goBackToCategories')} className="p-2 -ml-2 text-gray-500">
          <Link href="/categories">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">{t('ui.back')}</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FolderPlus className="h-6 w-6 text-indigo-500" />
            {t('categories.createNew')}
          </h1>
        </div>
      </div>

      <Card className="relative" aria-busy={createMutation.isPending}>
        <FormPendingOverlay pending={createMutation.isPending} />
        <CardHeader>
          <CardTitle>{t('categories.createNew')}</CardTitle>
          <CardDescription>{t('categories.createNewDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryLoadNotice query={categoriesQuery} />
          {saveError && <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">{saveError}</p>}
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">{t('categories.name')}</Label>
              <Input
                id="name"
                type="text"
                value={newCatName}
                onChange={(e) => { setNewCatName(e.target.value); setSaveError(''); }}
                disabled={createMutation.isPending}
                placeholder={t('categories.namePlaceholder')}
                required
              />
            </div>
            <CategoryParentField categories={categories} value={parentCatId}
              onChange={value => { setParentCatId(value); setSaveError(''); }}
              disabled={createMutation.isPending || !categoriesQuery.isSuccess} />

            <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
              <Button type="button" variant="outline" asChild>
                <Link href="/categories">{t('ui.cancel')}</Link>
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !newCatName.trim() || !categoriesQuery.isSuccess || !!parentIssue}
              >
                {createMutation.isPending ? t('categories.creating') : t('categories.create')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
