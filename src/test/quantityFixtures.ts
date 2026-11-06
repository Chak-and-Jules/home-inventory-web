import type { SizeUnit } from '@/types';
export const g: SizeUnit = { ID: 'g', Name: 'g', Family: 'mass', IsBase: true, FactorToBase: 1, base_size_unit_id: 'g' };
export const kg: SizeUnit = { ...g, ID: 'kg', Name: 'kg', IsBase: false, FactorToBase: 1000 };
export const ml: SizeUnit = { ...g, ID: 'ml', Name: 'mL', Family: 'volume', base_size_unit_id: 'ml' };
export const liter: SizeUnit = { ...ml, ID: 'l', Name: 'L', IsBase: false, FactorToBase: 1000 };
