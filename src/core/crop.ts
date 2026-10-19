// Cropping an image inside its frame, shared by the preview and the export.
//
// Without a crop, the image follows the board's fit mode (cover: centered and
// cropped; contain: whole). With a crop specific to the frame, the image can
// be enlarged and moved freely:
// - `scale`: image size relative to the size that just fills the frame
//   (1 = cover). It goes from "the whole image is visible" to MAX_CROP_SCALE.
// - `x`, `y`: position of the image center in the frame, as a fraction of
//   the frame (0.5, 0.5 = centered).
// The position is always brought back within limits: an image larger than the
// frame covers it without leaving a gap on that axis; a smaller image stays
// entirely inside the frame. These fractions stay valid if the size or the
// ratio of the frames changes.

import { containRect } from './fit'
import type { Rect } from './layout'
import type { ImageCrop, ImageFit } from './types'

/** Maximum enlargement, relative to filling the frame. */
export const MAX_CROP_SCALE = 8

type Size = { width: number; height: number }

/** Scale (relative to filling) at which the whole image fits in the frame. */
export function containScale(frame: Rect, image: Size): number {
  if (!(image.width > 0 && image.height > 0 && frame.w > 0 && frame.h > 0)) return 1
  const cover = Math.max(frame.w / image.width, frame.h / image.height)
  const contain = Math.min(frame.w / image.width, frame.h / image.height)
  return contain / cover
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

/** Crop equivalent to the fit mode: the starting point of editing. */
export function cropForFit(frame: Rect, image: Size, fit: ImageFit): ImageCrop {
  return { x: 0.5, y: 0.5, scale: fit === 'contain' ? containScale(frame, image) : 1 }
}

/** Crop brought back within its limits (scale and position). */
export function clampCrop(frame: Rect, image: Size, crop: ImageCrop): ImageCrop {
  const placed = placeCroppedImage(frame, image, crop)
  if (!placed || frame.w <= 0 || frame.h <= 0) return crop
  const { image: r } = placed
  return {
    x: (r.x + r.w / 2 - frame.x) / frame.w,
    y: (r.y + r.h / 2 - frame.y) / frame.h,
    scale: clamp(crop.scale, containScale(frame, image), MAX_CROP_SCALE),
  }
}

/** Position on one axis: the image covers the frame (larger) or stays inside it (smaller). */
function clampSide(start: number, size: number, frameStart: number, frameSize: number): number {
  const a = frameStart
  const b = frameStart + frameSize - size
  return clamp(start, Math.min(a, b), Math.max(a, b))
}

function placeCroppedImage(frame: Rect, image: Size, crop: ImageCrop): { image: Rect } | null {
  if (!(image.width > 0 && image.height > 0)) return null
  const cover = Math.max(frame.w / image.width, frame.h / image.height)
  const scale = clamp(Number.isFinite(crop.scale) ? crop.scale : 1, containScale(frame, image), MAX_CROP_SCALE)
  const w = image.width * cover * scale
  const h = image.height * cover * scale
  const cx = frame.x + (Number.isFinite(crop.x) ? crop.x : 0.5) * frame.w
  const cy = frame.y + (Number.isFinite(crop.y) ? crop.y : 0.5) * frame.h
  return {
    image: {
      x: clampSide(cx - w / 2, w, frame.x, frame.w),
      y: clampSide(cy - h / 2, h, frame.y, frame.h),
      w,
      h,
    },
  }
}

/** Overlap of two segments; exact (no arithmetic) when one contains the other. */
function overlap(start: number, size: number, frameStart: number, frameSize: number): [number, number] {
  const end = start + size
  const frameEnd = frameStart + frameSize
  // Tolerance: an image that just fills the frame may differ from it by a rounding error.
  const eps = 1e-9
  if (start <= frameStart + eps && end >= frameEnd - eps) return [frameStart, frameSize]
  if (start >= frameStart - eps && end <= frameEnd + eps) return [start, size]
  const from = Math.max(start, frameStart)
  return [from, Math.max(0, Math.min(end, frameEnd) - from)]
}

/** Part of the image visible in the frame. */
function intersect(image: Rect, frame: Rect): Rect {
  const [x, w] = overlap(image.x, image.w, frame.x, frame.w)
  const [y, h] = overlap(image.y, image.h, frame.y, frame.h)
  return { x, y, w, h }
}

export interface ImagePlacement {
  /** The whole image, as placed (it may extend beyond the frame). */
  image: Rect
  /** Visible part of the image: where the border, letterbox and notice go. */
  visible: Rect
}

/** Placement of the image in its frame: the frame's own crop, otherwise the fit mode. */
export function placeImage(frame: Rect, image: Size, fit: ImageFit, crop?: ImageCrop | null): ImagePlacement {
  if (!crop) {
    if (fit === 'contain') {
      const rect = containRect(frame, image.width, image.height)
      return { image: rect, visible: rect }
    }
    crop = { x: 0.5, y: 0.5, scale: 1 }
  }
  const placed = placeCroppedImage(frame, image, crop)
  if (!placed) return { image: frame, visible: frame }
  return { image: placed.image, visible: intersect(placed.image, frame) }
}
