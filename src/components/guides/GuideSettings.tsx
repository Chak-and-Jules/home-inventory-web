'use client';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { GUIDE_VARIANTS, useGuides } from '@/hooks/useGuides';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function GuideSettings() {
  const { t } = useTranslation();
  const router = useRouter();
  const query = useGuides('settings');
  return <Card>
    <CardHeader><CardTitle>{t('guides.settingsTitle')}</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p>{t('guides.settingsHelp')}</p>
      {query.isPending && <p role="status">{t('ui.loading')}</p>}
      {(query.isError || query.mutation.isError) && <p role="alert">{t(query.isError ? 'guides.loadFailed' : 'guides.saveFailed')} <Button variant="outline" onClick={() => { void query.refetch(); }}>{t('guides.retry')}</Button></p>}
      {query.guides.filter(guide => guide.platform === 'web' && !!GUIDE_VARIANTS[guide.id]).map(guide => <div key={guide.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <div><h3 className="font-medium">{t(GUIDE_VARIANTS[guide.id].title)}</h3><p>{t(`guides.status.${guide.status}`)}</p>{!guide.available && <p>{t('guides.unavailable')}</p>}</div>
        <div className="flex flex-wrap gap-2">
          {guide.available && !['completed', 'skipped'].includes(guide.status) && <Button disabled={query.mutation.isPending} onClick={() => {
            void query.mutation.mutateAsync({ guide, input: { action: 'start' } }).then(() => router.push(`/guides/${guide.id}`)).catch(() => {});
          }}>{t(guide.status === 'in_progress' ? 'guides.resume' : 'guides.start')}</Button>}
          <Button variant="outline" disabled={query.mutation.isPending} onClick={() => {
            void query.mutation.mutateAsync({ guide, input: { action: 'restore' } }).then(() => router.push(`/guides/${guide.id}`)).catch(() => {});
          }}>{t('guides.restore')}</Button>
        </div>
      </div>)}
    </CardContent>
  </Card>;
}
