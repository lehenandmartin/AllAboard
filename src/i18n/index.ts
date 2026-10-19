// Translated interface texts. `t()` gives the texts of the current language
// (outside React); `useT()` does the same in a component and re-renders it
// when the language changes.

import type { Messages } from './en'
import { en } from './en'
import { fr } from './fr'
import type { Locale } from './locale'
import { currentLocale, useLocaleStore } from './locale'

export type { Messages } from './en'
export type { Locale } from './locale'
export { LOCALES, currentLocale, detectLocale, numberLocale, useLocaleStore } from './locale'

const MESSAGES: Record<Locale, Messages> = { en, fr }

export const messagesFor = (locale: Locale): Messages => MESSAGES[locale]

/** Texts of the current language. */
export const t = (): Messages => MESSAGES[currentLocale()]

/** Texts of the current language, in a component. */
export function useT(): Messages {
  return MESSAGES[useLocaleStore((s) => s.locale)]
}
