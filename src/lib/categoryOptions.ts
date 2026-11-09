import type { Category } from '@/types';

export function getCategoryOrder(categories: Category[] = [], language = 'en') {
  const ids = new Set(categories.map((category) => category.ID));
  const children = new Map<string, Category[]>();
  const sorted = [...categories].sort((a, b) => a.Name.localeCompare(b.Name, language));
  for (const category of sorted) {
    const parent = category.ParentID && ids.has(category.ParentID) ? category.ParentID : '';
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push(category);
  }
  const ordered: { category: Category; depth: number }[] = [];
  const visited = new Set<string>();
  const append = (category: Category, depth: number) => {
    const pending = [{ category, depth }];
    while (pending.length) {
      const entry = pending.pop()!;
      if (visited.has(entry.category.ID)) continue;
      visited.add(entry.category.ID);
      ordered.push(entry);
      const descendants = children.get(entry.category.ID) || [];
      for (let i = descendants.length - 1; i >= 0; i--) pending.push({ category: descendants[i], depth: entry.depth + 1 });
    }
  };
  children.get('')?.forEach((category) => append(category, 0));
  // Keep malformed/cyclic category data selectable without infinite recursion.
  sorted.forEach((category) => append(category, 0));
  return ordered;
}

export function getCategoryOptions(categories: Category[] = [], language = 'en') {
  return getCategoryOrder(categories, language).map(({ category, depth }) => ({
    id: category.ID, label: `${depth ? '  '.repeat(depth) : '- '}${category.Name}`,
  }));
}
