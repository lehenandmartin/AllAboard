import { describe, expect, it } from 'vitest'
import { jpegOrientation, sniffImageType } from './imageData'

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(values.flatMap((v) => (typeof v === 'string' ? [...v].map((c) => c.charCodeAt(0)) : [v])))

/** Minimal JPEG with an EXIF APP1 segment holding the given orientation. */
function jpegWithOrientation(orientation: number, littleEndian: boolean): Uint8Array {
  const u16 = (n: number) => (littleEndian ? [n & 255, n >> 8] : [n >> 8, n & 255])
  const u32 = (n: number) =>
    littleEndian ? [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24] : [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255]
  const tiff = [
    ...(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d]),
    ...u16(42),
    ...u32(8), // IFD0 right after the header
    ...u16(2), // two entries
    ...u16(0x010f), ...u16(2), ...u32(1), ...u32(0), // Make (ignored)
    ...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientation), 0, 0,
    ...u32(0),
  ]
  const app1 = [...bytes('Exif', 0, 0), ...tiff]
  const length = app1.length + 2
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, length >> 8, length & 255, ...app1, 0xff, 0xda, 0, 2])
}

describe('sniffImageType', () => {
  it('recognizes the four formats', () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(sniffImageType(bytes(0x89, 'PNG', 0x0d, 0x0a))).toBe('image/png')
    expect(sniffImageType(bytes('GIF89a'))).toBe('image/gif')
    expect(sniffImageType(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '))).toBe('image/webp')
  })

  it('returns null for other content', () => {
    expect(sniffImageType(bytes('%PDF-1.7'))).toBeNull()
    expect(sniffImageType(new Uint8Array())).toBeNull()
  })
})

describe('jpegOrientation', () => {
  it('reads the orientation, in little and big endian', () => {
    expect(jpegOrientation(jpegWithOrientation(6, true))).toBe(6)
    expect(jpegOrientation(jpegWithOrientation(8, false))).toBe(8)
    expect(jpegOrientation(jpegWithOrientation(1, true))).toBe(1)
  })

  it('returns 1 without EXIF, for an invalid value or a truncated file', () => {
    expect(jpegOrientation(bytes(0xff, 0xd8, 0xff, 0xda, 0, 2))).toBe(1)
    expect(jpegOrientation(jpegWithOrientation(42, true))).toBe(1)
    expect(jpegOrientation(jpegWithOrientation(6, true).slice(0, 20))).toBe(1)
    expect(jpegOrientation(bytes(0x89, 'PNG'))).toBe(1)
  })
})
