// .pptx export: one slide per board, in order. Each item is placed at the
// rectangle given by describeBoard (so computed by the layout engine).

import type PptxGenJS from 'pptxgenjs'
import { EMPTY_FRAME_BORDER } from '../core/settings'
import { LINE_HEIGHT } from '../core/text'
import { datedFileName } from '../core/format'
import type { ImageMeta, Project } from '../core/types'
import type { Messages } from '../i18n'
import { t } from '../i18n'
import { inToPt } from '../core/units'
import type { PictureBorder, ShapeGroup } from './slideXml'
import { addPictureBorders, explicitNoLine, groupShapes, insetForBorder } from './slideXml'
import type { SlideItem } from './slides'
import { describeBoard } from './slides'

/** Data of an image ready for export (base64 data URL), or null if not found. */
export type ImageLoader = (image: ImageMeta) => Promise<string | null>

export interface BuildResult {
  pptx: PptxGenJS
  /** Number of missing images, replaced by an empty frame. */
  missingCount: number
  /** Borders to put on the pictures, per slide (object name → border). */
  pictureBorders: Map<string, PictureBorder>[]
  /** Groups to create, per slide (image + its overlays: letterbox bars, notice). */
  groups: ShapeGroup[][]
}

const LAYOUT_NAME = 'ALLABOARD'

/** "#33aaFF" → "33AAFF" (the format PptxGenJS expects). */
const hex = (color: string): string => color.replace('#', '').toUpperCase()

/** File name: project name + date, without forbidden characters. */
export const exportFileName = (projectName: string, date = new Date(), fallback?: string): string =>
  datedFileName(projectName, '.pptx', date, fallback)

function addOutline(pptx: PptxGenJS, slide: PptxGenJS.Slide, item: Extract<SlideItem, { kind: 'outline' }>) {
  slide.addShape(pptx.ShapeType.rect, {
    x: item.rect.x,
    y: item.rect.y,
    w: item.rect.w,
    h: item.rect.h,
    fill: { type: 'none' },
    line: { color: hex(item.color), width: item.width },
    objectName: item.name,
  })
}

function addFill(pptx: PptxGenJS, slide: PptxGenJS.Slide, item: Extract<SlideItem, { kind: 'fill' }>) {
  slide.addShape(pptx.ShapeType.rect, {
    x: item.rect.x,
    y: item.rect.y,
    w: item.rect.w,
    h: item.rect.h,
    fill: { color: hex(item.color) },
    line: { type: 'none' },
    objectName: item.name,
  })
}

function addText(slide: PptxGenJS.Slide, item: Extract<SlideItem, { kind: 'text' }>, fontFace: string) {
  const insetX = inToPt(item.inset.x)
  const insetY = inToPt(item.inset.y)
  const runs: PptxGenJS.TextProps[] = item.runs.map((run) => ({
    text: run.text,
    options: { bold: item.bold || run.bold || false, breakLine: run.breakLine ?? false },
  }))
  slide.addText(runs.length > 0 ? runs : '', {
    x: item.rect.x,
    y: item.rect.y,
    w: item.rect.w,
    h: item.rect.h,
    fontFace: item.fontFamily ?? fontFace,
    fontSize: item.fontSize,
    color: hex(item.color),
    bold: item.bold,
    align: item.align,
    valign: item.valign,
    wrap: item.wrap,
    fit: 'none',
    // PptxGenJS order: left, right, bottom, top (in points).
    margin: [insetX, insetX, insetY, insetY],
    // Exact line spacing, as in the preview.
    lineSpacing: item.fontSize * LINE_HEIGHT,
    paraSpaceBefore: 0,
    paraSpaceAfter: 0,
    fill: item.fill
      ? { color: hex(item.fill.color), transparency: Math.round((1 - item.fill.opacity) * 100) }
      : { type: 'none' },
    objectName: item.name,
  })
}

function addImage(slide: PptxGenJS.Slide, item: Extract<SlideItem, { kind: 'image' }>, data: string) {
  const { image } = item
  // With a border, the image is inset by half the width: the stroke, centered
  // on its edge, then covers exactly the same area as in the preview.
  const rect = item.border ? insetForBorder(item.rect, item.border.width) : item.rect
  const objectName = item.name
  if (item.cropFrom) {
    // Free crop: the whole image (w/h) cut to the visible rectangle
    // (sizing, in inches from the corner of the whole image).
    const from = item.cropFrom
    slide.addImage({
      data,
      x: rect.x,
      y: rect.y,
      w: from.w,
      h: from.h,
      sizing: { type: 'crop', x: rect.x - from.x, y: rect.y - from.y, w: rect.w, h: rect.h },
      altText: image.fileName,
      objectName,
    })
  } else if (item.fit === 'cover') {
    // PptxGenJS crops around the center: w/h give the image proportions,
    // sizing gives the frame size.
    slide.addImage({
      data,
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: (rect.w * image.height) / image.width,
      sizing: { type: 'cover', w: rect.w, h: rect.h },
      altText: image.fileName,
      objectName,
    })
  } else {
    slide.addImage({ data, x: rect.x, y: rect.y, w: rect.w, h: rect.h, altText: image.fileName, objectName })
  }
}

