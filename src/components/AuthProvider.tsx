'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useLogger } from 'next-axiom';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { fullPageRedirect } from '@/lib/navigation';
import { useTranslation } from 'react-i18next';
import { setLanguagePreference } from '@/lib/i18n/cookie';
import { normalizeLanguages } from '@/lib/language';
import type { ProfilePreference } from '@/types';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isPreferencesLoaded: boolean;
  logout: () => Promise<void>;
};

type ProfileSyncPayload = {
  profile: {
    id: string;
    email: string;
  };
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isPreferencesLoaded: false,
  logout: async () => {},
});

async function syncProfile(user: User) {
  if (!user.email) return;

  const payload: ProfileSyncPayload = {
    profile: {
      id: user.id,
      email: user.email,
    },
  };

  await api.post('/profiles/sync', payload);
}

const profileSyncs = new Map<string, Promise<void>>();

async function fetchAndApplyPreferences(
  i18nInstance: import('i18next').i18n,
  log: ReturnType<typeof useLogger>,
  onPreferencesLoaded?: () => void,
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
  } catch (err) {
    log.error('Failed to fetch preferences', { error: err });
  } finally {
    if (onPreferencesLoaded) onPreferencesLoaded();
  }
}

function syncProfileSafely(user: User, log: ReturnType<typeof useLogger>) {
  let pending = profileSyncs.get(user.id);
  if (!pending) {
    pending = syncProfile(user).catch((err) => {
      profileSyncs.delete(user.id);
      log.error('Failed to sync profile', { error: err });
    });
    profileSyncs.set(user.id, pending);
  }
  return pending;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreferencesLoaded, setIsPreferencesLoaded] = useState(false);
  const log = useLogger();
  const router = useRouter();
  const pathname = usePathname();
  const { i18n } = useTranslation();
  const preferenceUser = useRef<string | null>(null);

  const logout = useCallback(async () => {
    setIsLoading(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setIsLoading(false);
      throw error;
    }

    setSession(null);
    setUser(null);
    fullPageRedirect('/login');
  }, []);

  useEffect(() => {
    let active = true;
    const loadPreferences = (nextUser: User) => {
      if (preferenceUser.current === nextUser.id) return;
      preferenceUser.current = nextUser.id;
      setIsPreferencesLoaded(false);
      void syncProfileSafely(nextUser, log).then(() => {
        if (!active || preferenceUser.current !== nextUser.id) return;
        return fetchAndApplyPreferences(
          i18n,
          log,
          () => {
            if (active && preferenceUser.current === nextUser.id) setIsPreferencesLoaded(true);
          },
          () => active && preferenceUser.current === nextUser.id,
        );
      });
    };
    const initializeAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      if (session?.user) {
        // Sync profile to backend so we have user details recorded
        loadPreferences(session.user);
      }

      if (!session) {
        preferenceUser.current = null;
        setIsPreferencesLoaded(true);
      }

    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      if (session?.user) {
        const user = session.user;
        if (preferenceUser.current !== user.id) setIsPreferencesLoaded(false);
        setTimeout(() => {
          if (active) loadPreferences(user);
        }, 0);
      }

      if (!session) {
        preferenceUser.current = null;
        setIsPreferencesLoaded(true);
      }

    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [log, i18n]);

  useEffect(() => {
    if (!isLoading && !session && pathname !== '/login' && pathname !== '/signup') {
      router.push('/login');
    }
  }, [isLoading, pathname, router, session]);

  const contextValue = useMemo(
    () => ({
      user,
      session,
      isLoading,
      isPreferencesLoaded,
      logout,
    }),
    [user, session, isLoading, isPreferencesLoaded, logout],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
