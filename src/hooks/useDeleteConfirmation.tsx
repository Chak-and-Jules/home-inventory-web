'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function useDeleteConfirmation(onConfirm: (id: string) => void) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<{ id: string; message: string } | null>(null);
  const requestDelete = (id: string, message: string) => setPending({ id, message });
  const deleteConfirmation = (
    <Dialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }}>
      <DialogContent onClick={(event) => event.stopPropagation()}>
        <DialogTitle>{t('ui.delete')}</DialogTitle>
        <DialogDescription>{pending?.message}</DialogDescription>
        <DialogFooter>
          <Button variant="outline" autoFocus onClick={() => setPending(null)}>{t('categories.cancel')}</Button>
          <Button variant="destructive" onClick={() => {
            if (pending) onConfirm(pending.id);
            setPending(null);
          }}>{t('ui.delete')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return { requestDelete, deleteConfirmation };
}
