'use client';
import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import { useHome } from '@/components/HomeProvider';
import { api } from '@/lib/api';
import type { ApiGuide, Guide, GuideCatalog, GuideInput } from '@/types/guide';
import { fromApiGuide, fromApiCatalog, guideCommand, GUIDE_CLIENT_VERSION } from '@/lib/guides';

export const INTRODUCTION = 'introduction';
// Register a variant only after this client implements its named checkpoints.
export const GUIDE_VARIANTS: Record<string, { revision: number; title: string; description: string; dashboardStep?: string }> = {
  [INTRODUCTION]: { revision: 1, title: 'guides.introduction.title', description: 'guides.introduction.description', dashboardStep: 'dashboard' },
};
export { GUIDE_CLIENT_VERSION };
export function guideContext(path: string) {
  if (path === '/') return 'dashboard';
  if (path.startsWith('/inventory')) return 'inventory';
  if (path.startsWith('/item-definitions')) return 'item-definitions';
  return 'settings';
}
export function useGuides(context: string) {
  const { session } = useAuth();
  const { currentHomeId, isLoading } = useHome();
  const client = useQueryClient();
  const uid = session?.user.uid;
  const key = ['guides', uid, 'web', currentHomeId];
  const pending = useRef<{ signature: string; request: ReturnType<typeof guideCommand> } | null>(null);
  const query = useQuery({
    queryKey: [...key, context], enabled: !!uid && !isLoading,
    queryFn: async ({ signal }) => fromApiCatalog((await api.get<ApiGuide[]>('/guides', {
      params: { platform:'web', client_version:GUIDE_CLIENT_VERSION },
      headers: currentHomeId ? { 'X-Home-Id': currentHomeId } : {}, signal,
    })).data, context, Object.keys(GUIDE_VARIANTS)),
    staleTime: 0, refetchOnWindowFocus: 'always', refetchInterval: 60_000, retry: false,
  });
  const { refetch } = query;
  useEffect(() => {
    if (!uid || isLoading) return;
    const refresh = () => { if (document.visibilityState === 'visible') void refetch(); };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [refetch, uid, isLoading]);
  const mutation = useMutation({
    retry: false,
    mutationFn: async ({ guide, input }: { guide: Guide; input: GuideInput }) => {
      const signature = JSON.stringify([uid, currentHomeId, guide.id, guide.revision, guide.version, input]);
      if (pending.current?.signature !== signature) pending.current = { signature, request:guideCommand(guide, input, currentHomeId, crypto.randomUUID()) };
      const request = pending.current.request;
      return fromApiGuide((await api.post<ApiGuide>(`/guides/${guide.id}/${request.setup ? 'setup' : 'actions'}`, request.body,
        { headers:currentHomeId ? { 'X-Home-Id':currentHomeId } : {} })).data);
    },
    onMutate: () => ({ uid, homeId: currentHomeId }),
    onSuccess: async (guide, _variables, scope) => {
      pending.current = null;
      client.setQueriesData<GuideCatalog>({ queryKey: ['guides', scope.uid, 'web', scope.homeId] }, old => old ? {
        ...old, guides: (old.guides || []).map(item => item.id === guide.id && item.platform === guide.platform && item.version <= guide.version ? guide : item),
        invitation_id: ['completed', 'skipped'].includes(guide.status) && old.invitation_id === guide.id ? null : old.invitation_id,
      } : old);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['guides', scope.uid, 'web'] }),
        ...['itemDefs', 'inventory', 'expiring-inventory', 'almost-finished', 'restock-insights'].map(name => client.invalidateQueries({ queryKey: [name, scope.homeId] })),
      ]);
    },
    onError: (_error, _variables, scope) => { void client.invalidateQueries({ queryKey: ['guides', scope?.uid, 'web'] }); },
  });
  return { ...query, guides: query.data?.guides || [], invitationId: query.data?.invitation_id, mutation };
}
