import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BOARD_SETTINGS,
  FALLBACK_RATIO,
  countOverrides,
  isOverridden,
  resolveFrameAspect,
  resolveSettings,
} from './settings'

describe('resolveSettings', () => {
  it('inherits the project values', () => {
    expect(resolveSettings(DEFAULT_BOARD_SETTINGS, {})).toEqual(DEFAULT_BOARD_SETTINGS)
  })

  it('applies the board overrides without changing the defaults', () => {
    const margins = { top: 1, right: 1, bottom: 1, left: 1 }
    const s = resolveSettings(DEFAULT_BOARD_SETTINGS, { columns: 4, margins })
    expect(s.columns).toBe(4)
    expect(s.margins).toEqual(margins)
    expect(s.rows).toBe(DEFAULT_BOARD_SETTINGS.rows)
    expect(DEFAULT_BOARD_SETTINGS.columns).toBe('auto')
  })

  it('ignores undefined overrides', () => {
    const s = resolveSettings(DEFAULT_BOARD_SETTINGS, { columns: undefined })
    expect(s.columns).toBe('auto')
  })
})

describe('field-by-field overrides', () => {
  it('a single field of a composite setting is overridden, the others stay inherited', () => {
    const defaults = {
      ...DEFAULT_BOARD_SETTINGS,
      mention: { ...DEFAULT_BOARD_SETTINGS.mention, enabled: true },
    }
    const s = resolveSettings(defaults, { mention: { fontSize: 12 } })
    expect(s.mention).toEqual({ ...defaults.mention, fontSize: 12 })
    expect(s.mention.enabled).toBe(true)
  })

  it('isOverridden targets one field, or any of them without a field', () => {
    const overrides = { mention: { fontSize: 12 }, columns: 3 } as const
    expect(isOverridden(overrides, 'mention', 'fontSize')).toBe(true)
    expect(isOverridden(overrides, 'mention', 'enabled')).toBe(false)
    expect(isOverridden(overrides, 'mention')).toBe(true)
    expect(isOverridden(overrides, 'letterbox')).toBe(false)
    expect(isOverridden(overrides, 'columns')).toBe(true)
  })

  it('countOverrides counts each overridden field', () => {
    expect(
      countOverrides({ columns: 3, mention: { fontSize: 12, align: 'left' }, margins: { top: 1 } }),
    ).toBe(4)
    expect(countOverrides({})).toBe(0)
  })
})

describe('default settings', () => {
  it('the frame ratio follows the first image', () => {
    expect(DEFAULT_BOARD_SETTINGS.frameRatio).toBe('firstImage')
    expect(resolveFrameAspect(DEFAULT_BOARD_SETTINGS, { width: 1080, height: 1920 })).toBeCloseTo(9 / 16)
    expect(resolveFrameAspect(DEFAULT_BOARD_SETTINGS)).toBe(FALLBACK_RATIO)
  })
})

describe('resolveFrameAspect', () => {
  it('uses the preset ratios', () => {
    expect(resolveFrameAspect({ frameRatio: '2.39:1', customRatio: 1 })).toBeCloseTo(2.39)
    expect(resolveFrameAspect({ frameRatio: '9:16', customRatio: 1 })).toBeCloseTo(9 / 16)
  })

  it('uses the custom ratio, or 16:9 if invalid', () => {
    expect(resolveFrameAspect({ frameRatio: 'custom', customRatio: 1.5 })).toBe(1.5)
    expect(resolveFrameAspect({ frameRatio: 'custom', customRatio: 0 })).toBe(FALLBACK_RATIO)
  })

  it('from the first image, or 16:9 without an image', () => {
    const s = { frameRatio: 'firstImage', customRatio: 1 } as const
    expect(resolveFrameAspect(s, { width: 1200, height: 800 })).toBeCloseTo(1.5)
    expect(resolveFrameAspect(s)).toBe(FALLBACK_RATIO)
    expect(resolveFrameAspect(s, { width: 100, height: 0 })).toBe(FALLBACK_RATIO)
  })
})
