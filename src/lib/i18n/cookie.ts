import Cookies from 'js-cookie';

// We will use cookies to persist language across app loads
const LANGUAGE_COOKIE_KEY = 'NEXT_LOCALE';

export const getLanguagePreference = () => {
  return Cookies.get(LANGUAGE_COOKIE_KEY) || 'en';
};

export const setLanguagePreference = (lang: string) => {
  Cookies.set(LANGUAGE_COOKIE_KEY, lang, { expires: 365, path: '/' });
};
