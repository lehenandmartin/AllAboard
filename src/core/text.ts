// Text rules shared by the preview and the export.

import type { Rect } from './layout'
import type { Numbering } from './types'
import { inToPt, ptToIn } from './units'

/** Inner margin of text boxes (small, as required for the export). */
export const TEXT_INSET = ptToIn(3)

/** Line height relative to the font size. */
export const LINE_HEIGHT = 1.2

/** Maximum title size, in points. */
export const TITLE_MAX_FONT_SIZE = 24

/** Title size (pt): 24 pt at most, reduced to fit on one line in its box. */
export function titleFontSize(titleHeight: number): number {
  const available = inToPt(titleHeight - 2 * TEXT_INSET) / LINE_HEIGHT
  return Math.max(1, Math.min(TITLE_MAX_FONT_SIZE, Math.floor(available)))
}

/** Numbering label of a frame: "Shot 1", "P01", "1"… (index from 0). */
export function formatNumber(index: number, numbering: Pick<Numbering, 'prefix' | 'digits'>): string {
  const digits = Math.max(1, Math.floor(numbering.digits))
  return numbering.prefix + String(index + 1).padStart(digits, '0')
}

/** Number badge on the image, when there is no text block per image. */
export const NUMBER_BADGE = {
  background: '#000000',
  /** Background opacity, from 0 to 1. */
  backgroundOpacity: 0.6,
  color: '#FFFFFF',
  insetX: ptToIn(4),
  insetY: ptToIn(2),
} as const

/** Size of the number on the image (pt): proportional to the frame, between 7 and 14 pt. */
export function badgeFontSize(imageHeight: number): number {
  return Math.round(Math.min(14, Math.max(7, inToPt(imageHeight) * 0.07)))
}

/**
 * Estimated width of a short label (inches). Deliberately generous: without a
 * real measurement, a slightly too wide badge beats a clipped one.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  return ptToIn(fontSize) * 0.62 * text.length
}

/** Rectangle of the number badge, in the top left corner of the visible image. */
export function numberBadgeRect(image: Rect, label: string, fontSize: number): Rect {
  const w = estimateTextWidth(label, fontSize) + 2 * NUMBER_BADGE.insetX
  const h = ptToIn(fontSize) * LINE_HEIGHT + 2 * NUMBER_BADGE.insetY
  return { x: image.x, y: image.y, w: Math.min(w, image.w), h: Math.min(h, image.h) }
}
