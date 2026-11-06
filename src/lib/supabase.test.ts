import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { getFirebaseAuth, getFirebaseIdentity } from './firebase';
import './supabase';
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }));
vi.mock('./firebase', () => ({ getFirebaseAuth: vi.fn(), getFirebaseIdentity: vi.fn() }));
const options = vi.mocked(createClient).mock.calls[0][2]!;
describe('Storage authentication', () => {
  it('disables legacy Supabase sessions', () => {
    expect(options.auth).toEqual({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
  });
  it('gets a Firebase ID token for authenticated storage calls', async () => {
    vi.mocked(getFirebaseAuth).mockReturnValue({ authStateReady: async () => {}, currentUser: { uid: 'firebase-uid' } } as ReturnType<typeof getFirebaseAuth>);
    vi.mocked(getFirebaseIdentity).mockResolvedValue({ uid: 'firebase-uid', token: 'firebase-id-token' });
    await expect(options.accessToken!()).resolves.toBe('firebase-id-token');
  });
  it('allows anonymous initialization before sign-in', async () => {
    vi.mocked(getFirebaseAuth).mockReturnValue({ authStateReady: async () => {}, currentUser: null } as unknown as ReturnType<typeof getFirebaseAuth>);
    await expect(options.accessToken!()).resolves.toBeNull();
  });
  it('allows initialization when web auth is not configured', async () => {
    vi.mocked(getFirebaseAuth).mockImplementationOnce(() => { throw { code: 'auth/configuration-missing' }; });
    await expect(options.accessToken!()).resolves.toBeNull();
  });
  it('does not hide transient token failures', async () => {
    vi.mocked(getFirebaseAuth).mockReturnValue({ authStateReady: async () => {}, currentUser: { uid: 'firebase-uid' } } as ReturnType<typeof getFirebaseAuth>);
    vi.mocked(getFirebaseIdentity).mockRejectedValueOnce(new Error('offline'));
    await expect(options.accessToken!()).rejects.toThrow('offline');
  });
});
