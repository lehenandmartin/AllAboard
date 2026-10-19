import type { BoardOverrides, BoardSettings, RatioPreset } from './types'
import { cmToIn } from './units'

export const RATIO_PRESETS: Record<RatioPreset, number> = {
  '16:9': 16 / 9,
  '1:1': 1,
  '9:16': 9 / 16,
  '4:5': 4 / 5,
  '4:3': 4 / 3,
  '2.39:1': 2.39,
}

/** Border of empty frames (placeholder), identical in the preview and the export. */
export const EMPTY_FRAME_BORDER = { width: 0.75, color: '#BFBFBF' } as const

/** Ratio used when no other is available. */
export const FALLBACK_RATIO = RATIO_PRESETS['16:9']

/**
 * Default settings of a new project. The numbering prefix and the notice text
 * depend on the interface language: see localizeDefaults.
 */
export const DEFAULT_BOARD_SETTINGS: BoardSettings = {
  columns: 'auto',
  rows: 'auto',
  frameRatio: 'firstImage',
  customRatio: 16 / 9,
  fit: 'cover',
  margins: { top: cmToIn(1), right: cmToIn(1), bottom: cmToIn(1), left: cmToIn(1) },
  gutterH: cmToIn(0.5),
  gutterV: cmToIn(0.5),
  titleEnabled: false,
  titleHeight: cmToIn(1.5),
  textMode: 'none',
  textHeight: cmToIn(1),
  textGap: cmToIn(0.2),
  textStyle: { fontSize: 10, align: 'left', color: '#333333' },
  numbering: { enabled: false, prefix: 'Shot ', digits: 1 },
  lastRowAlign: 'left',
  border: { enabled: false, width: 0.75, color: '#000000' },
  letterbox: { enabled: false, percent: 12.5 },
  mention: {
    enabled: false,
    text: 'Your legal notice here.',
    fontFamily: 'Arial',
    fontSize: 8,
    autoSize: true,
    align: 'center',
    placement: 'band',
    bandPercent: 7,
    bandOffsetPercent: 3.5,
    bandColor: 'black',
    bandOpacity: 40,
  },
}

/** Default settings with the texts of the interface language (numbering prefix, notice). */
export function localizeDefaults(
  settings: BoardSettings,
  texts: { numberingPrefix: string; mentionText: string },
): BoardSettings {
  return {
    ...settings,
    numbering: { ...settings.numbering, prefix: texts.numberingPrefix },
    mention: { ...settings.mention, text: texts.mentionText },
  }
}

const isComposite = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Effective settings of a board: the project's, overridden by the board's.
 * A composite setting is merged field by field.
 */
export function resolveSettings(defaults: BoardSettings, overrides: BoardOverrides): BoardSettings {
  const resolved = { ...defaults }
  for (const key of Object.keys(overrides) as (keyof BoardSettings)[]) {
    const value: unknown = overrides[key]
    if (value === undefined) continue
    const base: unknown = defaults[key]
    if (isComposite(base) && isComposite(value)) {
      const fields = Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined))
      Object.assign(resolved, { [key]: { ...base, ...fields } })
    } else {
      Object.assign(resolved, { [key]: value })
    }
  }
  return resolved
}

/** Is a setting (or a field of a composite setting) overridden? Without a field: at least one of them. */
export function isOverridden(overrides: BoardOverrides, key: keyof BoardSettings, field?: string): boolean {
  const value: unknown = overrides[key]
  if (value === undefined) return false
  if (!isComposite(value)) return true
  return field === undefined
    ? Object.values(value).some((v) => v !== undefined)
    : value[field] !== undefined
}

/** Number of overridden settings, counting each field of a composite setting. */
export function countOverrides(overrides: BoardOverrides): number {
  let count = 0
  for (const value of Object.values(overrides) as unknown[]) {
    if (value === undefined) continue
    count += isComposite(value) ? Object.values(value).filter((v) => v !== undefined).length : 1
  }
  return count
}

const isValidRatio = (r: number): boolean => Number.isFinite(r) && r > 0

/** Width / height ratio of the frames, always strictly positive. */
export function resolveFrameAspect(
  settings: Pick<BoardSettings, 'frameRatio' | 'customRatio'>,
  firstImage?: { width: number; height: number },
): number {
  switch (settings.frameRatio) {
    case 'custom':
      return isValidRatio(settings.customRatio) ? settings.customRatio : FALLBACK_RATIO
    case 'firstImage': {
      if (!firstImage) return FALLBACK_RATIO
      const r = firstImage.width / firstImage.height
      return isValidRatio(r) ? r : FALLBACK_RATIO
    }
    default:
      return RATIO_PRESETS[settings.frameRatio]
  }
}
