import type { SlideFormatId } from './units'

// All lengths are in inches unless stated otherwise (pt).

export const SAFE_FONTS = [
  'Arial',
  'Helvetica',
  'Calibri',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Trebuchet MS',
  'Courier New',
] as const
export type SafeFont = (typeof SAFE_FONTS)[number]

/** A number set by the user, or computed automatically. */
export type Count = number | 'auto'

export type RatioPreset = '16:9' | '1:1' | '9:16' | '4:5' | '4:3' | '2.39:1'
export type FrameRatioSetting = RatioPreset | 'custom' | 'firstImage'

export type ImageFit = 'cover' | 'contain'
export type TextMode = 'none' | 'perImage' | 'perRow'
export type TextAlign = 'left' | 'center' | 'right'
export type LastRowAlign = 'left' | 'center'

export interface Margins {
  top: number
  right: number
  bottom: number
  left: number
}

export interface TextStyle {
  /** Size in points. */
  fontSize: number
  align: TextAlign
  /** Hex color, e.g. "#333333". */
  color: string
}

export interface Numbering {
  enabled: boolean
  /** E.g. "Shot ", "P", or an empty string. */
  prefix: string
  /** Minimum number of digits: 1 → "1", 2 → "01". */
  digits: number
}

export interface Border {
  enabled: boolean
  /** Width in points. */
  width: number
  color: string
}

/** Black bars at the top and bottom of each image (simulates a wider framing). */
export interface Letterbox {
  enabled: boolean
  /** Height of each bar, as a % of the image height. */
  percent: number
}

/** Where the notice goes: in the bottom letterbox bar, or in a separate band. */
export type MentionPlacement = 'letterboxBottom' | 'band'

/** Common notice shown on every image (e.g. a mandatory legal or health notice). */
export interface Mention {
  enabled: boolean
  text: string
  fontFamily: SafeFont
  /**
   * Size in points. With autoSize, this is the size for a reference image
   * (2 × 2 grid of 16:9 frames on a 16:9 slide); each image scales it to its
   * own dimensions.
   */
  fontSize: number
  /** Size proportional to the image (same look whatever the number of images). */
  autoSize: boolean
  align: TextAlign
  placement: MentionPlacement
  /** Band height, as a % of the image height. */
  bandPercent: number
  /** Band offset from the bottom of the image (or of the letterbox), as a % of the image height. */
  bandOffsetPercent: number
  /** Band background; the text takes the opposite color. */
  bandColor: 'black' | 'white'
  /** Band background opacity, from 0 to 100. */
  bandOpacity: number
}

/** Settings of a board. The project holds their default values. */
export interface BoardSettings {
  columns: Count
  rows: Count
  frameRatio: FrameRatioSetting
  /** Width / height, used when frameRatio is 'custom'. */
  customRatio: number
  fit: ImageFit
  margins: Margins
  /** Horizontal space between two columns. */
  gutterH: number
  /** Vertical space between two rows. */
  gutterV: number
  titleEnabled: boolean
  titleHeight: number
  textMode: TextMode
  textHeight: number
  /** Gap between the bottom of the image and the top of the text block. */
  textGap: number
  textStyle: TextStyle
  numbering: Numbering
  lastRowAlign: LastRowAlign
  border: Border
  letterbox: Letterbox
  mention: Mention
}

/** Composite settings (margins, text style, notice…): objects with several fields. */
export type CompositeSettingKey = {
  [K in keyof BoardSettings]: BoardSettings[K] extends object ? K : never
}[keyof BoardSettings]

/**
 * Settings specific to a board. For a composite setting, each field is
 * overridden separately: the others stay inherited from the project.
 */
export type BoardOverrides = {
  [K in keyof BoardSettings]?: K extends CompositeSettingKey ? Partial<BoardSettings[K]> : BoardSettings[K]
}

export interface ImageMeta {
  id: string
  fileName: string
  /** Original dimensions in pixels. */
  width: number
  height: number
}

/** Crop specific to a frame (see core/crop.ts). */
export interface ImageCrop {
  /** Center of the image in the frame, as a fraction of the frame (0.5 = centered). */
  x: number
  y: number
  /** Image size relative to the size that just fills the frame (1). */
  scale: number
}

/** A grid frame: an image, or an empty slot (imageId null). */
export interface Frame {
  id: string
  imageId: string | null
  text: string
  /** Image crop; when absent, the image follows the board's fit mode. */
  crop?: ImageCrop
}

export interface Board {
  id: string
  name: string
  title: string
  frames: Frame[]
  /** Texts in "under each row" mode, indexed by row. */
  rowTexts: string[]
  /** Overridden settings; the others are inherited from the project. */
  overrides: BoardOverrides
}

export interface SlideFormat {
  id: SlideFormatId
  width: number
  height: number
}

export interface Project {
  id: string
  name: string
  slide: SlideFormat
  fontFamily: SafeFont
  defaults: BoardSettings
  boards: Board[]
  images: Record<string, ImageMeta>
}
