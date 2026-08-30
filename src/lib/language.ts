import type { Language } from '@/types'

type ApiLanguage = Partial<Language> & {
  id?: string
  name?: string
}

export function normalizeLanguage(language: ApiLanguage): Language {
  const langAsAny = language as Record<string, unknown>;
  return {
    ...language,
    id: (langAsAny.ID as string | undefined) ?? language.id ?? '',
    name: (langAsAny.Name as string | undefined) ?? language.name ?? '',
  }
}

export function normalizeLanguages(languages: ApiLanguage[]): Language[] {
  return languages.map(normalizeLanguage)
}
