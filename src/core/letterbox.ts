// Letterbox: black bars at the top and bottom of each image, to simulate a
// wider framing (e.g. 2.39:1 inside a 16:9 image). Shared by the preview and
// the export.

import type { Rect } from './layout'
import { ptToIn } from './units'

export const LETTERBOX_COLOR = '#000000'

/** Maximum height of each bar, as a % of the image height. */
export const MAX_LETTERBOX_PERCENT = 45

const clampPercent = (percent: number): number =>
  Number.isFinite(percent) ? Math.min(MAX_LETTERBOX_PERCENT, Math.max(0, percent)) : 0

/**
 * Rectangles of the two bars (top, bottom) over the visible image. Each bar
 * covers `percent` % of the image height. With a border, the bars stop inside
 * the stroke, which stays visible: the hidden area, stroke included, is the
 * same.
 */
export function letterboxRects(image: Rect, percent: number, borderWidthPt = 0): Rect[] {
  const p = clampPercent(percent)
  if (p === 0) return []
  const bw = Math.min(ptToIn(borderWidthPt), image.w / 2, image.h / 2)
  const band = (image.h * p) / 100
  const h = Math.max(0, band - bw)
  if (h === 0) return []
  const x = image.x + bw
  const w = image.w - 2 * bw
  return [
    { x, y: image.y + bw, w, h },
    { x, y: image.y + image.h - band, w, h },
  ]
}

/** Ratio (width / height) of the part of the image left visible between the bars. */
export function visibleAspect(imageAspect: number, percent: number): number {
  return imageAspect / (1 - (2 * clampPercent(percent)) / 100)
}

/** Bar height (%) that gives the target ratio; 0 if the image is already wider. */
export function letterboxPercentFor(imageAspect: number, targetAspect: number): number {
  if (!(imageAspect > 0) || !(targetAspect > imageAspect)) return 0
  return clampPercent(((1 - imageAspect / targetAspect) / 2) * 100)
}
