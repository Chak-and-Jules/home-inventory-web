'use client';

import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function ImagePreview({
  src,
  name,
  className = 'h-10 w-10',
}: {
  src?: string;
  name: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [failedSrc, setFailedSrc] = useState<string>();
  if (!src || failedSrc === src) {
    return <div role="img" aria-label={t('ui.imageUnavailable')} className={`${className} flex items-center justify-center rounded-md border text-xs text-gray-500`}>
      <span aria-hidden="true">—</span>
    </div>;
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          className={`${className} shrink-0 overflow-hidden rounded-md border border-gray-200 dark:border-gray-600 focus-visible:ring-2 focus-visible:ring-indigo-500`}
          aria-label={t('ui.viewImage', { name })}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={name} referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} className="h-full w-full object-cover" />
        </button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-[min(90vw,48rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogTitle>{name}</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} className="max-h-[75vh] w-full object-contain" />
      </DialogContent>
    </Dialog>
  );
}
