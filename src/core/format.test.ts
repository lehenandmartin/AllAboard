import { afterEach, describe, expect, it } from 'vitest'
import { useLocaleStore } from '../i18n'
import { formatBytes, formatDecimal, hexToRgba, parseDecimal } from './format'

afterEach(() => useLocaleStore.setState({ locale: 'en' }))

describe('formatDecimal', () => {
  it('uses the decimal separator of the language and limits decimals', () => {
    expect(formatDecimal(1.25)).toBe('1.25')
    expect(formatDecimal(2)).toBe('2')
    expect(formatDecimal(1.23456, 3)).toBe('1.235')
    expect(formatDecimal(1234.5)).toBe('1234.5')
    useLocaleStore.setState({ locale: 'fr' })
    expect(formatDecimal(1.25)).toBe('1,25')
    expect(formatDecimal(1234.5)).toBe('1234,5')
  })
})

describe('parseDecimal', () => {
  it('accepts a comma and a dot', () => {
    expect(parseDecimal('1,5')).toBe(1.5)
    expect(parseDecimal(' 2.25 ')).toBe(2.25)
    expect(parseDecimal('-3')).toBe(-3)
  })

  it('returns null for an empty or invalid input', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('1,2,3')).toBeNull()
  })
})

describe('hexToRgba', () => {
  it('converts a hex color', () => {
    expect(hexToRgba('#000000', 0.6)).toBe('rgba(0, 0, 0, 0.6)')
    expect(hexToRgba('#3B5BDB', 1)).toBe('rgba(59, 91, 219, 1)')
  })
})

describe('formatBytes', () => {
  it('shows KB or MB, in the interface language', () => {
    expect(formatBytes(200)).toBe('1 KB')
    expect(formatBytes(850_000)).toBe('850 KB')
    expect(formatBytes(12_400_000)).toBe('12.4 MB')
    useLocaleStore.setState({ locale: 'fr' })
    expect(formatBytes(12_400_000)).toBe('12,4 Mo')
    expect(formatBytes(3_000_000)).toBe('3 Mo')
  })
})
