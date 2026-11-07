'use client';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useHome } from '@/components/HomeProvider';
import { INTRODUCTION, useGuides } from '@/hooks/useGuides';
import type { Category, InventoryItem, ItemDefinition, SizeUnit } from '@/types';
import type { Guide, GuideInput } from '@/types/guide';
import { getCategoryOptions } from '@/lib/categoryOptions';
import { compatibleUnits, convertInput, quantityInput } from '@/lib/quantityUnits';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { QuantityInput } from '@/components/QuantityInput';

export default function GuidePage() {
  const { id } = useParams<{ id: string }>();
  const { currentHomeId } = useHome();
  const query = useGuides('settings');
  const { t } = useTranslation();
  const guide = query.guides.find(item => item.id === id && item.id === INTRODUCTION);
  if (query.isPending) return <p role="status">{t('ui.loading')}</p>;
  if (query.isError) return <p role="alert">{t('guides.loadFailed')} <Button onClick={() => { void query.refetch(); }}>{t('guides.retry')}</Button></p>;
  if (!guide) return <p role="alert">{t('guides.unavailable')}</p>;
  return <Introduction key={`${currentHomeId}:${guide.checkpoint.definition_id || ''}`} guide={guide} mutation={query.mutation} />;
}

function Introduction({ guide, mutation }: { guide: Guide; mutation: ReturnType<typeof useGuides>['mutation'] }) {
  const { t, i18n } = useTranslation();
  const { currentHomeId } = useHome();
  const router = useRouter();
  const headers = { 'X-Home-Id': currentHomeId };
  const enabled = !!currentHomeId && guide.available;
  const definitions = useQuery({ queryKey: ['itemDefs', currentHomeId], queryFn: async () => (await api.get<ItemDefinition[]>('/item-definitions', { headers })).data, enabled });
  const inventory = useQuery({ queryKey: ['inventory', currentHomeId], queryFn: async () => (await api.get<InventoryItem[]>('/inventory', { headers })).data, enabled });
  const units = useQuery({ queryKey: ['sizeUnits'], queryFn: async () => (await api.get<SizeUnit[]>('/size-units')).data, enabled });
  const categories = useQuery({ queryKey: ['categories', currentHomeId], queryFn: async () => (await api.get<Category[]>('/categories', { headers })).data, enabled });
  const [name, setName] = useState('');
  const [unitId, setUnitId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [definitionId, setDefinitionId] = useState('');
  const [inventoryId, setInventoryId] = useState('');
  const [creating, setCreating] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const categoryOptions = useMemo(() => getCategoryOptions(categories.data, i18n.language), [categories.data, i18n.language]);
  const perform = (input: GuideInput) => mutation.mutateAsync({ guide, input }).catch(() => undefined);
  const step = guide.checkpoint.step;
  const mismatch = guide.checkpoint.home_id && guide.checkpoint.home_id !== currentHomeId;
  const busy = mutation.isPending;
  const loaded = !definitions.isPending && !inventory.isPending && !units.isPending;
  const selected = definitions.data?.find(item => item.ID === guide.checkpoint.definition_id);
  const stepIndex = Math.max(0, guide.steps.indexOf(step));
  return <div className="mx-auto max-w-2xl space-y-4">
    <h1 className="text-2xl font-bold">{t('guides.introduction.title')}</h1>
    <p role="status">{t('guides.stepCount', { current: stepIndex + 1, total: guide.steps.length })}</p>
    <Card><CardContent className="space-y-4 pt-6">
      <h2 className="text-xl font-semibold">{t(`guides.step.${step}`)}</h2>
      {(mutation.isError || invalid) && <p role="alert" className="text-red-600">{t(invalid ? 'ui.invalidQuantity' : 'guides.saveFailed')}</p>}
      {!guide.available ? <><p>{t('guides.unavailable')}</p><Link href="/profile">{t('guides.settingsTitle')}</Link></> : mismatch ? <><p>{t('guides.changedHome')}</p><Button disabled={busy} onClick={() => { void perform({ action: 'start' }); }}>{t('guides.continueHere')}</Button></> : ['completed', 'skipped'].includes(guide.status) ? <><p>{t(`guides.status.${guide.status}`)}</p><Button disabled={busy} onClick={() => { void perform({ action: 'restore' }); }}>{t('guides.restore')}</Button></> : <>
        {step === 'welcome' && <>
          <p>{t('guides.homeHelp')}</p><p>{t('guides.definitionHelp')}</p>
          <Button disabled={busy} onClick={() => { void perform(guide.status === 'available' ? { action: 'start' } : { action: 'checkpoint', step: 'definition' }); }}>{t(guide.status === 'available' ? 'guides.start' : 'guides.next')}</Button>
        </>}
        {step === 'definition' && <>
          <p>{t('guides.definitionHelp')}</p><p>{t('guides.categoryHelp')}</p><p>{t('guides.optionalHelp')}</p>
          {!guide.can_write && <p>{t('guides.viewerHelp')}</p>}
          {!loaded ? <p role="status">{t('ui.loading')}</p> : <>
            {!!inventory.data?.length && <div className="space-y-2">
              <Label htmlFor="guide-stock">{t('guides.existingStock')}</Label>
              <Select id="guide-stock" value={inventoryId} onChange={event => setInventoryId(event.target.value)} disabled={busy}><option value="">{t('guides.choose')}</option>{inventory.data.map(item => <option key={item.ID} value={item.ID}>{item.ItemDefinition.Name}</option>)}</Select>
              <Button disabled={busy || !inventoryId} onClick={() => { void perform({ action: 'choose_inventory', inventory_id: inventoryId }).then(result => { if (result) router.push('/'); }); }}>{t('guides.useStock')}</Button>
            </div>}
            {!!definitions.data?.length && !creating && <div className="space-y-2">
              <Label htmlFor="guide-definition">{t('guides.existingDefinition')}</Label>
              <Select id="guide-definition" value={definitionId} disabled={busy} onChange={event => setDefinitionId(event.target.value)}><option value="">{t('guides.choose')}</option>{definitions.data.map(item => <option key={item.ID} value={item.ID}>{item.Name}</option>)}</Select>
              <Button disabled={busy || !definitionId} onClick={() => { void perform({ action: 'choose_definition', definition_id: definitionId }); }}>{t('guides.useDefinition')}</Button>
            </div>}
            {guide.can_write && (!!definitions.data?.length && !creating ? <Button variant="outline" onClick={() => setCreating(true)}>{t('guides.createDefinition')}</Button> : <form className="space-y-3" onSubmit={event => {
              event.preventDefault(); void perform({ action: 'create_definition', definition: { name: name.trim(), size_unit_id: unitId, category_id: categoryId || undefined, is_expirable: false } });
            }}>
              <div><Label htmlFor="guide-name">{t('ui.nameRequired')}</Label><Input id="guide-name" autoComplete="off" value={name} required maxLength={255} disabled={busy} onChange={event => setName(event.target.value)} /></div>
              <div><Label htmlFor="guide-unit">{t('ui.sizeUnitRequired')}</Label><Select id="guide-unit" value={unitId} required disabled={busy} onChange={event => setUnitId(event.target.value)}><option value="">{t('ui.selectUnit')}</option>{units.data?.map(unit => <option key={unit.ID} value={unit.ID}>{unit.Name}</option>)}</Select></div>
              <div><Label htmlFor="guide-category">{t('ui.categoryOptional')}</Label><Select id="guide-category" value={categoryId} disabled={busy} onChange={event => setCategoryId(event.target.value)}><option value="">{t('ui.none')}</option>{categoryOptions.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</Select></div>
              <Button type="submit" disabled={busy || !name.trim() || !unitId}>{t('guides.saveDefinition')}</Button>
            </form>)}
            {!guide.can_write && <Button disabled={busy} onClick={() => { void perform({ action: 'checkpoint', step: 'stock' }); }}>{t('guides.next')}</Button>}
          </>}
        </>}
        {step === 'stock' && <>
          <p>{t('guides.stockHelp')}</p>
          {!guide.can_write ? <><p>{t('guides.viewerHelp')}</p><Button disabled={busy} onClick={() => { void perform({ action: 'checkpoint', step: 'dashboard' }).then(result => { if (result) router.push('/'); }); }}>{t('guides.seeDashboard')}</Button></> : !loaded || (!selected && definitions.isFetching) ? <p role="status">{t('ui.loading')}</p> : selected ? <StockForm key={selected.ID} definition={selected} units={units.data || []} busy={busy} onSave={input => {
            setInvalid(false); void perform(input).then(result => { if (result) router.push('/'); });
          }} onInvalid={() => setInvalid(true)} /> : <><p role="alert">{t('guides.missingRecord')}</p><Button onClick={() => { void perform({ action: 'restore' }); }}>{t('guides.restore')}</Button></>}
        </>}
        {step === 'dashboard' && <><p>{t(guide.can_write ? 'guides.dashboardHelp' : 'guides.viewerDashboardHelp')}</p><Button onClick={() => router.push('/')}>{t('guides.seeDashboard')}</Button></>}
      </>}
      {(definitions.isError || inventory.isError || units.isError || categories.isError) && <p role="alert">{t('guides.loadFailed')} <Button variant="outline" onClick={() => { void definitions.refetch(); void inventory.refetch(); void units.refetch(); void categories.refetch(); }}>{t('guides.retry')}</Button></p>}
    </CardContent></Card>
    {!['completed', 'skipped'].includes(guide.status) && <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy} onClick={() => { void perform({ action: 'defer' }).then(result => { if (result) router.push('/'); }); }}>{t('guides.later')}</Button>
      <Button variant="ghost" disabled={busy} onClick={() => { void perform({ action: 'skip' }).then(result => { if (result) router.push('/'); }); }}>{t('guides.skip')}</Button>
    </div>}
  </div>;
}
function StockForm({ definition, units, busy, onSave, onInvalid }: { definition: ItemDefinition; units: SizeUnit[]; busy: boolean; onSave: (input: GuideInput) => void; onInvalid: () => void }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('1');
  const [unitId, setUnitId] = useState(definition.SizeUnitID || definition.SizeUnit?.ID || '');
  const [expiry, setExpiry] = useState('');
  const choices = compatibleUnits(definition.SizeUnit, units);
  const unit = choices.find(item => item.ID === unitId) || definition.SizeUnit;
  return <form className="space-y-3" onSubmit={event => {
    event.preventDefault();
    try { onSave({ action: 'create_inventory', inventory: { item_definition_id: definition.ID, ...quantityInput(amount, unit), expiry_date: expiry ? new Date(expiry).toISOString() : undefined } }); } catch { onInvalid(); }
  }}>
    <p className="font-semibold">{definition.Name}</p>
    <Label htmlFor="guide-quantity">{t('ui.quantity')}</Label><QuantityInput id="guide-quantity" value={amount} unit={unit?.Name} onChange={event => setAmount(event.target.value)} disabled={busy} required />
    <Label htmlFor="guide-quantity-unit">{t('ui.quantityUnit')}</Label><Select id="guide-quantity-unit" value={unitId} disabled={busy} onChange={event => {
      const next = choices.find(item => item.ID === event.target.value); if (!unit || !next) return;
      try { setAmount(convertInput(amount, unit, next)); setUnitId(next.ID); } catch { onInvalid(); }
    }}>{choices.map(item => <option key={item.ID} value={item.ID}>{item.Name}</option>)}</Select>
    <Label htmlFor="guide-expiry">{t('guides.expiryOptional')}</Label><Input id="guide-expiry" type="date" value={expiry} disabled={busy} onChange={event => setExpiry(event.target.value)} />
    <Button type="submit" disabled={busy}>{t('guides.saveStock')}</Button>
  </form>;
}
