import type { Category } from '@/types';

export function getCategoryOptions(categories: Category[] = [], language = 'en') {
  const ids = new Set(categories.map((category) => category.ID));
  const children = new Map<string, Category[]>();
  const sorted = [...categories].sort((a, b) => a.Name.localeCompare(b.Name, language));
  for (const category of sorted) {
    const parent = category.ParentID && ids.has(category.ParentID) ? category.ParentID : '';
    children.set(parent, [...(children.get(parent) || []), category]);
  }
  const options: { id: string; label: string }[] = [];
  const visited = new Set<string>();
  const append = (category: Category, depth: number) => {
    if (visited.has(category.ID)) return;
    visited.add(category.ID);
    options.push({
      id: category.ID,
      label: `${depth ? '  '.repeat(depth) : '- '}${category.Name}`,
    });
    children.get(category.ID)?.forEach((child) => append(child, depth + 1));
  };
  children.get('')?.forEach((category) => append(category, 0));
  // Keep malformed/cyclic category data selectable without infinite recursion.
  sorted.forEach((category) => append(category, 0));
  return options;
}
