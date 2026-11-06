import type { User } from 'firebase/auth';

// No cached bearer token: every request obtains a current ID token from Firebase.
export type AuthSession = { user: User };
export type ProfileSyncResponse = { ID: string; Email: string };
export type AccountDeletionRoute = '/profiles/delete-account' | '/account/delete-request';
