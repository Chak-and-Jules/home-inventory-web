import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import type { ApiGuide, Guide } from '@/types/guide';
import { GUIDE_CLIENT_VERSION, INTRODUCTION, useGuides } from './useGuides';
import { apiGuide } from '@/test/guideFixture';
import { GuideSettings } from '@/components/guides/GuideSettings';

const scope = vi.hoisted(() => ({ uid: 'guide-user', home: 'guide-home', push: vi.fn() }));
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ session: { user: { uid: scope.uid } } }) }));
vi.mock('@/components/HomeProvider', () => ({ useHome: () => ({ currentHomeId: scope.home, isLoading: false }) }));
vi.mock('@/lib/firebase', () => ({ getFirebaseIdentity: async () => ({ uid: scope.uid, token: 'guide-token' }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: scope.push }) }));
let client: QueryClient;
let mock: MockAdapter;
let guide: Guide;
const initial = (): Guide => ({ id: INTRODUCTION, revision: 1, platform: 'web', platform_revision: 1, steps: ['welcome', 'definition', 'stock', 'dashboard'], available: true, unavailable_reason: '', can_write: true, status: 'available', version: 0,
  checkpoint: { revision: 1, status: 'available', step: 'welcome', restored: false, deferred_until: null, home_id: null, definition_id: null, inventory_id: null } });
function wrapper({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
beforeEach(() => {
  vi.clearAllMocks(); scope.uid = 'guide-user'; scope.home = 'guide-home'; localStorage.clear(); guide = initial();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  mock = new MockAdapter(api);
  mock.onGet('/guides').reply(config => {
    expect(config.headers?.Authorization).toBe('Bearer guide-token');
    expect(config.headers?.['X-Home-Id']).toBe(scope.home);
    expect(config.params).toMatchObject({ platform: 'web', client_version: GUIDE_CLIENT_VERSION });
    return [200, [apiGuide(guide)]];
  });
});
afterEach(() => { cleanup(); client.clear(); mock.restore(); });
describe('durable guide client', () => {
  it('loads registered web variants with authenticated explicit-home requests', async () => {
    const { result } = renderHook(() => useGuides('dashboard'), { wrapper });
    await waitFor(() => expect(result.current.guides).toHaveLength(1));
    expect(result.current.invitationId).toBe(INTRODUCTION);
    expect(mock.history.get[0].params).toEqual({ platform:'web', client_version:2 });
    expect(client.getQueryData(['guides', scope.uid, 'web', scope.home, 'dashboard'])).toBeDefined();
  });
  it('reuses the idempotency ID after a failed response and preserves the expected version', async () => {
    let calls = 0;
    mock.onPost(`/guides/${INTRODUCTION}/actions`).reply(() => {
      if (++calls === 1) return [500, { error: 'Response lost' }];
      guide = { ...guide, status: 'in_progress', version: 1 };
      return [200, apiGuide(guide)];
    });
    const { result } = renderHook(() => useGuides('dashboard'), { wrapper });
    await waitFor(() => expect(result.current.guides).toHaveLength(1));
    const variables = { guide: initial(), input: { action: 'start' as const } };
    await act(async () => { await result.current.mutation.mutateAsync(variables).catch(() => {}); });
    expect(mock.history.post).toHaveLength(1); // No automatic mutation replay.
    await act(async () => { await result.current.mutation.mutateAsync(variables); });
    const bodies = mock.history.post.map(request => JSON.parse(request.data));
    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[0]).toMatchObject({ action: 'start', platform: 'web', client_version: 2, revision: 1, expected_version: 0 });
    expect(bodies[0].request_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.current.guides[0].version).toBe(1);
  });
  it('refreshes a stale checkpoint after 409 without replaying the mutation', async () => {
    mock.onPost(`/guides/${INTRODUCTION}/actions`).reply(() => {
      guide = { ...guide, status: 'completed', version: 7 };
      return [409, { error: 'Guide changed' }];
    });
    const { result } = renderHook(() => useGuides('dashboard'), { wrapper });
    await waitFor(() => expect(result.current.guides).toHaveLength(1));
    await act(async () => { await result.current.mutation.mutateAsync({ guide: initial(), input: { action: 'checkpoint', step: 'definition' } }).catch(() => {}); });
    await waitFor(() => expect(result.current.guides[0].status).toBe('completed'));
    expect(result.current.invitationId).toBeNull();
    expect(mock.history.post).toHaveLength(1);
  });
  it('keeps guide queries isolated when the account/home changes', async () => {
    const { result, rerender } = renderHook(() => useGuides('dashboard'), { wrapper });
    await waitFor(() => expect(result.current.guides).toHaveLength(1));
    scope.home = 'other-home'; scope.uid = 'other-user'; guide = initial(); rerender();
    expect(result.current.guides).toEqual([]);
    await waitFor(() => expect(result.current.guides).toHaveLength(1));
    expect(client.getQueryData(['guides', 'other-user', 'web', 'other-home', 'dashboard'])).toBeDefined();
  });
  it('keeps a late mutation response in the account and home that submitted it', async () => {
    let respond!: (response: [number, ApiGuide]) => void;
    mock.onPost(`/guides/${INTRODUCTION}/actions`).reply(() => new Promise(resolve => { respond = resolve; }));
    const { result, rerender } = renderHook(() => useGuides('dashboard'), { wrapper });
    await waitFor(() => expect(result.current.guides).toHaveLength(1));
    let saving!: Promise<Guide>;
    act(() => { saving = result.current.mutation.mutateAsync({ guide: initial(), input: { action: 'start' } }); });
    await waitFor(() => expect(respond).toBeDefined());
    scope.home = 'other-home'; scope.uid = 'other-user'; rerender();
    await waitFor(() => expect(result.current.guides).toHaveLength(1));
    // Keep the other account's query inactive to expose any erroneous cache write.
    client.setQueryDefaults(['guides', scope.uid, 'web'], { enabled: false });
    await act(async () => { respond([200, apiGuide({ ...initial(), status: 'in_progress', version: 1 })]); await saving; });
    expect(result.current.guides[0].status).toBe('available');
    expect(result.current.guides[0].version).toBe(0);
  });
  it('lists only web tutorials in settings and restores the web variant explicitly', async () => {
    guide = { ...guide, status: 'completed', version: 4 };
    mock.onGet('/guides').reply(200, [apiGuide(guide), apiGuide({ ...guide, platform:'mobile' })]);
    mock.onPost(`/guides/${INTRODUCTION}/actions`).reply(config => {
      expect(JSON.parse(config.data)).toMatchObject({ platform: 'web', action: 'restore', expected_version: 4 });
      return [200, apiGuide({ ...guide, status:'available', version:5 })];
    });
    render(<GuideSettings />, { wrapper });
    const restore = await screen.findByRole('button', { name: 'guides.restore' });
    expect(screen.getAllByRole('button', { name: 'guides.restore' })).toHaveLength(1);
    await userEvent.click(restore);
    await waitFor(() => expect(scope.push).toHaveBeenCalledWith(`/guides/${INTRODUCTION}`));
  });
});
