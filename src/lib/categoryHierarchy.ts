import { isAxiosError } from 'axios';
import type { Category, CategoryError } from '@/types';

export type CategoryIssue = 'loadFailed' | 'invalidParent' | 'hasChildren' | 'dataChanged';
export class CategoryValidationError extends Error {
  constructor(readonly reason: CategoryIssue) { super(reason); }
}

// Validate the wire shape without treating malformed relationships as an empty
// list. Rebuild shallow Parent objects from IDs so cycles cannot enter the cache.
export function readCategories(value: unknown, homeId: string | null): Category[] {
  if (!Array.isArray(value)) throw new CategoryValidationError('loadFailed');
  const ids = new Set<string>();
  const categories = value.map((item): Category => {
    if (!item || typeof item !== 'object' || typeof item.ID !== 'string' || !item.ID ||
      typeof item.Name !== 'string' || ids.has(item.ID) ||
      (item.ParentID != null && (typeof item.ParentID !== 'string' || !item.ParentID)) ||
      (item.HomeID != null && item.HomeID !== homeId)) throw new CategoryValidationError('loadFailed');
    ids.add(item.ID);
    return { ...item, Parent: undefined };
  });
  const byId = new Map(categories.map(category => [category.ID, category]));
  return categories.map(category => ({ ...category, Parent: category.ParentID ? byId.get(category.ParentID) : undefined }));
}

export function categoryParentIssue(categories: Category[], parentId: string, editingId?: string | null): CategoryIssue | null {
  if (editingId && !categories.some(category => category.ID === editingId)) return 'dataChanged';
  if (!parentId) return null;
  if (editingId && categories.some(category => category.ParentID === editingId)) return 'hasChildren';
  const parent = categories.find(category => category.ID === parentId);
  return !parent || parent.ParentID != null || parent.ID === editingId ? 'invalidParent' : null;
}

export function categoryParents(categories: Category[], language: string, editingId?: string | null) {
  if (editingId && categories.some(category => category.ParentID === editingId)) return [];
  return categories.filter(category => category.ParentID == null && category.ID !== editingId)
    .sort((a, b) => a.Name.localeCompare(b.Name, language));
}

export function hasInvalidCategoryHierarchy(categories: Category[]) {
  const byId = new Map(categories.map(category => [category.ID, category]));
  return categories.some(category => category.ParentID != null &&
    (!byId.has(category.ParentID) || byId.get(category.ParentID)?.ParentID != null));
}

export function categoryError(error: unknown, fallback: string, translate: (key: string) => string) {
  if (error instanceof CategoryValidationError) return translate(`categories.hierarchy.${error.reason}`);
  const message = isAxiosError<Partial<CategoryError>>(error) ? error.response?.data?.error : undefined;
  return typeof message === 'string' && message.trim() ? message : fallback;
}
