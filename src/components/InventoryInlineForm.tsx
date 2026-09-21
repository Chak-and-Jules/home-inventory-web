'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useHome } from './HomeProvider';
import { api } from '@/lib/api';
import type { InventoryItem, UpdateInventoryItemRequest } from '@/types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { FormPendingOverlay } from './FormPendingOverlay';

export function InventoryInlineForm({
  item,
  onClose,
}: {
  item: InventoryItem;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { currentHomeId } = useHome();
  const client = useQueryClient();
  const [quantity, setQuantity] = useState(String(item.Quantity));
  const [expiry, setExpiry] = useState(item.ExpirationDate?.slice(0, 10) || '');
  const mutation = useMutation({
    mutationFn: (data: UpdateInventoryItemRequest) =>
      api.put(`/inventory/${item.ID}`, data, { headers: { 'X-Home-Id': currentHomeId } }),
    onSuccess: () => {
      for (const key of [
        'inventory',
        'expiring-inventory',
        'almost-finished',
        'restock-insights',
      ]) {
        client.invalidateQueries({ queryKey: [key, currentHomeId] });
      }
      onClose();
    },
  });
  return (
    <form
      aria-label={t('ui.editItem', { name: item.ItemDefinition.Name })}
      aria-busy={mutation.isPending}
      className="relative flex flex-wrap items-end gap-3 p-2"
      onClick={(event) => event.stopPropagation()}
      onSubmit={(event) => {
        event.preventDefault();
        if (!quantity.trim() || !Number.isFinite(Number(quantity)) || Number(quantity) < 0) return;
        mutation.mutate({
          quantity: Number(quantity),
          expiry_date: expiry ? new Date(expiry).toISOString() : null,
        });
      }}
    >
      <FormPendingOverlay pending={mutation.isPending} />
      <div className="space-y-1">
        <Label htmlFor={`quantity-${item.ID}`}>{t('ui.quantity')}</Label>
        <Input
          id={`quantity-${item.ID}`}
          type="number"
          min="0"
          step="any"
          required
          autoFocus
          className="w-24"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
      </div>
      {(item.ItemDefinition.IsExpirable || item.ExpirationDate) && (
        <div className="space-y-1">
          <Label htmlFor={`expiry-${item.ID}`}>{t('ui.expirationDate')}</Label>
          <Input
            id={`expiry-${item.ID}`}
            type="date"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
          />
        </div>
      )}
      <Button type="submit" disabled={mutation.isPending}>
        {t('categories.save')}
      </Button>
      <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>
        {t('categories.cancel')}
      </Button>
      {mutation.isError && (
        <p role="alert" className="w-full text-red-600">
          {t('ui.updateFailed')}
        </p>
      )}
    </form>
  );
}
