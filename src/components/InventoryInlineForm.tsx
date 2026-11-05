'use client';

import { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useHome } from './HomeProvider';
import { useSizeUnits } from '@/hooks/useSizeUnits';
import { api } from '@/lib/api';
import { compatibleUnits, convertInput, fromBase, hasUnitMetadata, inventoryDisplay, inventoryUnit, quantityInput, toBase } from '@/lib/quantityUnits';
import type { InventoryItem, PatchInventoryItemRequest, SizeUnit } from '@/types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Check, Loader2, X } from 'lucide-react';
import { InventoryQuantityFields } from './InventoryQuantityFields';

export function InventoryInlineForm(props: { item: InventoryItem; onClose: () => void; compact?: boolean; onSaved?: (item: InventoryItem) => void }) {
  const { data: units = [], isPending } = useSizeUnits();
  const { t } = useTranslation();
  if (!Number.isFinite(inventoryDisplay(props.item, units).amount)) {
    return <p role="status">{t(isPending ? 'ui.loading' : 'ui.unitUnavailable')}</p>;
  }
  return <InventoryEditor {...props} units={units} />;
}

function InventoryEditor({ item, onClose, compact = false, onSaved, units }: { item: InventoryItem; onClose: () => void; compact?: boolean; onSaved?: (item: InventoryItem) => void; units: SizeUnit[] }) {
  const { t } = useTranslation();
  const { currentHomeId } = useHome();
  const client = useQueryClient();
  const effective = inventoryUnit(item, units);
  const modern = hasUnitMetadata(item.ItemDefinition.SizeUnit);
  const [quantity, setQuantity] = useState(() => fromBase(item.Quantity, effective));
  const [inputUnitId, setInputUnitId] = useState(effective?.ID || '');
  const [displayUnitId, setDisplayUnitId] = useState(item.DisplaySizeUnitID ?? null);
  const originalExpiry = item.expiry_date?.slice(0, 10) || '';
  const [expiry, setExpiry] = useState(originalExpiry);
  const [invalid, setInvalid] = useState(false);
  const choices = compatibleUnits(item.ItemDefinition.SizeUnit, units);
  const inputUnit = choices.find((unit) => unit.ID === inputUnitId) || effective;
  const mutation = useMutation({
    mutationFn: async (data: PatchInventoryItemRequest) => {
      const options = { headers: { 'X-Home-Id': currentHomeId } };
      const res = modern ? await api.patch<InventoryItem>(`/inventory/${item.ID}`, data, options) : await api.put<InventoryItem>(`/inventory/${item.ID}`, data, options);
      return res.data;
    },
    onSuccess: (updated) => {
      for (const key of ['inventory', 'expiring-inventory', 'almost-finished', 'restock-insights', 'shoppingList', 'predictions', 'recipe-suggestions']) client.invalidateQueries({ queryKey: [key] });
      if (updated?.ID) onSaved?.(updated);
      onClose();
    },
  });
  return (
    <form
      aria-label={t('ui.editItem', { name: item.ItemDefinition.Name })}
      aria-busy={mutation.isPending}
      className={compact ? 'flex w-44 max-w-full flex-col gap-2 text-left' : 'flex flex-wrap items-end gap-3 p-2 transition-opacity'}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => { if (compact && event.key === 'Escape') { event.preventDefault(); onClose(); } }}
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const amount = quantityInput(quantity, inputUnit);
          const data: PatchInventoryItemRequest = {};
          if (!modern || !inputUnit || toBase(quantity, inputUnit) !== item.Quantity) Object.assign(data, amount);
          if (modern && displayUnitId !== (item.DisplaySizeUnitID ?? null)) data.display_size_unit_id = displayUnitId;
          if (!modern || (!compact && expiry !== originalExpiry)) data.expiry_date = expiry ? new Date(expiry).toISOString() : null;
          setInvalid(false);
          if (Object.keys(data).length) mutation.mutate(data); else onClose();
        } catch { setInvalid(true); }
      }}
    >
      <InventoryQuantityFields id={`quantity-${item.ID}`} value={quantity} onChange={(value) => { setQuantity(value); setInvalid(false); }} unit={item.ItemDefinition.SizeUnit} units={units} inputUnitId={inputUnitId} onInputUnitChange={(id) => {
        const next = choices.find((unit) => unit.ID === id);
        if (!next || !inputUnit) return;
        try { setQuantity(convertInput(quantity, inputUnit, next)); setInputUnitId(id); setInvalid(false); } catch { setInvalid(true); }
      }} displayUnitId={displayUnitId} onDisplayUnitChange={setDisplayUnitId} disabled={mutation.isPending} autoFocus compact={compact} />
      {!compact && (item.ItemDefinition.IsExpirable || item.expiry_date) && <div className="space-y-1"><Label htmlFor={`expiry-${item.ID}`}>{t('ui.expirationDate')}</Label><Input id={`expiry-${item.ID}`} type="date" disabled={mutation.isPending} value={expiry} onChange={(event) => setExpiry(event.target.value)} /></div>}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={mutation.isPending} aria-label={compact ? t('ui.saveQuantity') : undefined}>{mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : compact ? <Check className="h-4 w-4" /> : t('categories.save')}</Button>
        <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose} aria-label={compact ? t('ui.cancelEditingQuantity') : undefined}>{compact ? <X className="h-4 w-4" /> : t('categories.cancel')}</Button>
      </div>
      {(invalid || mutation.isError) && <p role="alert" className="w-full text-sm text-red-600">{t(invalid ? 'ui.invalidQuantity' : axios.isAxiosError(mutation.error) && mutation.error.response?.status === 400 ? 'ui.quantityRejected' : 'ui.updateFailed')}</p>}
    </form>
  );
}
