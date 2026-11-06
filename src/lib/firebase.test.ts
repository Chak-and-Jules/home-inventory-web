import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFirebaseAuth, getFirebaseIdentity, signIn, signUp, signInWithGoogle, authErrorKey } from './firebase';
import { PUBLIC_RUNTIME_CONFIG_ID } from './runtime-config';
const mocks = vi.hoisted(() => ({
  apps: vi.fn(), app: vi.fn(), initialize: vi.fn(), auth: vi.fn(),
  login: vi.fn(), signup: vi.fn(), google: vi.fn(), signOut: vi.fn(),
}));
vi.mock('firebase/app', () => ({ getApps: mocks.apps, getApp: mocks.app, initializeApp: mocks.initialize }));
vi.mock('firebase/auth', () => ({
  getAuth: mocks.auth, signInWithEmailAndPassword: mocks.login,
  createUserWithEmailAndPassword: mocks.signup, signInWithPopup: mocks.google,
  GoogleAuthProvider: class GoogleAuthProvider { providerId = 'google.com'; }, signOut: mocks.signOut,
}));
const user = { uid: 'firebase-uid', getIdToken: vi.fn() };
const auth = { currentUser: user as typeof user | null, authStateReady: vi.fn(async () => {}) };
describe('Firebase client SDK integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'public-web-api-key');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'demo.firebaseapp.com');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'demo-project');
    mocks.apps.mockReturnValue([]);
    mocks.initialize.mockReturnValue('app');
    mocks.auth.mockReturnValue(auth);
    mocks.signOut.mockResolvedValue(undefined);
    auth.currentUser = user;
    user.getIdToken.mockResolvedValue('current-firebase-id-token');
  });
  it('initializes lazily with only public web configuration', () => {
    getFirebaseAuth();
    expect(mocks.initialize).toHaveBeenCalledWith({ apiKey: 'public-web-api-key', authDomain: 'demo.firebaseapp.com', projectId: 'demo-project' });
  });
  it('reuses the initialized app', () => {
    mocks.apps.mockReturnValue(['existing']);
    mocks.app.mockReturnValue('existing');
    getFirebaseAuth();
    expect(mocks.initialize).not.toHaveBeenCalled();
    expect(mocks.auth).toHaveBeenCalledWith('existing');
  });
  it('initializes the SDK with runtime values even when build variables are stale', () => {
    const element = document.createElement('script');
    element.type = 'application/json';
    element.id = PUBLIC_RUNTIME_CONFIG_ID;
    element.textContent = JSON.stringify({ firebaseApiKey: 'runtime-key', firebaseAuthDomain: 'runtime.firebaseapp.com', firebaseProjectId: 'runtime-project' });
    document.head.append(element);
    try {
      getFirebaseAuth();
      expect(mocks.initialize).toHaveBeenCalledWith({ apiKey: 'runtime-key', authDomain: 'runtime.firebaseapp.com', projectId: 'runtime-project' });
    } finally { element.remove(); }
  });
  it('reports missing configuration only when auth is used', () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', '');
    expect(() => getFirebaseAuth()).toThrow('configuration is missing');
    expect(authErrorKey({ code: 'auth/configuration-missing' })).toBe('auth.configurationMissing');
  });
  it('calls Firebase email/password sign-in and registration', async () => {
    await signIn('test@example.test', 'password');
    await signUp('new@example.test', 'password');
    expect(mocks.login).toHaveBeenCalledWith(auth, 'test@example.test', 'password');
    expect(mocks.signup).toHaveBeenCalledWith(auth, 'new@example.test', 'password');
  });
  it('uses a Google provider popup', async () => {
    await signInWithGoogle();
    expect(mocks.google).toHaveBeenCalledWith(auth, expect.objectContaining({ providerId: 'google.com' }));
  });
  it('waits for restoration and obtains SDK ID tokens each time', async () => {
    await expect(getFirebaseIdentity()).resolves.toEqual({ uid: user.uid, token: 'current-firebase-id-token' });
    user.getIdToken.mockResolvedValueOnce('sdk-refreshed-id-token');
    await expect(getFirebaseIdentity()).resolves.toEqual({ uid: user.uid, token: 'sdk-refreshed-id-token' });
    expect(auth.authStateReady).toHaveBeenCalledTimes(2);
    expect(user.getIdToken).toHaveBeenCalledTimes(2);
  });
  it('rejects unauthenticated calls', async () => {
    auth.currentUser = null;
    await expect(getFirebaseIdentity()).rejects.toMatchObject({ code: 'auth/user-token-expired' });
    expect(user.getIdToken).not.toHaveBeenCalled();
  });
  it.each(['auth/user-token-expired', 'auth/invalid-user-token', 'auth/user-disabled', 'auth/user-not-found'])('clears invalid sessions for %s', async code => {
    user.getIdToken.mockRejectedValueOnce({ code });
    await expect(getFirebaseIdentity()).rejects.toEqual({ code });
    expect(mocks.signOut).toHaveBeenCalledWith(auth);
  });
  it('fails transient token retrieval without discarding the session', async () => {
    user.getIdToken.mockRejectedValueOnce({ code: 'auth/network-request-failed' });
    await expect(getFirebaseIdentity()).rejects.toMatchObject({ code: 'auth/network-request-failed' });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it('rejects a token retrieved after the active user changed', async () => {
    user.getIdToken.mockImplementationOnce(async () => { auth.currentUser = null; return 'stale'; });
    await expect(getFirebaseIdentity()).rejects.toThrow('Authentication changed');
  });
  it('does not sign out a new user after a previous user token fails', async () => {
    user.getIdToken.mockImplementationOnce(async () => {
      auth.currentUser = { ...user, uid: 'new-user' };
      throw { code: 'auth/user-token-expired' };
    });
    await expect(getFirebaseIdentity()).rejects.toMatchObject({ code: 'auth/user-token-expired' });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it('maps provider conflicts and unknown SDK failures to localized messages', () => {
    expect(authErrorKey({ code: 'auth/account-exists-with-different-credential' })).toBe('auth.accountInUse');
    expect(authErrorKey(new Error('SDK details'))).toBe('auth.authenticationFailed');
  });
});
