import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import type { InventoryItem } from '@/types';
import { InventoryInlineForm } from './InventoryInlineForm';
import { g, kg, ml } from '@/test/quantityFixtures';

vi.mock('./HomeProvider', () => ({ useHome: () => ({ currentHomeId: 'home-1' }) }));
const mockApi = new MockAdapter(api);
afterEach(() => mockApi.reset());
const item: InventoryItem = {
  ID: 'stock-1', HomeID: 'home-1', ItemDefinitionID: 'def-1', Quantity: 0.8,
  expiry_date: '2030-01-01T00:00:00Z',
  ItemDefinition: { ID: 'def-1', Name: 'Rice', Description: '', ImageURL: '', IsExpirable: true, SizeUnit: { ID: 'kg-id', Name: 'kg' } },
};

it('preserves current API semantics while showing the quantity-unit layout', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  mockApi.onPut('/inventory/stock-1').reply(200, {});
  render(<QueryClientProvider client={client}><InventoryInlineForm item={item} onClose={onClose} /></QueryClientProvider>);
  expect(screen.getByRole('spinbutton')).toHaveAccessibleDescription('kg');
  const input = screen.getByRole('spinbutton');
  await user.clear(input);
  await user.click(screen.getByRole('button', { name: 'categories.save' }));
  expect(mockApi.history.put).toHaveLength(0);
  await user.type(input, '0');
  await user.click(screen.getByRole('button', { name: 'categories.save' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(JSON.parse(mockApi.history.put[0].data)).toEqual({ quantity: 0, expiry_date: '2030-01-01T00:00:00.000Z' });
  expect(mockApi.history.put[0].headers?.['X-Home-Id']).toBe('home-1');
});

const modernItem: InventoryItem = {
  ...item, Quantity: 3000, base_size_unit_id: 'g', DisplaySizeUnitID: null,
  ItemDefinition: { ...item.ItemDefinition, SizeUnitID: 'kg', SizeUnit: kg, base_size_unit_id: 'g' },
};
function modernEditor(stock = modernItem) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(['sizeUnits'], [g, kg, ml]);
  const onClose = vi.fn();
  render(<QueryClientProvider client={client}><InventoryInlineForm item={stock} onClose={onClose} /></QueryClientProvider>);
  return onClose;
}

it('edits absolute stock using the chosen input unit and independent display preference', async () => {
  const user = userEvent.setup();
  mockApi.onPatch('/inventory/stock-1').reply(200, { ...modernItem, Quantity: 800, DisplaySizeUnitID: 'g' });
  const onClose = modernEditor();
  expect(screen.getByRole('spinbutton')).toHaveValue(3);
  expect(screen.queryByRole('option', { name: 'mL' })).not.toBeInTheDocument();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Input unit' }), 'g');
  expect(screen.getByRole('spinbutton')).toHaveValue(3000);
  await user.clear(screen.getByRole('spinbutton'));
  await user.type(screen.getByRole('spinbutton'), '800');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Display unit' }), 'g');
  await user.click(screen.getByRole('button', { name: 'categories.save' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(JSON.parse(mockApi.history.patch[0].data)).toEqual({ quantity: 800, quantity_unit_id: 'g', display_size_unit_id: 'g' });
  expect(mockApi.history.patch[0].headers?.['X-Home-Id']).toBe('home-1');
});

it.each([['explicit default', null, 'kg', 'kg'], ['inheritance', 'kg', '', null]])('saves %s with a display-only PATCH', async (_, initial, selection, expected) => {
  const user = userEvent.setup();
  mockApi.onPatch('/inventory/stock-1').reply(200, {});
  const onClose = modernEditor({ ...modernItem, DisplaySizeUnitID: initial });
  // Switching the input unit preserves the physical amount and adds no stock write.
  await user.selectOptions(screen.getByRole('combobox', { name: 'Input unit' }), 'g');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Display unit' }), selection as string);
  await user.click(screen.getByRole('button', { name: 'categories.save' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(JSON.parse(mockApi.history.patch[0].data)).toEqual({ display_size_unit_id: expected });
});

it('rejects unsupported base precision before sending a quantity', async () => {
  const user = userEvent.setup();
  modernEditor();
  await user.clear(screen.getByRole('spinbutton'));
  await user.type(screen.getByRole('spinbutton'), '0.0000000001');
  await user.click(screen.getByRole('button', { name: 'categories.save' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid amount');
  expect(mockApi.history.patch).toHaveLength(0);
});
