'use client';

import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function FormPendingOverlay({ pending }: { pending: boolean }) {
  const { t } = useTranslation();
  if (!pending) return null;

  return (
    <div
      aria-live="polite"
      aria-label={t('ui.savingChanges')}
      className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-white/50 backdrop-blur-[1px] dark:bg-gray-900/50"
    >
      <Loader2 className="h-6 w-6 animate-spin text-indigo-600 dark:text-indigo-400" />
      <span className="sr-only">{t('ui.savingChanges')}</span>
    </div>
  );
}
