// Whole image fitted inside its frame (contain mode). The full placement,
// with cropping, is in crop.ts.

import type { Rect } from './layout'

/** Rectangle of the whole image, centered in the frame, uncropped. */
export function containRect(frame: Rect, imageWidth: number, imageHeight: number): Rect {
  if (!(imageWidth > 0 && imageHeight > 0)) return frame
  const scale = Math.min(frame.w / imageWidth, frame.h / imageHeight)
  const w = imageWidth * scale
  const h = imageHeight * scale
  return { x: frame.x + (frame.w - w) / 2, y: frame.y + (frame.h - h) / 2, w, h }
}