/**
 * Builds the presentation. Each image is loaded only once. Object names (as
 * seen in PowerPoint's selection pane) are in the interface language.
 */
export async function buildPresentation(
  project: Project,
  loadImage: ImageLoader,
  onProgress?: (done: number, total: number) => void,
  names: Messages['pptx'] = t().pptx,
): Promise<BuildResult> {
  const { default: PptxGen } = await import('pptxgenjs')
  const pptx = new PptxGen()
  pptx.defineLayout({ name: LAYOUT_NAME, width: project.slide.width, height: project.slide.height })
  pptx.layout = LAYOUT_NAME
  pptx.title = project.name
  pptx.company = 'AllAboard'

  const described = project.boards.map((board) => describeBoard(project, board, names))
  const imagesToLoad = new Map<string, ImageMeta>()
  for (const { items } of described) {
    for (const item of items) if (item.kind === 'image') imagesToLoad.set(item.image.id, item.image)
  }

  const data = new Map<string, string | null>()
  let done = 0
  for (const image of imagesToLoad.values()) {
    onProgress?.(done, imagesToLoad.size)
    data.set(image.id, await loadImage(image).catch(() => null))
    done++
  }
  onProgress?.(done, imagesToLoad.size)

  const missing = new Set<string>()
  const pictureBorders: Map<string, PictureBorder>[] = []
  const groups: ShapeGroup[][] = []
  for (const { items, missingImages } of described) {
    for (const id of missingImages) missing.add(id)
    const slide = pptx.addSlide()
    const borders = new Map<string, PictureBorder>()
    pictureBorders.push(borders)
    // Image → its overlays (letterbox bars, notice), grouped together in PowerPoint.
    const placedImages = new Set<string>()
    const attached = new Map<string, string[]>()
    const attach = (image: string, name: string) =>
      attached.set(image, [...(attached.get(image) ?? []), name])
    for (const item of items) {
      if (item.kind === 'outline') addOutline(pptx, slide, item)
      else if (item.kind === 'fill') {
        addFill(pptx, slide, item)
        attach(item.groupWith, item.name)
      } else if (item.kind === 'text') {
        addText(slide, item, project.fontFamily)
        if (item.groupWith) attach(item.groupWith, item.name)
      } else {
        const imageData = data.get(item.image.id)
        if (imageData) {
          addImage(slide, item, imageData)
          placedImages.add(item.name)
          if (item.border) borders.set(item.name, item.border)
        } else {
          missing.add(item.image.id)
          addOutline(pptx, slide, {
            kind: 'outline',
            rect: item.rect,
            color: EMPTY_FRAME_BORDER.color,
            width: EMPTY_FRAME_BORDER.width,
            name: names.missingImage(item.image.fileName),
          })
        }
      }
    }
    groups.push(
      [...attached]
        .filter(([image]) => placedImages.has(image))
        .map(([image, members]) => ({ name: names.group(image), members: [image, ...members] })),
    )
  }

  return { pptx, missingCount: missing.size, pictureBorders, groups }
}

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

/** Writes the .pptx file, with the XML touch-ups PptxGenJS cannot do (see slideXml). */
export async function writePresentation(result: BuildResult, outputType: 'blob'): Promise<Blob>
export async function writePresentation(result: BuildResult, outputType: 'nodebuffer'): Promise<Uint8Array>
export async function writePresentation(
  { pptx, pictureBorders, groups }: BuildResult,
  outputType: 'blob' | 'nodebuffer',
): Promise<Blob | Uint8Array> {
  const written = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(written)
  for (const [i, borders] of pictureBorders.entries()) {
    const path = `ppt/slides/slide${i + 1}.xml`
    const xml = await zip.file(path)?.async('string')
    if (xml) zip.file(path, explicitNoLine(groupShapes(addPictureBorders(xml, borders), groups[i] ?? [])))
  }
  return zip.generateAsync({ type: outputType, mimeType: PPTX_MIME, compression: 'DEFLATE' })
}
