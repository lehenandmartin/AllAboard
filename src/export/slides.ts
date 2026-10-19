// Description of a slide to export: the list of items to draw, at the
// rectangles computed by the engine (the same as in the preview). Pure, with
// no dependency on PptxGenJS, so it can be tested.

import { computeBoardLayout } from '../core/boardLayout'
import { placeImage } from '../core/crop'
import { LETTERBOX_COLOR, letterboxRects } from '../core/letterbox'
import { mentionBox } from '../core/mention'
import type { Rect } from '../core/layout'
import { EMPTY_FRAME_BORDER } from '../core/settings'
import {
  NUMBER_BADGE,
  TEXT_INSET,
  badgeFontSize,
  formatNumber,
  numberBadgeRect,
  titleFontSize,
} from '../core/text'
import type { Board, ImageFit, ImageMeta, Project, TextAlign } from '../core/types'
import { ptToIn } from '../core/units'
import type { Messages } from '../i18n'
import { t } from '../i18n'

export interface TextRun {
  text: string
  bold?: boolean
  /** Line break after this run. */
  breakLine?: boolean
}

export type SlideItem =
  | {
      kind: 'image'
      image: ImageMeta
      /** Visible rectangle: the frame in cover (cropped image), the fitted image in contain. */
      rect: Rect
      fit: ImageFit
      /**
       * Crop specific to the frame: the whole image as placed (it extends
       * beyond the visible rectangle, which cuts it).
       */
      cropFrom: Rect | null
      /** Object name in PowerPoint, unique on the slide. */
      name: string
      /** Border of the picture itself (a single object to move), drawn inside. */
      border: { color: string; width: number } | null
    }
  | {
      kind: 'fill'
      /** Filled rectangle, no outline (letterbox bar). */
      rect: Rect
      color: string
      name: string
      /** Name of the image this rectangle is grouped with in PowerPoint. */
      groupWith: string
    }
  | {
      kind: 'outline'
      /** Stroke rectangle (already inset by half the width, to stay inside the frame). */
      rect: Rect
      color: string
      /** Width in points. */
      width: number
      name: string
    }
  | {
      kind: 'text'
      rect: Rect
      runs: TextRun[]
      fontSize: number
      color: string
      align: TextAlign
      valign: 'top' | 'middle'
      bold: boolean
      wrap: boolean
      /** Horizontal and vertical inner margins, in inches. */
      inset: { x: number; y: number }
      fill: { color: string; opacity: number } | null
      name: string
      /** Font specific to this text (otherwise the project's). */
      fontFamily?: string
      /** Name of the image this text is grouped with in PowerPoint. */
      groupWith?: string
    }

/** Stroke drawn inside the rectangle, as in the preview. */
function insideOutline(rect: Rect, widthPt: number): Rect {
  const half = Math.min(ptToIn(widthPt) / 2, rect.w / 2, rect.h / 2)
  return { x: rect.x + half, y: rect.y + half, w: rect.w - 2 * half, h: rect.h - 2 * half }
}

/** Multi-line text → runs, with a line break between lines. */
function linesToRuns(text: string, bold = false): TextRun[] {
  const lines = text.split(/\r?\n/)
  return lines.map((line, i) => ({ text: line, bold, breakLine: i < lines.length - 1 }))
}

