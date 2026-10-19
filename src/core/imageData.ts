// Image header reading: actual format, and EXIF orientation of JPEGs.

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

/** Format from the first bytes (the MIME type of a dragged file may be missing). */
export function sniffImageType(bytes: Uint8Array): ImageMime | null {
  const at = (i: number) => bytes[i] ?? -1
  const ascii = (from: number, text: string) => [...text].every((c, i) => at(from + i) === c.charCodeAt(0))
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg'
  if (at(0) === 0x89 && ascii(1, 'PNG')) return 'image/png'
  if (ascii(0, 'GIF8')) return 'image/gif'
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp'
  return null
}

/**
 * EXIF orientation of a JPEG (1 to 8; 1 = normal). Returns 1 if missing or unreadable.
 * Phone photos are often stored sideways with an orientation of 6 or 8.
 */
export function jpegOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1

  let offset = 2
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset)
    if ((marker & 0xff00) !== 0xff00) return 1
    const length = view.getUint16(offset + 2)
    // APP1 "Exif\0\0"
    if (marker === 0xffe1 && offset + 10 <= view.byteLength && view.getUint32(offset + 4) === 0x45786966) {
      return readTiffOrientation(view, offset + 10, offset + 2 + length)
    }
    // Start of the image data: no more headers to read.
    if (marker === 0xffda) return 1
    offset += 2 + length
  }
  return 1
}

function readTiffOrientation(view: DataView, tiff: number, end: number): number {
  if (tiff + 8 > end || end > view.byteLength) return 1
  const order = view.getUint16(tiff)
  if (order !== 0x4949 && order !== 0x4d4d) return 1
  const little = order === 0x4949
  const ifd = tiff + view.getUint32(tiff + 4, little)
  if (ifd + 2 > end) return 1
  const count = view.getUint16(ifd, little)
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12
    if (entry + 12 > end) return 1
    if (view.getUint16(entry, little) === 0x0112) {
      const value = view.getUint16(entry + 8, little)
      return value >= 1 && value <= 8 ? value : 1
    }
  }
  return 1
}
