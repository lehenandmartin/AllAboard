import { afterEach, describe, expect, it } from 'vitest'
import { createProject } from '../store/projectStore'
import { detectLocale, messagesFor, t, useLocaleStore } from '.'

afterEach(() => useLocaleStore.setState({ locale: 'en' }))

describe('detectLocale', () => {
  it('picks the first supported browser language', () => {
    expect(detectLocale(['fr-FR', 'en-US'])).toBe('fr')
    expect(detectLocale(['de-DE', 'en-GB'])).toBe('en')
    expect(detectLocale(['FR'])).toBe('fr')
  })

  it('falls back to English', () => {
    expect(detectLocale(['de-DE', 'it'])).toBe('en')
    expect(detectLocale([])).toBe('en')
  })
})

describe('texts', () => {
  it('follow the current language', () => {
    expect(t().fileMenu.label).toBe('File')
    useLocaleStore.getState().setLocale('fr')
    expect(t().fileMenu.label).toBe('Fichier')
  })

  it('handle plurals in both languages', () => {
    expect(messagesFor('en').importing.added(1)).toBe('1 image added')
    expect(messagesFor('en').importing.added(3)).toBe('3 images added')
    expect(messagesFor('fr').importing.added(1)).toBe('1 image ajoutée')
    expect(messagesFor('fr').importing.added(3)).toBe('3 images ajoutées')
  })

  it('give new projects their default texts', () => {
    const english = createProject()
    expect(english.name).toBe('Untitled')
    expect(english.defaults.numbering.prefix).toBe('Shot ')
    useLocaleStore.setState({ locale: 'fr' })
    const french = createProject()
    expect(french.name).toBe('Sans titre')
    expect(french.defaults.numbering.prefix).toBe('Plan ')
    expect(french.defaults.mention.text).toContain('mangerbouger.fr')
  })
})
