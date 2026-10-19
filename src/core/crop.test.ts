import { describe, expect, it } from 'vitest'
import { MAX_CROP_SCALE, clampCrop, containScale, cropForFit, placeImage } from './crop'

// 4 × 2 frame (2:1 ratio); square 100 × 100 image.
const frame = { x: 1, y: 2, w: 4, h: 2 }
const square = { width: 100, height: 100 }

const close = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => {
  for (const k of ['x', 'y', 'w', 'h'] as const) expect(a[k]).toBeCloseTo(b[k], 9)
}

describe('placeImage without a crop', () => {
  it('cover: centered image extending beyond, visible part = the frame', () => {
    const p = placeImage(frame, square, 'cover')
    close(p.image, { x: 1, y: 1, w: 4, h: 4 })
    close(p.visible, frame)
  })

  it('contain: whole image, centered', () => {
    const p = placeImage(frame, square, 'contain')
    close(p.image, { x: 2, y: 2, w: 2, h: 2 })
    close(p.visible, p.image)
  })
})

describe('placeImage with a crop', () => {
  it('scale 1, centered: same as cover', () => {
    const p = placeImage(frame, square, 'contain', { x: 0.5, y: 0.5, scale: 1 })
    close(p.image, placeImage(frame, square, 'cover').image)
  })

  it('moves the image as long as it covers the frame', () => {
    // 4 × 4 image in a frame 2 high: its top edge goes from y = 0 to y = 2.
    const up = placeImage(frame, square, 'cover', { x: 0.5, y: 0, scale: 1 })
    close(up.image, { x: 1, y: 0, w: 4, h: 4 })
    const beyond = placeImage(frame, square, 'cover', { x: 0.5, y: -3, scale: 1 })
    close(beyond.image, up.image)
    const down = placeImage(frame, square, 'cover', { x: 0.5, y: 1, scale: 1 })
    close(down.image, { x: 1, y: 2, w: 4, h: 4 })
  })

  it('enlarges around the chosen center', () => {
    const p = placeImage(frame, square, 'cover', { x: 0.5, y: 0.5, scale: 2 })
    close(p.image, { x: -1, y: -1, w: 8, h: 8 })
    close(p.visible, frame)
  })

  it('an image smaller than the frame stays inside it', () => {
    const p = placeImage(frame, square, 'cover', { x: 0, y: 0.5, scale: 0.5 })
    close(p.image, { x: 1, y: 2, w: 2, h: 2 })
    close(p.visible, p.image)
  })

  it('the scale neither goes below the whole image nor above the maximum', () => {
    const small = placeImage(frame, square, 'cover', { x: 0.5, y: 0.5, scale: 0.01 })
    close(small.image, { x: 2, y: 2, w: 2, h: 2 })
    const big = placeImage(frame, square, 'cover', { x: 0.5, y: 0.5, scale: 100 })
    expect(big.image.w).toBeCloseTo(4 * MAX_CROP_SCALE, 9)
  })

  it('stays valid if the frame ratio changes', () => {
    const crop = { x: 0.2, y: 0.9, scale: 1.5 }
    for (const f of [frame, { x: 0, y: 0, w: 2, h: 4 }, { x: 0, y: 0, w: 3, h: 3 }]) {
      const { image, visible } = placeImage(f, square, 'cover', crop)
      // The image always covers the frame: visible part = frame.
      close(visible, f)
      expect(image.w).toBeGreaterThanOrEqual(f.w)
    }
  })

  it('ignores non-numeric values', () => {
    const p = placeImage(frame, square, 'cover', { x: Number.NaN, y: 0.5, scale: Number.NaN })
    close(p.image, { x: 1, y: 1, w: 4, h: 4 })
  })
})

describe('containScale, cropForFit, clampCrop', () => {
  it('scale of the whole image', () => {
    expect(containScale(frame, square)).toBeCloseTo(0.5, 9)
    expect(containScale(frame, { width: 200, height: 100 })).toBeCloseTo(1, 9)
  })

  it("starting point: the fit mode's", () => {
    expect(cropForFit(frame, square, 'cover')).toEqual({ x: 0.5, y: 0.5, scale: 1 })
    expect(cropForFit(frame, square, 'contain').scale).toBeCloseTo(0.5, 9)
  })

  it('brings the position and scale back within limits', () => {
    const c = clampCrop(frame, square, { x: 0.5, y: -2, scale: 0.1 })
    expect(c.scale).toBeCloseTo(0.5, 9)
    expect(c.y).toBeCloseTo(0.5, 9)
    const d = clampCrop(frame, square, { x: 0.5, y: -2, scale: 1 })
    expect(d.y).toBeCloseTo(0, 9)
  })
})
