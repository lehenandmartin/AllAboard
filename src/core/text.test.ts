import { describe, expect, it } from 'vitest'
import { TITLE_MAX_FONT_SIZE, badgeFontSize, formatNumber, numberBadgeRect, titleFontSize } from './text'
import { cmToIn, ptToIn } from './units'

describe('formatNumber', () => {
  it('adds the prefix and pads with zeros', () => {
    expect(formatNumber(0, { prefix: 'Plan ', digits: 1 })).toBe('Plan 1')
    expect(formatNumber(0, { prefix: '', digits: 1 })).toBe('1')
    expect(formatNumber(0, { prefix: 'P', digits: 2 })).toBe('P01')
    expect(formatNumber(11, { prefix: 'P', digits: 2 })).toBe('P12')
    expect(formatNumber(122, { prefix: 'P', digits: 2 })).toBe('P123')
  })

  it('brings an invalid digit count back to 1', () => {
    expect(formatNumber(4, { prefix: '', digits: 0 })).toBe('5')
  })
})

describe('titleFontSize', () => {
  it('caps at the maximum size for a tall box', () => {
    expect(titleFontSize(cmToIn(3))).toBe(TITLE_MAX_FONT_SIZE)
  })

  it('reduces the size for a short box', () => {
    const size = titleFontSize(cmToIn(0.8))
    expect(size).toBeLessThan(TITLE_MAX_FONT_SIZE)
    expect(size).toBeGreaterThan(10)
  })

  it('does not go below 1 pt', () => {
    expect(titleFontSize(0)).toBe(1)
  })
})

describe('badgeFontSize', () => {
  it('stays between 7 and 14 pt', () => {
    expect(badgeFontSize(0.2)).toBe(7)
    expect(badgeFontSize(2)).toBe(10)
    expect(badgeFontSize(10)).toBe(14)
  })
})

describe('numberBadgeRect', () => {
  const image = { x: 1, y: 2, w: 3, h: 2 }

  it('sits in the top left corner of the image', () => {
    const r = numberBadgeRect(image, 'P01', 10)
    expect(r.x).toBe(1)
    expect(r.y).toBe(2)
    expect(r.h).toBeCloseTo(ptToIn(12) + ptToIn(4))
    expect(r.w).toBeGreaterThan(ptToIn(3 * 10 * 0.5))
  })

  it('never extends beyond the image', () => {
    const r = numberBadgeRect({ x: 0, y: 0, w: 0.2, h: 0.1 }, 'Plan 100', 14)
    expect(r.w).toBe(0.2)
    expect(r.h).toBe(0.1)
  })
})
