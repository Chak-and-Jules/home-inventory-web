'use client';

import { AxiosError } from 'axios';
import { useAuth } from '@/components/AuthProvider';
import { useHome } from '@/components/HomeProvider';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { ArrowLeft, FolderPlus } from 'lucide-react';
import type { Category } from '@/types';

export default function NewCategory() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { currentHomeId } = useHome();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [newCatName, setNewCatName] = useState('');
  const [parentCatId, setParentCatId] = useState('');

  const { data: categories } = useQuery({
    queryKey: ['categories', currentHomeId],
    queryFn: async () => {
      const res = await api.get<Category[]>('/categories', {
        headers: { 'X-Home-Id': currentHomeId },
      });
      return res.data;
    },
    enabled: !!session && !!currentHomeId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; parent_id?: string }) =>
      api.post('/categories', data, {
        headers: { 'X-Home-Id': currentHomeId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['categories', currentHomeId],
      });
      router.push('/categories');
    },
    onError: (err: unknown) => {
      alert((err as AxiosError<{ error?: string }>).response?.data?.error || t('categories.alerts.failedToCreate'));
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCatName.trim()) {
      createMutation.mutate({
        name: newCatName,
        parent_id: parentCatId || undefined,
      });
    }
  };

  if (!currentHomeId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-gray-500 mb-4">No home found. You need a home to add categories.</div>
        <Button asChild>
          <Link href="/homes">Manage Homes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild aria-label="Go back to categories" className="p-2 -ml-2 text-gray-500">
          <Link href="/categories">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FolderPlus className="h-6 w-6 text-indigo-500" />
            {t('categories.createNew')}
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('categories.createNew')}</CardTitle>
          <CardDescription>{t('categories.createNewDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">{t('categories.name')}</Label>
              <Input
                id="name"
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder={t('categories.namePlaceholder')}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent">{t('categories.parent')}</Label>
              <Select
                id="parent"
                value={parentCatId}
                onChange={(e) => setParentCatId(e.target.value)}
              >
                <option value="">{t('categories.none')}</option>
                {categories?.map((c) => (
                  <option key={c.ID} value={c.ID}>
                    {c.Name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
              <Button type="button" variant="outline" asChild>
                <Link href="/categories">Cancel</Link>
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !newCatName.trim()}
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
