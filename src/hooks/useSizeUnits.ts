'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SizeUnit } from '@/types';

export function useSizeUnits() {
  return useQuery({
    queryKey: ['sizeUnits'],
    queryFn: async () => (await api.get<SizeUnit[]>('/size-units')).data,
    staleTime: 300_000,
    retry: false,
  });
}
