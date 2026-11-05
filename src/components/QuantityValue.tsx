'use client';

import { useTranslation } from 'react-i18next';
import { formatQuantity } from '@/lib/quantityFormat';

export function QuantityValue({ quantity, unit }: { quantity: number; unit?: string }) {
  const { t, i18n } = useTranslation();
  return (
    <span className="inline-flex max-w-full flex-wrap items-baseline justify-end gap-x-1.5 tabular-nums">
      <span>{Number.isFinite(quantity) ? formatQuantity(quantity, i18n.language) : t('ui.nA')}</span>
      {unit && <span className="break-words text-xs font-normal text-gray-500 dark:text-gray-400">{unit}</span>}
    </span>
  );
}
