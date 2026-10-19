import { describe, expect, it } from 'vitest'
import { fitWithin } from './compression'

describe('fitWithin', () => {
  it('reduces the longest side to the limit, keeping proportions', () => {
    expect(fitWithin(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 })
    expect(fitWithin(3000, 4000, 1920)).toEqual({ width: 1440, height: 1920 })
    expect(fitWithin(6000, 2510, 1920)).toEqual({ width: 1920, height: 803 })
  })

  it('never enlarges a small image', () => {
    expect(fitWithin(800, 600, 1920)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(1920, 1080, 1920)).toEqual({ width: 1920, height: 1080 })
  })

  it('keeps at least 1 pixel', () => {
    expect(fitWithin(10000, 1, 100)).toEqual({ width: 100, height: 1 })
  })
})
