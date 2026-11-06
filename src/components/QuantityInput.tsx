'use client';

import { useId } from 'react';
import type { InputProps } from './ui/input';
import { DecimalInput } from './DecimalInput';

/** Keep the current unit visible even in the dashboard's compact quantity editor. */
export function QuantityInput({ unit, ...props }: InputProps & { unit?: string }) {
  const unitId = useId();
  const describedBy = [props['aria-describedby'], unit ? unitId : undefined].filter(Boolean).join(' ');
  return (
    <div className="flex min-w-0 items-center gap-2">
      <DecimalInput {...props} aria-describedby={describedBy || undefined} />
      {unit && <span id={unitId} className="max-w-24 break-words text-sm text-gray-500 dark:text-gray-400">{unit}</span>}
    </div>
  );
}
