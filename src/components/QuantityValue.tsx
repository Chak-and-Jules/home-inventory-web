'use client';

import { useTranslation } from 'react-i18next';
import { formatQuantity } from '@/lib/quantityFormat';
import { fromBase, inventoryDisplay } from '@/lib/quantityUnits';
import type { InventoryItem, SizeUnit } from '@/types';
import { useSizeUnits } from '@/hooks/useSizeUnits';

export function QuantityValue({ quantity, unit, baseUnit }: { quantity: number; unit?: string; baseUnit?: SizeUnit }) {
  const { t, i18n } = useTranslation();
  const amount = Number.isFinite(quantity) ? Number(fromBase(quantity, baseUnit)) : NaN;
  const unitName = unit || baseUnit?.Name;
  return (
    <span className="inline-flex max-w-full flex-wrap items-baseline justify-end gap-x-1.5 tabular-nums">
      <span>{Number.isFinite(amount) ? formatQuantity(amount, i18n.language) : t('ui.nA')}</span>
      {unitName && <span className="break-words text-xs font-normal text-gray-500 dark:text-gray-400">{unitName}</span>}
    </span>
  );
}

export function InventoryQuantityValue({ item }: { item: InventoryItem }) {
  const { data: units = [] } = useSizeUnits();
  const display = inventoryDisplay(item, units);
  return <QuantityValue quantity={display.amount} unit={display.unit?.Name} />;
}
