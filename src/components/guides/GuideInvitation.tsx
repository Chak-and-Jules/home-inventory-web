'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { guideContext, GUIDE_VARIANTS, useGuides } from '@/hooks/useGuides';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function GuideInvitation() {
  const path = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const { guides, invitationId, mutation } = useGuides(guideContext(path));
  const guide = guides.find(item => item.id === invitationId && !!GUIDE_VARIANTS[item.id]);
  if (!guide || path.startsWith('/guides')) return null;
  const dashboard = path === '/' && guide.status === 'in_progress' && guide.checkpoint.step === GUIDE_VARIANTS[guide.id].dashboardStep;
  return <Card className="mb-6 border-indigo-200 dark:border-indigo-800" aria-label={t(GUIDE_VARIANTS[guide.id].title)}>
    <CardContent className="space-y-3 pt-6">
      <h2 className="text-lg font-semibold">{t(dashboard ? 'guides.dashboardTitle' : GUIDE_VARIANTS[guide.id].title)}</h2>
      <p>{t(dashboard ? (guide.can_write ? 'guides.dashboardHelp' : 'guides.viewerDashboardHelp') : GUIDE_VARIANTS[guide.id].description)}</p>
      {mutation.isError && <p role="alert" className="text-red-600">{t('guides.saveFailed')}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={mutation.isPending} onClick={() => {
          void mutation.mutateAsync({ guide, input: { action: dashboard ? 'complete' : 'start' } })
            .then(() => { if (!dashboard) router.push(`/guides/${guide.id}`); }).catch(() => {});
        }}>{t(dashboard ? 'guides.finish' : guide.status === 'in_progress' ? 'guides.resume' : 'guides.start')}</Button>
        <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ guide, input: { action: 'defer' } })}>{t('guides.later')}</Button>
        <Button variant="ghost" disabled={mutation.isPending} onClick={() => mutation.mutate({ guide, input: { action: 'skip' } })}>{t('guides.skip')}</Button>
      </div>
    </CardContent>
  </Card>;
}
