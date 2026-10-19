// In-browser export: reading the images from IndexedDB, preparing them
// (format, orientation, compression), generating the .pptx and downloading it.

import { computeBoardLayout } from '../core/boardLayout'
import type { CompressionOptions } from '../core/compression'
import { fitWithin } from '../core/compression'
import { formatBytes } from '../core/format'
import { jpegOrientation, sniffImageType } from '../core/imageData'
import type { ImageMeta, Project } from '../core/types'
import { t } from '../i18n'
import { downloadBlob } from '../storage/download'
import { getImageBlob } from '../storage/imageStore'
import { useNoticeStore } from '../store/noticeStore'
import { buildPresentation, exportFileName, writePresentation } from './pptx'

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Cannot read the image'))
    reader.readAsDataURL(blob)
  })

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Cannot encode the image'))), type, quality),
  )

/** Does the image have transparent pixels? (JPEG would turn them black) */
function hasTransparency(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = context.getImageData(0, 0, width, height)
  for (let i = 3; i < data.length; i += 4) if (data[i]! < 255) return true
  return false
}

/**
 * Redraws the image with its EXIF orientation applied, possibly downsized.
 * Output format: JPEG if requested and without transparency, PNG otherwise.
 */
async function redraw(
  blob: Blob,
  options: { maxSide: number; preferJpeg: boolean; quality: number },
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, options.maxSide)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, width, height)
    const jpeg = options.preferJpeg && !hasTransparency(context, width, height)
    return await toBlob(canvas, jpeg ? 'image/jpeg' : 'image/png', options.quality)
  } finally {
    bitmap.close()
  }
}

/**
 * Image ready for the .pptx:
 * - WebP → PNG (PowerPoint and Google Slides do not read it everywhere);
 * - JPEG with an EXIF orientation → upright JPEG (PowerPoint ignores EXIF,
 *   while the preview and the stored dimensions take it into account);
 * - with compression: longest side limited and JPEG at the chosen quality
 *   (PNG if the image has transparency). GIFs stay as they are, to keep their
 *   animation. If the result is not lighter, the original is kept.
 */
export async function loadImageForExport(
  image: ImageMeta,
  compression: CompressionOptions,
): Promise<string | null> {
  const blob = await getImageBlob(image.id)
  if (!blob) return null
  const bytes = new Uint8Array(await blob.slice(0, 128 * 1024).arrayBuffer())
  const type = sniffImageType(bytes)
  if (!type) return null

  const mustRedraw = type === 'image/webp' || (type === 'image/jpeg' && jpegOrientation(bytes) !== 1)
  const compress = compression.enabled && type !== 'image/gif'

  let output: Blob = blob
  if (mustRedraw || compress) {
    const redrawn = await redraw(blob, {
      maxSide: compress ? compression.maxSide : Number.POSITIVE_INFINITY,
      preferJpeg: compress || type === 'image/jpeg',
      quality: compress ? compression.quality : 0.92,
    })
    if (mustRedraw || redrawn.size < blob.size) output = redrawn
  }

  // The data URL's MIME type gives the file extension inside the .pptx.
  const dataUrl = await blobToDataUrl(output)
  return dataUrl.replace(/^data:[^;]*;/, `data:${output === blob ? type : output.type};`)
}

/** Generates the project's .pptx and downloads it, with progress in the notices. */
export async function exportProjectToPptx(project: Project, compression: CompressionOptions): Promise<void> {
  const { show } = useNoticeStore.getState()
  const { notices, defaults } = t()
  show('progress', notices.exportPreparing)
  try {
    const load = (image: ImageMeta) => loadImageForExport(image, compression)
    const result = await buildPresentation(project, load, (done, total) => {
      if (total > 0) show('progress', notices.exportImages(done, total))
    })
    show('progress', notices.exportWriting)
    const blob = await writePresentation(result, 'blob')
    const { missingCount } = result
    const fileName = exportFileName(project.name, new Date(), defaults.fileName)
    downloadBlob(blob, fileName)
    const warnings: string[] = []
    if (missingCount > 0) warnings.push(notices.exportMissing(missingCount))
    const overflowing = project.boards.filter((b) => computeBoardLayout(project, b).layout.overflow > 0)
    if (overflowing.length > 0) {
      warnings.push(notices.exportOverflow(overflowing.map((b) => notices.quoted(b.name)).join(', ')))
    }
    const exported = notices.exported(fileName, formatBytes(blob.size))
    if (warnings.length > 0) show('warning', notices.exportWarnings(exported, warnings.join('; ')))
    else show('info', `${exported}.`)
  } catch (error) {
    console.error(error)
    show('error', notices.exportFailed)
  }
}
