import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLanguagePreference } from './cookie';

import enCommon from './locales/en/common.json';
import trCommon from './locales/tr/common.json';

const resources = {
  en: { common: enCommon },
  tr: { common: trCommon },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: typeof window !== 'undefined' ? getLanguagePreference() : 'en', // Default language
    fallbackLng: 'en',
    ns: ['common'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // React already safe from xss
    },
  });

export default i18n;
