import { describe, expect, it } from 'vitest'
import { containRect } from './fit'

const frame = { x: 1, y: 2, w: 4, h: 2 }

describe('containRect', () => {
  it('horizontally centers an image taller than the frame', () => {
    expect(containRect(frame, 100, 100)).toEqual({ x: 2, y: 2, w: 2, h: 2 })
  })

  it('vertically centers an image wider than the frame', () => {
    expect(containRect(frame, 400, 100)).toEqual({ x: 1, y: 2.5, w: 4, h: 1 })
  })

  it('exactly fills a frame of the same ratio', () => {
    expect(containRect(frame, 1920, 960)).toEqual(frame)
  })

  it('returns the frame if the dimensions are invalid', () => {
    expect(containRect(frame, 0, 100)).toEqual(frame)
  })
})
