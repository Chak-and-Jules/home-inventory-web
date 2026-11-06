import { getApp, getApps, initializeApp } from 'firebase/app';
import { getPublicRuntimeConfig } from './runtime-config';
import {
  getAuth, GoogleAuthProvider, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signInWithPopup, signOut,
} from 'firebase/auth';

// Initialize lazily: prerendering must not require browser auth configuration.
export function getFirebaseAuth() {
  const { firebaseApiKey: apiKey, firebaseAuthDomain: authDomain, firebaseProjectId: projectId } = getPublicRuntimeConfig();
  if (!apiKey || !authDomain || !projectId) {
    throw Object.assign(new Error('Firebase web configuration is missing'), { code: 'auth/configuration-missing' });
  }
  const app = getApps().length ? getApp() : initializeApp({ apiKey, authDomain, projectId });
  return getAuth(app);
}

export const signIn = (email: string, password: string) =>
  signInWithEmailAndPassword(getFirebaseAuth(), email, password);
export const signUp = (email: string, password: string) =>
  createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
export const signInWithGoogle = () => signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
export const signOutFirebase = () => signOut(getFirebaseAuth());

export async function getFirebaseIdentity() {
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('Authentication required'), { code: 'auth/user-token-expired' });
  try {
    // The SDK refreshes expired ID tokens using its persisted refresh token.
    const token = await user.getIdToken();
    if (auth.currentUser !== user) throw new Error('Authentication changed');
    return { uid: user.uid, token };
  } catch (error) {
    if (isInvalidSession(error) && auth.currentUser === user) await signOutFirebase();
    throw error;
  }
}

export function isInvalidSession(error: unknown) {
  const code = (error as { code?: string })?.code;
  return ['auth/user-token-expired', 'auth/invalid-user-token', 'auth/user-disabled', 'auth/user-not-found'].includes(code || '');
}

export function authErrorKey(error: unknown): string {
  switch ((error as { code?: string })?.code) {
    case 'auth/configuration-missing': return 'auth.configurationMissing';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'auth.invalidCredentials';
    case 'auth/email-already-in-use':
    case 'auth/account-exists-with-different-credential': return 'auth.accountInUse';
    case 'auth/weak-password': return 'auth.weakPassword';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request': return 'auth.popupClosed';
    case 'auth/popup-blocked': return 'auth.popupBlocked';
    default: return 'auth.authenticationFailed';
  }
}
