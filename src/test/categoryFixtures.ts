import type { Category, CategoryError } from '@/types';

// Wire fixtures from backend PR #150 / merge 41cf1e9. Parent snapshots are
// bounded even when the flat ParentID relationships contain a cycle.
export const categoryHomeId = '00000000-0000-4000-8000-000000000001';
export const categoryIds = {
  kitchen: '10000000-0000-4000-8000-000000000001',
  drinks: '10000000-0000-4000-8000-000000000002',
  household: '10000000-0000-4000-8000-000000000003',
  soda: '10000000-0000-4000-8000-000000000004',
  orphan: '10000000-0000-4000-8000-000000000005',
  cycleA: '10000000-0000-4000-8000-000000000006',
  cycleB: '10000000-0000-4000-8000-000000000007',
  missing: '10000000-0000-4000-8000-000000000099',
};
const fields = { HomeID: categoryHomeId, CreatedAt: '2026-11-09T12:00:00Z', UpdatedAt: '2026-11-09T12:00:00Z' };
const kitchen: Category = { ...fields, ID: categoryIds.kitchen, Name: 'Kitchen', ParentID: null, Parent: null };
const drinks: Category = { ...fields, ID: categoryIds.drinks, Name: 'Drinks', ParentID: kitchen.ID, Parent: null };
const cycleA: Category = { ...fields, ID: categoryIds.cycleA, Name: 'Cycle A', ParentID: categoryIds.cycleB, Parent: null };
const cycleB: Category = { ...fields, ID: categoryIds.cycleB, Name: 'Cycle B', ParentID: categoryIds.cycleA, Parent: null };
export const categoryWireFixture: Category[] = [
  kitchen,
  { ...drinks, Parent: kitchen },
  { ...fields, ID: categoryIds.household, Name: 'Household', ParentID: null, Parent: null },
  { ...fields, ID: categoryIds.soda, Name: 'Soda', ParentID: drinks.ID, Parent: drinks },
  { ...fields, ID: categoryIds.orphan, Name: 'Orphan', ParentID: categoryIds.missing, Parent: null },
  { ...cycleA, Parent: cycleB },
  { ...cycleB, Parent: cycleA },
];

// Exact localized CategoryError bodies; the backend introduces no code field.
export const categoryBackendErrors = {
  en: {
    invalidParent: { error: 'Parent category must be a top-level category' },
    hasChildren: { error: 'A category with children cannot become a child category' },
    parentNotFound: { error: 'Parent category not found' },
    categoryNotFound: { error: 'Category not found' },
    nameConflict: { error: 'A category with this name already exists at this level' },
  },
  tr: {
    invalidParent: { error: 'Üst kategori en üst düzeyde bir kategori olmalıdır' },
    hasChildren: { error: 'Alt kategorileri olan bir kategori, alt kategori yapılamaz' },
    parentNotFound: { error: 'Üst kategori bulunamadı' },
    categoryNotFound: { error: 'Kategori bulunamadı' },
    nameConflict: { error: 'Bu düzeyde aynı isme sahip bir kategori zaten mevcut' },
  },
} satisfies Record<string, Record<string, CategoryError>>;
