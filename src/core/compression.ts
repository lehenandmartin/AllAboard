// Image compression at export: settings and target dimensions.

export interface CompressionOptions {
  enabled: boolean
  /** Maximum longest side, in pixels. */
  maxSide: number
  /** JPEG quality, from 0.1 to 1. */
  quality: number
}

export const DEFAULT_COMPRESSION: CompressionOptions = { enabled: true, maxSide: 1920, quality: 0.85 }

/** Dimensions reduced so the longest side does not exceed maxSide (never enlarged). */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxSide || maxSide <= 0) return { width, height }
  const scale = maxSide / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
