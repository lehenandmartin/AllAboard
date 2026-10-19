// Unit conversions. Internal unit: the inch (PptxGenJS's unit).
// The interface shows cm; font sizes are in points.

export const CM_PER_INCH = 2.54
export const PT_PER_INCH = 72

export const cmToIn = (cm: number): number => cm / CM_PER_INCH
export const inToCm = (inches: number): number => inches * CM_PER_INCH
export const ptToIn = (pt: number): number => pt / PT_PER_INCH
export const inToPt = (inches: number): number => inches * PT_PER_INCH

export interface Size {
  width: number
  height: number
}

export type SlideFormatId = '16:9' | '4:3' | 'a4-landscape' | 'a4-portrait' | 'custom'

/** Slide sizes; their names are in the interface texts (slideFormats). */
export const SLIDE_FORMATS: Record<Exclude<SlideFormatId, 'custom'>, Size> = {
  // 33.867 × 19.05 cm: PowerPoint's "widescreen" format (12,192,000 EMU).
  '16:9': { width: 40 / 3, height: 7.5 },
  '4:3': { width: 10, height: 7.5 },
  'a4-landscape': { width: cmToIn(29.7), height: cmToIn(21) },
  'a4-portrait': { width: cmToIn(21), height: cmToIn(29.7) },
}
