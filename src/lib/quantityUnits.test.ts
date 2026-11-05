import { describe, expect, it } from 'vitest';
import type { InventoryItem } from '@/types';
import { addQuantities, compatibleUnits, convertInput, fromBase, inventoryDisplay, inventoryTotals, quantityInput, restockAmount, toBase } from './quantityUnits';

import { g, kg, ml, liter } from '@/test/quantityFixtures';

describe('PR #138 quantity contract', () => {
  it('normalizes and displays compatible amounts without changing their meaning', () => {
    expect(toBase('3', kg)).toBe(3000);
    expect(fromBase(800, kg)).toBe('0.8');
    expect(convertInput('3', kg, g)).toBe('3000');
    expect(convertInput('800', g, kg)).toBe('0.8');
    expect(convertInput('1.25', liter, ml)).toBe('1250');
    expect(fromBase(addQuantities(toBase('800', g), toBase('0.5', kg)), kg)).toBe('1.3');
    expect(addQuantities(0.1, 0.2)).toBe(0.3);
  });
  it('keeps exact decimal precision through repeated unit changes', () => {
    let value = '0.000000001';
    for (let i = 0; i < 50; i++) value = convertInput(convertInput(value, kg, g), g, kg);
    expect(value).toBe('0.000000001');
    expect(quantityInput(value, kg)).toEqual({ quantity: 1e-9, quantity_unit_id: 'kg' });
    expect(toBase('0.000000001', kg)).toBe(0.000001);
    expect(toBase('999999.999999999', kg)).toBe(999999999.999999);
    expect(toBase('.8', kg)).toBe(800);
    expect(toBase('0', kg)).toBe(0);
  });
  it.each(['', '-1', '0.0000000001', '1000000.000000001', 'NaN', 'Infinity', '0.80000000000000001'])('rejects invalid kg input %s before JSON can discard precision', (value) => {
    expect(() => quantityInput(value, kg)).toThrow();
  });
  it('keeps input units separate from display choices and signed deltas', () => {
    expect(quantityInput('3', kg)).toEqual({ quantity: 3, quantity_unit_id: 'kg' });
    expect(quantityInput('-0.5', kg, true)).toEqual({ quantity: -0.5, quantity_unit_id: 'kg' });
    expect(compatibleUnits(kg, [g, ml, liter])).toEqual([kg, g]);
    expect(() => convertInput('1', kg, liter)).toThrow();
    expect(convertInput('', kg, g)).toBe('');
  });
  it('inherits defaults and preserves explicit overrides after the default changes', () => {
    const item = { Quantity: 800, ItemDefinition: { SizeUnitID: 'kg', SizeUnit: kg } } as InventoryItem;
    expect(inventoryDisplay(item, [g, kg])).toEqual({ amount: 0.8, unit: kg });
    expect(inventoryDisplay({ ...item, DisplaySizeUnitID: 'g' }, [g, kg])).toEqual({ amount: 800, unit: g });
    expect(inventoryDisplay({ ...item, DisplaySizeUnitID: 'kg', ItemDefinition: { ...item.ItemDefinition, SizeUnitID: 'g', SizeUnit: g } }, [g, kg])).toEqual({ amount: 0.8, unit: kg });
    expect(inventoryDisplay({ ...item, base_size_unit_id: 'g', DisplaySizeUnitID: 'unknown' }, [g, kg]).amount).toBeNaN();
  });
  it('calculates shortages in base units and gives the fallback an explicit business unit', () => {
    const definition = { ID: 'rice', SizeUnit: kg, TargetQuantity: 1500 } as InventoryItem['ItemDefinition'];
    expect(restockAmount(definition, 800)).toBe(700);
    expect(restockAmount({ ...definition, TargetQuantity: null }, 800)).toBe(1000);
    expect(restockAmount({ ...definition, TargetQuantity: 1000.1 }, 1000)).toBe(0.1);
  });
  it('combines compatible stock without adding mass to volume', () => {
    const items = [
      { Quantity: 800, ItemDefinition: { SizeUnit: kg } },
      { Quantity: 500, ItemDefinition: { SizeUnit: g } },
      { Quantity: 2, ItemDefinition: { SizeUnit: ml } },
    ] as InventoryItem[];
    expect(inventoryTotals(items, [g, kg, ml])).toEqual([{ quantity: 1300, unit: g }, { quantity: 2, unit: ml }]);
  });
});
