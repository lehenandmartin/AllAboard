import { describe, expect, it } from 'vitest'
import { MENTION_REFERENCE_IMAGE, mentionBox, mentionFontSize } from './mention'
import { DEFAULT_BOARD_SETTINGS } from './settings'
import type { Letterbox, Mention } from './types'
import { ptToIn } from './units'

const image = { x: 1, y: 2, w: 4, h: 2 }
const mention = (over: Partial<Mention> = {}): Mention => ({
  ...DEFAULT_BOARD_SETTINGS.mention,
  enabled: true,
  ...over,
})
const noLetterbox: Letterbox = { enabled: false, percent: 10 }
const letterbox: Letterbox = { enabled: true, percent: 10 }

describe('mentionBox', () => {
  it('nothing when off or without text', () => {
    expect(mentionBox(image, mention({ enabled: false }), noLetterbox)).toBeNull()
    expect(mentionBox(image, mention({ text: '   ' }), noLetterbox)).toBeNull()
  })

  it('black band at the bottom of the image: white text, background at the chosen opacity', () => {
    const box = mentionBox(
      image,
      mention({ placement: 'band', bandPercent: 7, bandOffsetPercent: 0, bandOpacity: 40 }),
      noLetterbox,
    )!
    expect(box.rect.x).toBe(1)
    expect(box.rect.w).toBe(4)
    expect(box.rect.h).toBeCloseTo(0.14)
    expect(box.rect.y + box.rect.h).toBeCloseTo(4)
    expect(box.color).toBe('#FFFFFF')
    expect(box.background).toEqual({ color: '#000000', opacity: 0.4 })
  })

  it('white band: black text', () => {
    const box = mentionBox(image, mention({ placement: 'band', bandColor: 'white' }), noLetterbox)!
    expect(box.color).toBe('#000000')
    expect(box.background!.color).toBe('#FFFFFF')
  })

  it('with a letterbox, the band sits above the bottom bar', () => {
    const box = mentionBox(
      image,
      mention({ placement: 'band', bandPercent: 7, bandOffsetPercent: 0 }),
      letterbox,
    )!
    expect(box.rect.y + box.rect.h).toBeCloseTo(4 - 0.2)
  })

  it('the offset raises the band from the bottom (as a % of the image height)', () => {
    const box = mentionBox(
      image,
      mention({ placement: 'band', bandPercent: 7, bandOffsetPercent: 3.5 }),
      noLetterbox,
    )!
    expect(box.rect.y + box.rect.h).toBeCloseTo(4 - 0.07)
    const withLetterbox = mentionBox(image, mention({ placement: 'band', bandOffsetPercent: 5 }), letterbox)!
    expect(withLetterbox.rect.y + withLetterbox.rect.h).toBeCloseTo(4 - 0.2 - 0.1)
  })

  it('too large an offset keeps the band inside the image', () => {
    // 40 % band offset by 50 %: only 80 % is left between the letterbox bars.
    const box = mentionBox(
      image,
      mention({ placement: 'band', bandPercent: 40, bandOffsetPercent: 50 }),
      letterbox,
    )!
    // It stays right under the top bar, without overlapping it.
    expect(box.rect.y).toBeCloseTo(2 + 0.2)
    expect(box.rect.h).toBeCloseTo(0.8)
  })

  it('in the bottom letterbox bar: white text, no background', () => {
    const bottom = mentionBox(image, mention({ placement: 'letterboxBottom' }), letterbox)!
    expect(bottom.rect.y).toBeCloseTo(3.8)
    expect(bottom.rect.h).toBeCloseTo(0.2)
    expect(bottom.background).toBeNull()
    expect(bottom.color).toBe('#FFFFFF')
  })

  it('defaults: 8 pt, 7 % band offset by 3.5 %', () => {
    expect(DEFAULT_BOARD_SETTINGS.mention).toMatchObject({
      fontSize: 8,
      bandPercent: 7,
      bandOffsetPercent: 3.5,
    })
  })

  it('letterbox placement without a letterbox: nothing', () => {
    expect(mentionBox(image, mention({ placement: 'letterboxBottom' }), noLetterbox)).toBeNull()
  })

  it('stays inside the border', () => {
    const bw = ptToIn(2)
    const box = mentionBox(image, mention({ placement: 'band', bandOffsetPercent: 0 }), noLetterbox, 2)!
    expect(box.rect.x).toBeCloseTo(1 + bw)
    expect(box.rect.w).toBeCloseTo(4 - 2 * bw)
    expect(box.rect.y + box.rect.h).toBeCloseTo(4 - bw)
  })

  it('too tall a band is limited to the available room', () => {
    const box = mentionBox(image, mention({ placement: 'band', bandPercent: 50, bandOffsetPercent: 0 }), {
      enabled: true,
      percent: 40,
    })!
    // Between the two 40 % bars only 20 % of the image is left.
    expect(box.rect.h).toBeCloseTo(0.4)
  })
})

describe('mentionFontSize', () => {
  const ref = MENTION_REFERENCE_IMAGE

  it('reference size on the reference image (2 × 2 grid)', () => {
    expect(mentionFontSize(ref, { fontSize: 8, autoSize: true })).toBe(8)
  })

  it('proportional to the image: half the size for an image half the size', () => {
    expect(mentionFontSize({ w: ref.w / 2, h: ref.h / 2 }, { fontSize: 8, autoSize: true })).toBe(4)
    expect(mentionFontSize({ w: ref.w * 2, h: ref.h * 2 }, { fontSize: 8, autoSize: true })).toBe(16)
  })

  it('a narrow (portrait) image is limited by its width', () => {
    // Same height as the reference, but 9:16: the width rules.
    const portrait = { w: (ref.h * 9) / 16, h: ref.h }
    expect(mentionFontSize(portrait, { fontSize: 8, autoSize: true })).toBeCloseTo(
      (8 * portrait.w) / ref.w,
      1,
    )
  })

  it('fixed size: unchanged', () => {
    expect(mentionFontSize({ w: 1, h: 0.5 }, { fontSize: 8, autoSize: false })).toBe(8)
  })

  it('the notice box carries the computed size', () => {
    const box = mentionBox({ x: 0, y: 0, w: ref.w / 2, h: ref.h / 2 }, mention({ fontSize: 8 }), noLetterbox)!
    expect(box.fontSize).toBe(4)
  })
})
