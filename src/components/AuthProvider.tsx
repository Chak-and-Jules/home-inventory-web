'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { getFirebaseAuth, signOutFirebase, authErrorKey } from '@/lib/firebase';
import { useQueryClient } from '@tanstack/react-query';
import { useLogger } from 'next-axiom';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { fullPageRedirect } from '@/lib/navigation';
import { useTranslation } from 'react-i18next';
import { setLanguagePreference } from '@/lib/i18n/cookie';
import { normalizeLanguages } from '@/lib/language';
import type { ProfilePreference } from '@/types';
import type { AuthSession, ProfileSyncResponse, AccountDeletionRoute } from '@/types/auth';

type AuthContextType = {
  user: User | null;
  session: AuthSession | null;
  profileId: string | null;
  authError: string | null;
  isLoading: boolean;
  isPreferencesLoaded: boolean;
  logout: () => Promise<void>;
  deleteAccount: (route?: AccountDeletionRoute) => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, profileId: null, authError: null,
  isLoading: true, isPreferencesLoaded: false,
  logout: async () => {}, deleteAccount: async () => {},
});

const profileSyncs = new Map<string, Promise<ProfileSyncResponse>>();
function syncProfile(user: User) {
  const key = `${user.uid}:${user.email}`;
  let pending = profileSyncs.get(key);
  if (!pending) {
    pending = (async () => {
      if (!user.email) throw new Error('A verified token email is required');
      const response = await api.post<ProfileSyncResponse>('/profiles/sync', {
        profile: { id: user.uid, email: user.email },
      });
      if (!response.data.ID) throw new Error('Profile sync did not return an internal UUID');
      return response.data;
    })().catch((error) => {
      if (profileSyncs.get(key) === pending) profileSyncs.delete(key);
      throw error;
    });
    profileSyncs.set(key, pending);
  }
  return pending;
}

async function fetchAndApplyPreferences(
  i18nInstance: import('i18next').i18n,
  log: ReturnType<typeof useLogger>,
  isCurrent: () => boolean = () => true,
) {
  try {
    const res = await api.get<ProfilePreference>('/profiles');
    if (!isCurrent()) return;
    if (res.data?.web_theme === 'Dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (res.data?.web_theme === 'Light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
    let languageName = res.data?.Language?.name;
    if (!languageName && res.data?.language_id) {
      const languages = await api.get('/languages');
      languageName = normalizeLanguages(languages.data).find(
        (language) => language.id === res.data.language_id,
      )?.name;
      if (!isCurrent()) return;
    }
    if (languageName) {
      const langCode = languageName.toLowerCase();
      let shortLang = 'en';
      if (langCode.includes('türkçe')) shortLang = 'tr';
      if (langCode.includes('english')) shortLang = 'en';

      await i18nInstance.changeLanguage(shortLang);
      setLanguagePreference(shortLang);
    }
  } catch {
    log.error('Failed to fetch preferences');
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreferencesLoaded, setIsPreferencesLoaded] = useState(false);
  const queryClient = useQueryClient();
  const log = useLogger();
  const router = useRouter();
  const pathname = usePathname();
  const { i18n } = useTranslation();
  const loggerRef = useRef(log);
  useEffect(() => { loggerRef.current = log; }, [log]);

  const clearApplicationState = useCallback(() => {
    setUser(null);
    setSession(null);
    setProfileId(null);
    profileSyncs.clear();
    void queryClient.cancelQueries();
    queryClient.clear();
    localStorage.removeItem('homeId');
    localStorage.removeItem('pending_google_link');
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('signed_url_cache_') || /^sb-.*-auth-token/.test(key)) localStorage.removeItem(key);
    }
  }, [queryClient]);

  const logout = useCallback(async () => {
    await signOutFirebase();
    clearApplicationState();
    fullPageRedirect('/login');
  }, [clearApplicationState]);

  const deleteAccount = useCallback(async (route: AccountDeletionRoute = '/profiles/delete-account') => {
    if (!user?.email || !profileId) throw new Error('A synchronized profile is required');
    // A failed deletion must leave the account and UI state intact.
    await api.post(route, { user_id: profileId, email: user.email });
    try {
      await signOutFirebase().catch(() => {});
    } finally {
      clearApplicationState();
      fullPageRedirect('/login');
    }
  }, [user, profileId, clearApplicationState]);

  useEffect(() => {
    let active = true;
    let generation = 0;
    let identity: string | null = null;
    let unsubscribe = () => {};
    try {
      unsubscribe = onIdTokenChanged(getFirebaseAuth(), (nextUser) => {
        const nextIdentity = nextUser ? `${nextUser.uid}:${nextUser.email}` : null;
        // ID-token refreshes do not reload homes, preferences, or the page shell.
        if (nextIdentity && nextIdentity === identity) return;
        const currentGeneration = ++generation;
        identity = nextIdentity;
        const isCurrent = () => active && currentGeneration === generation;
        if (!nextUser) {
          clearApplicationState();
          setIsPreferencesLoaded(true);
          setIsLoading(false);
          return;
        }
        setAuthError(null);
        setIsLoading(true);
        setIsPreferencesLoaded(false);
        setUser(null);
        setSession(null);
        setProfileId(null);
        void queryClient.cancelQueries();
        queryClient.clear();
        localStorage.removeItem('homeId');
        void (async () => {
          try {
            const profile = await syncProfile(nextUser);
            if (!isCurrent()) return;
            await fetchAndApplyPreferences(i18n, loggerRef.current, isCurrent);
            if (!isCurrent()) return;
            setProfileId(profile.ID);
            setUser(nextUser);
            setSession({ user: nextUser });
            setIsPreferencesLoaded(true);
            setIsLoading(false);
          } catch {
            if (!isCurrent()) return;
            setAuthError('auth.profileSyncFailed');
            loggerRef.current.error('Failed to initialize authenticated profile');
            await signOutFirebase().catch(() => {});
            if (!active || (identity && identity !== nextIdentity)) return;
            clearApplicationState();
            setIsPreferencesLoaded(true);
            setIsLoading(false);
          }
        })();
      });
    } catch (error) {
      queueMicrotask(() => {
        if (!active) return;
        setAuthError(authErrorKey(error));
        setIsPreferencesLoaded(true);
        setIsLoading(false);
      });
    }
    return () => { active = false; generation++; unsubscribe(); };
  }, [i18n, clearApplicationState, queryClient]);

  useEffect(() => {
    if (!isLoading && !session && pathname !== '/login' && pathname !== '/signup') router.push('/login');
  }, [isLoading, pathname, router, session]);

  const value = useMemo(() => ({ user, session, profileId, authError, isLoading, isPreferencesLoaded, logout, deleteAccount }),
    [user, session, profileId, authError, isLoading, isPreferencesLoaded, logout, deleteAccount]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
