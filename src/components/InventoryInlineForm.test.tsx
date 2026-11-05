import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import type { InventoryItem } from '@/types';
import { InventoryInlineForm } from './InventoryInlineForm';

vi.mock('./HomeProvider', () => ({ useHome: () => ({ currentHomeId: 'home-1' }) }));
const mockApi = new MockAdapter(api);
afterEach(() => mockApi.reset());
const item: InventoryItem = {
  ID: 'stock-1', HomeID: 'home-1', ItemDefinitionID: 'def-1', Quantity: 0.8,
  ExpirationDate: '2030-01-01T00:00:00Z',
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
