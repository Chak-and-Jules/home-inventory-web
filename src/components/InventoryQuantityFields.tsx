'use client';

import { useTranslation } from 'react-i18next';
import type { SizeUnit } from '@/types';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select } from './ui/select';
import { compatibleUnits, fromBase, hasUnitMetadata } from '@/lib/quantityUnits';
import { formatQuantity } from '@/lib/quantityFormat';

export function InventoryQuantityFields({
  id,
  value,
  onChange,
  unit,
  disabled = false,
  autoFocus = false,
  quantityLabel,
  units = [],
  inputUnitId,
  onInputUnitChange,
  displayUnitId = null,
  onDisplayUnitChange,
  compact = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  unit?: SizeUnit;
  disabled?: boolean;
  autoFocus?: boolean;
  quantityLabel?: string;
  units?: SizeUnit[];
  inputUnitId?: string;
  onInputUnitChange?: (id: string) => void;
  displayUnitId?: string | null;
  onDisplayUnitChange?: (id: string | null) => void;
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const unitName = unit?.Name || t('ui.noUnit');
  const choices = compatibleUnits(unit, units);
  const selected = choices.find((u) => u.ID === inputUnitId) || unit;
  return (
    <fieldset disabled={disabled} className={`min-w-0 w-full rounded-lg border border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-800/40 ${compact ? 'space-y-1 p-1.5' : 'space-y-3 p-3'}`}>
      <legend className="sr-only">{t('ui.quantityAndUnits')}</legend>
      <div className={compact ? 'grid grid-cols-[minmax(0,1fr)_4rem] gap-1' : 'grid grid-cols-1 gap-3 sm:grid-cols-2'}>
        <div className="min-w-0 space-y-1">
          <Label className={compact ? 'sr-only' : undefined} htmlFor={id}>{quantityLabel || t('ui.quantity')}</Label>
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
          <span id={`${id}-unit-description`} className="sr-only">{selected?.Name || unitName}</span>
          {!compact && hasUnitMetadata(selected) && <p className="text-xs text-gray-500 dark:text-gray-400">{t('ui.quantityRange', { min: formatQuantity(Number(fromBase(0.000001, selected)), i18n.language), max: formatQuantity(Number(fromBase(1_000_000_000, selected)), i18n.language), unit: selected.Name })}</p>}
        </div>
        <div className="min-w-0 space-y-1">
          <Label className={compact ? 'sr-only' : undefined} htmlFor={`${id}-input-unit`}>{t('ui.quantityUnit')}</Label>
          <Select id={`${id}-input-unit`} value={selected?.ID || ''} disabled={!hasUnitMetadata(unit) || !onInputUnitChange} onChange={(event) => onInputUnitChange?.(event.target.value)} aria-describedby={`${id}-unit-hint`}>
            {choices.length ? choices.map((choice) => <option key={choice.ID} value={choice.ID}>{choice.Name}</option>) : <option value="">{unitName}</option>}
          </Select>
        </div>
      </div>
      <div className={`space-y-1 border-t border-gray-200 dark:border-gray-700 ${compact ? 'pt-1' : 'pt-3'}`}>
        <Label className={compact ? 'sr-only' : undefined} htmlFor={`${id}-display-unit`}>{t('ui.displayUnit')}</Label>
        <Select id={`${id}-display-unit`} value={displayUnitId || ''} disabled={!hasUnitMetadata(unit) || !onDisplayUnitChange} onChange={(event) => onDisplayUnitChange?.(event.target.value || null)} aria-describedby={`${id}-unit-hint`}>
          <option value="">{t('ui.inheritDefinitionUnit', { unit: unitName })}</option>
          {hasUnitMetadata(unit) && choices.map((choice) => <option key={choice.ID} value={choice.ID}>{choice.Name}</option>)}
        </Select>
        <p id={`${id}-unit-hint`} className={compact ? 'sr-only' : 'text-xs text-gray-500 dark:text-gray-400'}>
          {t(hasUnitMetadata(unit) ? 'ui.displayUnitHint' : 'ui.definitionUnitHint')}
        </p>
      </div>
    </fieldset>
  );
}
