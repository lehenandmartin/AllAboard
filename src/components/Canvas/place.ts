import type { CSSProperties } from 'react'
import type { Rect } from '../../core/layout'

/** Engine rectangle (inches) → CSS position (px), at the given scale (px per inch). */
export function place(rect: Rect, scale: number): CSSProperties {
  return {
    left: rect.x * scale,
    top: rect.y * scale,
    width: rect.w * scale,
    height: rect.h * scale,
  }
}
