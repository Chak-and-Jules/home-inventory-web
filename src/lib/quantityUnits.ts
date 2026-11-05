import type { InventoryItem, ItemDefinition, SizeUnit } from '@/types';

// PR #138 validates six decimal places in base units, up to 1e9 base units.
// Use integers for conversion/validation; cross the JSON number boundary only last.
const MICRO = BigInt(1_000_000);
const LIMIT = BigInt(1_000_000_000) * MICRO;
function ratio(value: string | number): [bigint, bigint] {
  const text = String(value).trim().replace(/^([+-]?)\./, (_, sign) => `${sign}0.`);
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(text);
  if (!match || text.length > 100) throw new Error('quantity');
  const scale = (match[3]?.length || 0) - Number(match[4] || 0);
  if (Math.abs(scale) > 40) throw new Error('quantity');
  let n = BigInt(match[2] + (match[3] || '')) * (match[1] === '-' ? BigInt(-1) : BigInt(1));
  if (scale < 0) n *= BigInt(10) ** BigInt(-scale);
  return [n, BigInt(10) ** BigInt(Math.max(scale, 0))];
}
function decimal(n: bigint, d: bigint): string {
  const negative = n < BigInt(0);
  if (negative) n = -n;
  const integer = n / d;
  let remainder = n % d;
  let fraction = '';
  // Seeded factors (1 and 1000) terminate exactly; leave other display rounding here.
  while (remainder && fraction.length < 20) {
    remainder *= BigInt(10);
    fraction += String(remainder / d);
    remainder %= d;
  }
  return `${negative ? '-' : ''}${integer}${fraction ? `.${fraction.replace(/0+$/, '')}` : ''}`.replace(/\.$/, '');
}
export function hasUnitMetadata(unit?: SizeUnit): unit is SizeUnit & { Family: string; FactorToBase: number } {
  return !!unit?.Family && Number.isFinite(unit.FactorToBase) && (unit.FactorToBase || 0) > 0;
}
export function compatibleUnits(unit: SizeUnit | undefined, catalog: SizeUnit[]): SizeUnit[] {
  if (!unit) return [];
  if (!hasUnitMetadata(unit)) return [unit];
  return [...new Map([unit, ...catalog.filter((other) => hasUnitMetadata(other) && other.Family === unit.Family)].map((u) => [u.ID, u])).values()];
}
export function toBase(value: string | number, unit: SizeUnit, signed = false): number {
  const [n, d] = ratio(value);
  const [factor, factorD] = ratio(hasUnitMetadata(unit) ? unit.FactorToBase : 1);
  const numerator = n * factor * MICRO;
  const denominator = d * factorD;
  if ((!signed && n < BigInt(0)) || numerator % denominator || numerator > LIMIT * denominator || numerator < -LIMIT * denominator) throw new Error('quantity');
  return Number(decimal(n * factor, d * factorD));
}
export function fromBase(value: number, unit?: SizeUnit): string {
  if (!hasUnitMetadata(unit)) return unit?.base_size_unit_id && unit.ID !== unit.base_size_unit_id ? 'NaN' : String(value);
  const [n, d] = ratio(value);
  const [factor, factorD] = ratio(unit.FactorToBase);
  return decimal(n * factorD, d * factor);
}
export function convertInput(value: string, from: SizeUnit, to: SizeUnit): string {
  if (!value.trim()) return '';
  if (!hasUnitMetadata(from) || !hasUnitMetadata(to) || from.Family !== to.Family) throw new Error('unit');
  return fromBase(toBase(value, from), to);
}
export function quantityInput(value: string | number, unit?: SizeUnit, signed = false) {
  const quantity = Number(value);
  if (String(value).trim() === '' || !Number.isFinite(quantity) || (!signed && quantity < 0)) throw new Error('quantity');
  if (!hasUnitMetadata(unit)) {
    if (unit?.base_size_unit_id) throw new Error('unit');
    return { quantity };
  }
  toBase(value, unit, signed);
  return { quantity, quantity_unit_id: unit.ID };
}
export function inventoryUnit(item: InventoryItem, catalog: SizeUnit[]): SizeUnit | undefined {
  const id = item.DisplaySizeUnitID || item.effective_display_size_unit_id || item.ItemDefinition.SizeUnitID || item.ItemDefinition.SizeUnit?.ID;
  return catalog.find((u) => u.ID === id) || (item.ItemDefinition.SizeUnit?.ID === id ? item.ItemDefinition.SizeUnit : undefined);
}
export function inventoryDisplay(item: InventoryItem, catalog: SizeUnit[]) {
  const unit = inventoryUnit(item, catalog);
  const base = item.base_size_unit_id || item.ItemDefinition.base_size_unit_id;
  const known = !base || (unit && (hasUnitMetadata(unit) || unit.ID === base));
  return { amount: known ? Number(fromBase(item.Quantity, unit)) : NaN, unit };
}
export function baseUnitId(definition?: ItemDefinition): string | undefined {
  return definition?.base_size_unit_id || definition?.SizeUnit?.base_size_unit_id || (definition?.SizeUnit?.IsBase ? definition.SizeUnit.ID : undefined);
}
export function restockAmount(definition: ItemDefinition, stock: number): number {
  const fallback = hasUnitMetadata(definition.SizeUnit) ? definition.SizeUnit.FactorToBase : 1;
  const target = definition.TargetQuantity ?? definition.LowStockThreshold;
  if (target == null || target <= stock) return fallback;
  const [a, ad] = ratio(target);
  const [b, bd] = ratio(stock);
  return Number(decimal(a * bd - b * ad, ad * bd));
}

export function addQuantities(a: number, b: number): number {
  const [n, d] = ratio(a);
  const [bn, bd] = ratio(b);
  return Number(decimal(n * bd + bn * d, d * bd));
}

export function inventoryTotals(items: InventoryItem[], catalog: SizeUnit[]) {
  const totals = new Map<string, { quantity: number; unit?: SizeUnit }>();
  for (const item of items) {
    const key = baseUnitId(item.ItemDefinition) || item.ItemDefinition.SizeUnitID || item.ItemDefinition.SizeUnit?.ID || item.ItemDefinitionID;
    const existing = totals.get(key);
    totals.set(key, {
      quantity: addQuantities(existing?.quantity || 0, item.Quantity),
      unit: existing?.unit || catalog.find((unit) => unit.ID === key) || item.ItemDefinition.SizeUnit,
    });
  }
  return [...totals.values()];
}
