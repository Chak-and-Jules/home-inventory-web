'use client'

import React, { useEffect } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const updateLanguage = (language: string) => { document.documentElement.lang = language; };
    updateLanguage(i18n.language);
    i18n.on('languageChanged', updateLanguage);
    return () => { i18n.off('languageChanged', updateLanguage); };
  }, []);
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
