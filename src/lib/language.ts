import type { Language } from '@/types'

type ApiLanguage = Partial<Language> & {
  id?: string
  name?: string
}

export function normalizeLanguage(language: ApiLanguage): Language {
  return {
    ...language,
    id: language.id ?? '',
    name: language.name ?? '',
  }
}

export function normalizeLanguages(languages: ApiLanguage[]): Language[] {
  return languages.map(normalizeLanguage)
}
