import { describe, expect, it } from 'vitest'
import { SLIDE_FORMATS, cmToIn, inToCm, inToPt, ptToIn } from './units'

describe('units', () => {
  it('converts cm ↔ inches', () => {
    expect(cmToIn(2.54)).toBeCloseTo(1)
    expect(inToCm(1)).toBeCloseTo(2.54)
    expect(inToCm(cmToIn(12.3))).toBeCloseTo(12.3)
  })

  it('converts points ↔ inches', () => {
    expect(ptToIn(72)).toBeCloseTo(1)
    expect(inToPt(0.5)).toBeCloseTo(36)
  })

  it('has the right slide formats', () => {
    expect(inToCm(SLIDE_FORMATS['16:9'].width)).toBeCloseTo(33.867, 3)
    expect(inToCm(SLIDE_FORMATS['16:9'].height)).toBeCloseTo(19.05, 3)
    expect(SLIDE_FORMATS['4:3'].width / SLIDE_FORMATS['4:3'].height).toBeCloseTo(4 / 3)
    expect(inToCm(SLIDE_FORMATS['a4-landscape'].width)).toBeCloseTo(29.7)
    expect(inToCm(SLIDE_FORMATS['a4-portrait'].height)).toBeCloseTo(29.7)
  })
})
