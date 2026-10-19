// Interface language: English or French. Defaults to the browser language,
// and can be changed from the File menu (remembered in this browser).

import { create } from 'zustand'

export type Locale = 'en' | 'fr'

export const LOCALES: readonly { id: Locale; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
]

const STORAGE_KEY = 'allaboard:locale'

const isLocale = (value: unknown): value is Locale => value === 'en' || value === 'fr'

/** First supported language among the browser's preferred ones; English otherwise. */
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0]
    if (isLocale(base)) return base
  }
  return 'en'
}

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLocale(saved)) return saved
  } catch {
    // Storage unavailable (private browsing…): fall back to the browser language.
  }
  if (typeof navigator === 'undefined') return 'en'
  return detectLocale(navigator.languages?.length ? navigator.languages : [navigator.language])
}

interface LocaleStore {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useLocaleStore = create<LocaleStore>()((set) => ({
  locale: initialLocale(),
  setLocale: (locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // The choice then lasts for this session only.
    }
    set({ locale })
  },
}))

/** Current language, outside React. */
export const currentLocale = (): Locale => useLocaleStore.getState().locale

/** BCP 47 tag used to format numbers and dates. */
export const numberLocale = (locale: Locale = currentLocale()): string => (locale === 'fr' ? 'fr-FR' : 'en-US')