/** Items of a board's slide. `names` are the object names, in the interface language. */
export function describeBoard(
  project: Project,
  board: Board,
  names: Messages['pptx'] = t().pptx,
): { items: SlideItem[]; missingImages: string[] } {
  const { settings, layout } = computeBoardLayout(project, board)
  const { textStyle, numbering, textMode } = settings
  const items: SlideItem[] = []
  const missingImages: string[] = []
  const inset = { x: TEXT_INSET, y: TEXT_INSET }

  if (layout.title) {
    items.push({
      kind: 'text',
      rect: layout.title,
      runs: board.title ? [{ text: board.title }] : [],
      fontSize: titleFontSize(layout.title.h),
      color: '#000000',
      align: 'left',
      valign: 'middle',
      bold: true,
      wrap: true,
      inset,
      fill: null,
      name: names.title,
    })
  }

  layout.frames.forEach((rect, i) => {
    const frame = board.frames[i]!
    const image = frame.imageId ? project.images[frame.imageId] : undefined
    if (frame.imageId && !image) missingImages.push(frame.imageId)
    const placement = image ? placeImage(rect, image, settings.fit, frame.crop) : null
    const visible = placement ? placement.visible : rect

    if (image) {
      const imageName = names.image(i + 1)
      items.push({
        kind: 'image',
        image,
        rect: visible,
        fit: settings.fit,
        cropFrom: frame.crop && placement ? placement.image : null,
        name: imageName,
        border: settings.border.enabled
          ? { color: settings.border.color, width: settings.border.width }
          : null,
      })
      const borderWidth = settings.border.enabled ? settings.border.width : 0
      if (settings.letterbox.enabled) {
        letterboxRects(visible, settings.letterbox.percent, borderWidth).forEach((band, b) => {
          items.push({
            kind: 'fill',
            rect: band,
            color: LETTERBOX_COLOR,
            name: b === 0 ? names.letterboxTop(i + 1) : names.letterboxBottom(i + 1),
            groupWith: imageName,
          })
        })
      }
      const { mention } = settings
      const box = mentionBox(visible, mention, settings.letterbox, borderWidth)
      if (box) {
        items.push({
          kind: 'text',
          rect: box.rect,
          runs: linesToRuns(mention.text),
          fontSize: box.fontSize,
          color: box.color,
          align: mention.align,
          valign: 'middle',
          bold: false,
          wrap: true,
          inset: { x: TEXT_INSET, y: 0 },
          fill: box.background,
          name: names.mention(i + 1),
          fontFamily: mention.fontFamily,
          groupWith: imageName,
        })
      }
    } else {
      items.push({
        kind: 'outline',
        rect: insideOutline(rect, EMPTY_FRAME_BORDER.width),
        color: EMPTY_FRAME_BORDER.color,
        width: EMPTY_FRAME_BORDER.width,
        name: names.emptyFrame(i + 1),
      })
    }

    if (numbering.enabled && textMode !== 'perImage') {
      const label = formatNumber(i, numbering)
      const fontSize = badgeFontSize(visible.h)
      items.push({
        kind: 'text',
        rect: numberBadgeRect(visible, label, fontSize),
        runs: [{ text: label }],
        fontSize,
        color: NUMBER_BADGE.color,
        align: 'left',
        valign: 'top',
        bold: false,
        wrap: false,
        inset: { x: NUMBER_BADGE.insetX, y: NUMBER_BADGE.insetY },
        fill: { color: NUMBER_BADGE.background, opacity: NUMBER_BADGE.backgroundOpacity },
        name: names.number(i + 1),
      })
    }
  })

  const textBlock = (rect: Rect, runs: TextRun[], name: string): SlideItem => ({
    kind: 'text',
    rect,
    runs,
    fontSize: textStyle.fontSize,
    color: textStyle.color,
    align: textStyle.align,
    valign: 'top',
    bold: false,
    wrap: true,
    inset,
    fill: null,
    name,
  })

  if (textMode === 'perImage') {
    layout.frameTexts.forEach((rect, i) => {
      const frame = board.frames[i]!
      const runs: TextRun[] = []
      if (numbering.enabled)
        runs.push({ text: formatNumber(i, numbering), bold: true, breakLine: !!frame.text })
      if (frame.text) runs.push(...linesToRuns(frame.text))
      items.push(textBlock(rect, runs, names.text(i + 1)))
    })
  } else if (textMode === 'perRow') {
    layout.rowTexts.forEach((rect, row) => {
      const text = board.rowTexts[row] ?? ''
      items.push(textBlock(rect, text ? linesToRuns(text) : [], names.rowText(row + 1)))
    })
  }

  return { items, missingImages }
}
