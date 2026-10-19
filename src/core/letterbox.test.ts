import { describe, expect, it } from 'vitest'
import { letterboxPercentFor, letterboxRects, visibleAspect } from './letterbox'
import { ptToIn } from './units'

const image = { x: 1, y: 2, w: 4, h: 2 }

describe('letterboxRects', () => {
  it('two full-width bars, at the top and bottom', () => {
    const [top, bottom] = letterboxRects(image, 10)
    expect(top).toEqual({ x: 1, y: 2, w: 4, h: 0.2 })
    expect(bottom!.x).toBe(1)
    expect(bottom!.y).toBeCloseTo(3.8)
    expect(bottom!.h).toBeCloseTo(0.2)
  })

  it('no bars at 0 %', () => {
    expect(letterboxRects(image, 0)).toEqual([])
  })

  it('stays within limits (at most 45 % per bar)', () => {
    const [top, bottom] = letterboxRects(image, 80)
    expect(top!.h).toBeCloseTo(0.9)
    expect(bottom!.y).toBeCloseTo(2 + 2 - 0.9)
    expect(letterboxRects(image, -5)).toEqual([])
    expect(letterboxRects(image, Number.NaN)).toEqual([])
  })

  it('with a border, the bars stay inside the stroke', () => {
    const bw = ptToIn(2)
    const [top, bottom] = letterboxRects(image, 10, 2)
    expect(top!.x).toBeCloseTo(1 + bw)
    expect(top!.y).toBeCloseTo(2 + bw)
    expect(top!.w).toBeCloseTo(4 - 2 * bw)
    // Stroke + bar = 10 % of the height, as without a border.
    expect(top!.h + bw).toBeCloseTo(0.2)
    expect(bottom!.y + bottom!.h + bw).toBeCloseTo(4)
  })
})

describe('visible ratio', () => {
  it('16:9 with 12.8 % per bar ≈ 2.39:1', () => {
    expect(visibleAspect(16 / 9, letterboxPercentFor(16 / 9, 2.39))).toBeCloseTo(2.39)
    expect(letterboxPercentFor(16 / 9, 2.39)).toBeCloseTo(12.8, 1)
  })

  it('no bar if the image is already wider than the target ratio', () => {
    expect(letterboxPercentFor(2.39, 1.85)).toBe(0)
    expect(visibleAspect(16 / 9, 0)).toBeCloseTo(16 / 9)
  })
})
