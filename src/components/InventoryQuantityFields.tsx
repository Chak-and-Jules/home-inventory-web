'use client';

import { useTranslation } from 'react-i18next';
import type { SizeUnit } from '@/types';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select } from './ui/select';

/**
 * Visual preparation for #184. The current API supports only the definition unit.
 * Keep unit choices read-only until the finalized contract can persist them.
 */
export function InventoryQuantityFields({
  id,
  value,
  onChange,
  unit,
  disabled = false,
  autoFocus = false,
  quantityLabel,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  unit?: SizeUnit;
  disabled?: boolean;
  autoFocus?: boolean;
  quantityLabel?: string;
}) {
  const { t } = useTranslation();
  const unitName = unit?.Name || t('ui.noUnit');
  return (
    <fieldset disabled={disabled} className="min-w-0 w-full space-y-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3 dark:border-gray-700 dark:bg-gray-800/40">
      <legend className="sr-only">{t('ui.quantityAndUnits')}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1">
          <Label htmlFor={id}>{quantityLabel || t('ui.quantity')}</Label>
          <Input
            id={id}
            type="number"
            min="0"
            step="any"
            required
            autoFocus={autoFocus}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-describedby={`${id}-unit-description`}
          />
          <span id={`${id}-unit-description`} className="sr-only">{unitName}</span>
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor={`${id}-input-unit`}>{t('ui.quantityUnit')}</Label>
          <Select id={`${id}-input-unit`} value={unit?.ID || ''} disabled aria-describedby={`${id}-unit-hint`}>
            <option value={unit?.ID || ''}>{unitName}</option>
          </Select>
        </div>
      </div>
      <div className="space-y-1 border-t border-gray-200 pt-3 dark:border-gray-700">
        <Label htmlFor={`${id}-display-unit`}>{t('ui.displayUnit')}</Label>
        <Select id={`${id}-display-unit`} value="" disabled aria-describedby={`${id}-unit-hint`}>
          <option value="">{t('ui.inheritDefinitionUnit', { unit: unitName })}</option>
        </Select>
        <p id={`${id}-unit-hint`} className="text-xs text-gray-500 dark:text-gray-400">
          {t('ui.definitionUnitHint')}
        </p>
      </div>
    </fieldset>
  );
}
