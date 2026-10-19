// Common notice shown on every image (e.g. a legal or health notice): its box
// and colors, shared by the preview and the export.

import type { Rect } from './layout'
import { letterboxRects } from './letterbox'
import type { Letterbox, Mention } from './types'
import { cmToIn, ptToIn } from './units'

/** Maximum band height, as a % of the image height. */
export const MAX_MENTION_BAND_PERCENT = 50

/** Maximum band offset from the bottom, as a % of the image height. */
export const MAX_MENTION_OFFSET_PERCENT = 50

/**
 * Reference image for the automatic size: one frame of a 2 × 2 grid of 16:9
 * frames on a 16:9 slide, with the default margins and gutters.
 */
export const MENTION_REFERENCE_IMAGE = { w: cmToIn(14.71), h: cmToIn(8.28) }

/**
 * Size (pt) of the notice on an image. With the automatic size, it follows
 * the image height (like the band), without exceeding what its width allows:
 * the text keeps the same proportion whatever the number of images. Rounded
 * to a tenth of a point.
 */
export function mentionFontSize(
  image: Pick<Rect, 'w' | 'h'>,
  mention: Pick<Mention, 'fontSize' | 'autoSize'>,
): number {
  if (!mention.autoSize) return mention.fontSize
  const scale = Math.min(image.h / MENTION_REFERENCE_IMAGE.h, image.w / MENTION_REFERENCE_IMAGE.w)
  return Math.max(1, Math.round(mention.fontSize * scale * 10) / 10)
}

export interface MentionBox {
  /** Text box (vertically centered). */
  rect: Rect
  /** Text size, in points. */
  fontSize: number
  /** Text color. */
  color: string
  /** Background of the separate band; null in a letterbox bar (already black). */
  background: { color: string; opacity: number } | null
}

const clamp = (v: number, min: number, max: number): number =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min

/**
 * Box of the notice on a visible image. In the letterbox, it fills the bottom
 * bar; the separate band sits at the bottom of the image (above the bottom
 * bar if there is a letterbox), raised by the chosen offset. Like the bars,
 * it stays inside the border and never leaves the available area. Returns
 * null when there is nothing to show.
 */
export function mentionBox(
  image: Rect,
  mention: Mention,
  letterbox: Letterbox,
  borderWidthPt = 0,
): MentionBox | null {
  if (!mention.enabled || mention.text.trim() === '') return null
  const bands = letterbox.enabled ? letterboxRects(image, letterbox.percent, borderWidthPt) : []

  if (mention.placement === 'letterboxBottom') {
    return bands[1]
      ? { rect: bands[1], fontSize: mentionFontSize(image, mention), color: '#FFFFFF', background: null }
      : null
  }

  const bw = Math.min(ptToIn(borderWidthPt), image.w / 2, image.h / 2)
  const bottom = bands[1] ? bands[1].y : image.y + image.h - bw
  const top = bands[0] ? bands[0].y + bands[0].h : image.y + bw
  const h = Math.min((image.h * clamp(mention.bandPercent, 0, MAX_MENTION_BAND_PERCENT)) / 100, bottom - top)
  if (h <= 0) return null
  const offset = Math.min(
    (image.h * clamp(mention.bandOffsetPercent, 0, MAX_MENTION_OFFSET_PERCENT)) / 100,
    bottom - top - h,
  )
  const white = mention.bandColor === 'white'
  return {
    rect: { x: image.x + bw, y: bottom - offset - h, w: image.w - 2 * bw, h },
    fontSize: mentionFontSize(image, mention),
    color: white ? '#000000' : '#FFFFFF',
    background: { color: white ? '#FFFFFF' : '#000000', opacity: clamp(mention.bandOpacity, 0, 100) / 100 },
  }
}
