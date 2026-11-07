import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import type { InventoryItem } from '@/types';
import { g, kg } from '@/test/quantityFixtures';
import EditInventoryItem from './page';

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation, useParams: () => ({ id: 'stock-1' }) }));
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ session: { user: { uid: 'fixture-user' } } }) }));
vi.mock('@/components/HomeProvider', () => ({ useHome: () => ({ currentHomeId: 'home-1' }) }));
vi.mock('@/lib/firebase', () => ({ getFirebaseIdentity: async () => ({ uid: 'fixture-user', token: 'fixture-token' }) }));

const mockApi = new MockAdapter(api);
const item: InventoryItem = {
  ID: 'stock-1', HomeID: 'home-1', ItemDefinitionID: 'rice', Quantity: 800,
  expiry_date: '2030-01-01T00:00:00Z', DisplaySizeUnitID: null, base_size_unit_id: 'g',
  ItemDefinition: { ID: 'rice', Name: 'Rice', Description: '', ImageURL: '', IsExpirable: true, SizeUnitID: 'kg', SizeUnit: kg },
};
function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['inventory', 'home-1'], [item]);
  client.setQueryData(['sizeUnits'], [g, kg]);
  return render(<QueryClientProvider client={client}><EditInventoryItem /></QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); mockApi.reset(); });
afterEach(() => mockApi.reset());

describe('direct inventory edit page', () => {
  it('shows the quantity and its unit without profile or maintenance tabs', () => {
    renderEditor();
    expect(screen.getByRole('heading', { name: 'Edit Rice' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Quantity' })).toHaveValue('0.8');
    expect(screen.getByRole('textbox', { name: 'Quantity' })).toHaveAccessibleDescription('kg');
    expect(screen.getByRole('combobox', { name: 'Input unit' })).toHaveValue('kg');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
  });

  it('saves an explicit input unit and returns to the dashboard', async () => {
    const user = userEvent.setup();
    mockApi.onPatch('/inventory/stock-1').reply(200, { ...item, Quantity: 1200 });
    mockApi.onGet('/inventory').reply(200, [{ ...item, Quantity: 1200 }]);
    renderEditor();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Input unit' }), 'g');
    const quantity = screen.getByRole('textbox', { name: 'Quantity' });
    expect(quantity).toHaveValue('800');
    await user.clear(quantity);
    await user.type(quantity, '1200');
    await user.click(screen.getByRole('button', { name: 'categories.save' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/'));
    expect(JSON.parse(mockApi.history.patch[0].data)).toEqual({ quantity: 1200, quantity_unit_id: 'g' });
    expect(mockApi.history.patch[0].headers?.['X-Home-Id']).toBe('home-1');
  });

  it('cancels without writing stock', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'categories.cancel' }));
    expect(navigation.push).toHaveBeenCalledWith('/');
    expect(mockApi.history.patch).toHaveLength(0);
    expect(mockApi.history.put).toHaveLength(0);
  });
});
