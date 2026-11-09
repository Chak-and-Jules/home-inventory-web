'use client';
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { CategoryValidationError, categoryParentIssue, readCategories } from '@/lib/categoryHierarchy';

export function useCategories(homeId: string | null) {
  const { session } = useAuth();
  const client = useQueryClient();
  const queryKey = ['categories', homeId];
  const query = useQuery({
    queryKey, enabled: !!session && !!homeId, retry: false,
    queryFn: async ({ signal }) => readCategories((await api.get<unknown>('/categories', {
      headers: { 'X-Home-Id': homeId }, signal,
    })).data, homeId),
    // Other screens share this cache; validate their cached responses too.
    select: useCallback((data: unknown) => readCategories(data, homeId), [homeId]),
  });
  const validateParent = (parentId: string, editingId?: string | null) => {
    if (!session || !homeId || client.getQueryState(queryKey)?.status !== 'success') throw new CategoryValidationError('loadFailed');
    const issue = categoryParentIssue(readCategories(client.getQueryData(queryKey), homeId), parentId, editingId);
    if (issue) throw new CategoryValidationError(issue);
  };
  return { ...query, validateParent };
}
