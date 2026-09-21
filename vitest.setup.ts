import '@testing-library/jest-dom';

import { vi } from 'vitest';
import en from './src/lib/i18n/locales/en/common.json';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => {
    return {
      t: (str: string, options?: Record<string, unknown>) => {
        if (str.startsWith('ui.') || str.startsWith('inventory.reasons.') || str === 'loadingMessages') {
          const value = str.split('.').reduce<unknown>((obj, key) => (obj as Record<string, unknown>)?.[key], en);
          return typeof value === 'string' ? value.replace(/{{(\w+)}}/g, (_, key) => String(options?.[key] ?? '')) : value ?? str;
        }
        return str;
      },
      i18n: {
        changeLanguage: () => new Promise(() => {}),
      },
    };
  },
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  }
}));
