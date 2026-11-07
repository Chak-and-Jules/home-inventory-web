import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSignedUrls } from './useSignedUrls';
import { getSignedImages } from '@/lib/image-storage';
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ session: scope.uid ? { user: { uid: scope.uid } } : null }) }));
vi.mock('@/components/HomeProvider', () => ({ useHome: () => ({ currentHomeId: scope.homeId }) }));
vi.mock('@/lib/image-storage', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/image-storage')>(), getSignedImages: vi.fn(),
}));
const scope = vi.hoisted(() => ({ uid: 'user-a' as string | null, homeId: '00000000-0000-4000-8000-000000000001' as string | null }));
const home = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const path = `${home}/00000000-0000-4000-8000-000000000003.jpg`;
let client: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
async function tick(ms = 1) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-07T00:00:00Z'));
  vi.clearAllMocks(); scope.uid = 'user-a'; scope.homeId = home;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(getSignedImages).mockImplementation(async paths => paths.map(path => ({ path, url: `https://storage.googleapis.com/test?at=${Date.now()}`, expires_at: new Date(Date.now() + 900_000).toISOString() })));
});
afterEach(() => { cleanup(); client.clear(); vi.useRealTimers(); focusManager.setFocused(undefined); });

describe('expiry-aware private image URLs', () => {
  it('deduplicates same-home keys, excludes legacy URLs, and never persists bearer URLs', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useSignedUrls([path, path, null, 'legacy/image.jpg', `https://example.test/${path}`]), { wrapper });
    await tick();
    expect(getSignedImages).toHaveBeenCalledExactlyOnceWith([path], home, expect.any(AbortSignal));
    expect(result.current.data[path]).toContain('https://storage.googleapis.com/');
    expect(storage).not.toHaveBeenCalled(); storage.mockRestore();
  });
  it('refreshes one minute before expires_at without a fixed day-long cache', async () => {
    const { result } = renderHook(() => useSignedUrls([path]), { wrapper });
    await tick(); const first = result.current.data[path];
    await tick(838_000); expect(getSignedImages).toHaveBeenCalledTimes(1);
    await tick(2_000); expect(getSignedImages).toHaveBeenCalledTimes(2);
    expect(result.current.data[path]).not.toBe(first);
  });
  it('removes expired URLs even if provider refreshes fail', async () => {
    const { result } = renderHook(() => useSignedUrls([path]), { wrapper });
    await tick();
    vi.mocked(getSignedImages).mockRejectedValue(new Error('provider unavailable'));
    await tick(840_000); expect(result.current.data[path]).toBeDefined();
    await tick(61_000); expect(result.current.data[path]).toBeUndefined();
    expect(result.current.isError).toBe(true);
  });
  it('removes each batch at its own expiry when refreshes keep failing', async () => {
    const secondPath = path.replace('000000000003.jpg', '000000000004.jpg');
    vi.mocked(getSignedImages).mockResolvedValueOnce([
      { path, url: 'first-url', expires_at: new Date(Date.now() + 900_000).toISOString() },
      { path: secondPath, url: 'second-url', expires_at: new Date(Date.now() + 1_020_000).toISOString() },
    ]);
    const { result } = renderHook(() => useSignedUrls([path, secondPath]), { wrapper });
    await tick();
    vi.mocked(getSignedImages).mockRejectedValue(new Error('provider unavailable'));
    await tick(901_000);
    expect(result.current.data[path]).toBeUndefined();
    expect(result.current.data[secondPath]).toBe('second-url');
    await tick(120_000);
    expect(result.current.data).toEqual({});
  });
  it('does not show cached URLs after a home/account change or logout', async () => {
    const { result, rerender } = renderHook(() => useSignedUrls([path]), { wrapper });
    await tick(); expect(result.current.data[path]).toBeDefined();
    scope.homeId = other; rerender(); expect(result.current.data).toEqual({});
    await tick(); expect(getSignedImages).toHaveBeenCalledTimes(1);
    scope.homeId = home; scope.uid = 'user-b'; rerender(); expect(result.current.data).toEqual({});
    await tick(); expect(getSignedImages).toHaveBeenCalledTimes(2);
    expect(client.getQueryCache().findAll({ queryKey: ['signedUrls', 'user-a', home] })).toHaveLength(0);
    scope.uid = null; rerender(); expect(result.current.data).toEqual({});
    await tick(); expect(client.getQueryCache().findAll({ queryKey: ['signedUrls', 'user-b', home] })).toHaveLength(0);
  });
  it('cancels an old scope request and ignores its late result', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof getSignedImages>>) => void;
    vi.mocked(getSignedImages).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const { result, rerender } = renderHook(() => useSignedUrls([path]), { wrapper });
    await tick(); const signal = vi.mocked(getSignedImages).mock.calls[0][2]!;
    scope.homeId = other; rerender(); expect(signal.aborted).toBe(true);
    await act(async () => { resolve([{ path, url: 'private-old-url', expires_at: new Date(Date.now() + 900_000).toISOString() }]); });
    expect(result.current.data).toEqual({});
  });
  it('refreshes on focus after suspension', async () => {
    renderHook(() => useSignedUrls([path]), { wrapper }); await tick();
    act(() => { focusManager.setFocused(false); });
    vi.setSystemTime(new Date(Date.now() + 950_000));
    act(() => { focusManager.setFocused(true); }); await tick();
    expect(getSignedImages).toHaveBeenCalledTimes(2);
  });
});
