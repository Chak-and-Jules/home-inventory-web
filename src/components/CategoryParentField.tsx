'use client';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { categoryParentIssue, categoryParents, hasInvalidCategoryHierarchy } from '@/lib/categoryHierarchy';
import type { Category } from '@/types';
import type { useCategories } from '@/hooks/useCategories';
import { Label } from './ui/label';
import { Select } from './ui/select';
import { Button } from './ui/button';

export function CategoryParentField({ categories = [], value, onChange, editingId, disabled, compact = false }: {
  categories?: Category[]; value: string; onChange: (value: string) => void;
  editingId?: string | null; disabled?: boolean; compact?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const parents = categoryParents(categories, i18n.language, editingId);
  const issue = categoryParentIssue(categories, value, editingId);
  const hasChildren = !!editingId && categories.some(category => category.ParentID === editingId);
  const unavailable = !!value && !parents.some(category => category.ID === value);
  return <div className="space-y-2">
    <Label htmlFor={id} className={compact ? 'sr-only' : undefined}>{t('categories.parent')}</Label>
    <Select id={id} value={value} onChange={event => onChange(event.target.value)}
      disabled={disabled || (hasChildren && !value)} aria-invalid={!!issue}
      aria-describedby={`${id}-help${issue ? ` ${id}-error` : ''}`}>
      <option value="">{t('categories.none')}</option>
      {unavailable && <option value={value} disabled>{t('categories.hierarchy.invalidSelection', {
        name: categories.find(category => category.ID === value)?.Name || t('categories.hierarchy.parentUnavailable'),
      })}</option>}
      {parents.map(category => <option key={category.ID} value={category.ID}>- {category.Name}</option>)}
    </Select>
    <p id={`${id}-help`} className="text-xs text-gray-500 dark:text-gray-400">{t(`categories.hierarchy.${hasChildren ? 'hasChildren' : 'parentHelp'}`)}</p>
    {issue && <p id={`${id}-error`} role="alert" className="text-sm text-red-600 dark:text-red-400">{t(`categories.hierarchy.${issue}`)}</p>}
  </div>;
}

export function CategoryLoadNotice({ query }: { query: ReturnType<typeof useCategories> }) {
  const { t } = useTranslation();
  return <>
    {query.isPending && <p role="status" className="text-sm text-gray-500 dark:text-gray-400">{t('ui.loading')}</p>}
    {query.isError && <div role="alert" className="space-y-2 text-sm text-red-600 dark:text-red-400">
      <p>{t('categories.hierarchy.loadFailed')}</p>
      <Button type="button" variant="outline" disabled={query.isFetching} onClick={() => { void query.refetch(); }}>{t('categories.hierarchy.retry')}</Button>
    </div>}
    {query.data && hasInvalidCategoryHierarchy(query.data) && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{t('categories.hierarchy.malformed')}</p>}
  </>;
}
