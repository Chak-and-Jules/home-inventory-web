import { describe, expect, it } from 'vitest';
import { formatQuantity } from './quantityFormat';

describe('quantity presentation', () => {
  it('uses the selected language for grouping and fractional amounts', () => {
    expect(formatQuantity(1300.5, 'en')).toBe('1,300.5');
    expect(formatQuantity(1300.5, 'tr')).toBe('1.300,5');
  });

  it('keeps small fractional amounts visible instead of rounding to two decimals', () => {
    expect(formatQuantity(0.0000125, 'en')).toBe('0.0000125');
    expect(formatQuantity(0.0000125, 'tr')).toBe('0,0000125');
    expect(formatQuantity(0, 'tr')).toBe('0');
    expect(formatQuantity(-2200, 'en')).toBe('-2,200');
  });
});
