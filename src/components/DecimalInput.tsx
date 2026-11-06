'use client';

import { Input, type InputProps } from './ui/input';

/** Number inputs round on blur. Keep the entered decimal text for exact validation. */
export function DecimalInput(props: InputProps) {
  const inputProps = { ...props };
  // Range and precision are checked by quantityInput before any API submission.
  delete inputProps.min;
  delete inputProps.max;
  delete inputProps.step;
  return <Input {...inputProps} type="text" inputMode="decimal" />;
}
