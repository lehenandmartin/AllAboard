import { describe, expect, it } from 'vitest'
import { isAcceptedImage, prepareImport } from './imageFiles'

const file = (name: string, type = '') => ({ name, type })
const candidate = (path: string, type = '') => ({ file: file(path.split('/').pop()!, type), path })

describe('isAcceptedImage', () => {
  it('accepts JPG, PNG, WebP and GIF by MIME type', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
      expect(isAcceptedImage(file('x', type))).toBe(true)
    }
  })

  it('also accepts by extension when the type is missing', () => {
    expect(isAcceptedImage(file('a.JPG'))).toBe(true)
    expect(isAcceptedImage(file('a.jpeg'))).toBe(true)
    expect(isAcceptedImage(file('a.webp'))).toBe(true)
  })

  it('rejects other formats', () => {
    expect(isAcceptedImage(file('a.tiff', 'image/tiff'))).toBe(false)
    expect(isAcceptedImage(file('a.heic', 'image/heic'))).toBe(false)
    expect(isAcceptedImage(file('notes.pdf', 'application/pdf'))).toBe(false)
  })
})

describe('prepareImport', () => {
  it('sorts in natural order', () => {
    const { accepted } = prepareImport([
      candidate('plan10.jpg', 'image/jpeg'),
      candidate('plan2.jpg', 'image/jpeg'),
      candidate('Plan1.png', 'image/png'),
    ])
    expect(accepted.map((c) => c.path)).toEqual(['Plan1.png', 'plan2.jpg', 'plan10.jpg'])
  })

  it('sorts folders by path', () => {
    const { accepted } = prepareImport([
      candidate('seq10/p1.jpg'),
      candidate('seq2/p10.jpg'),
      candidate('seq2/p9.jpg'),
    ])
    expect(accepted.map((c) => c.path)).toEqual(['seq2/p9.jpg', 'seq2/p10.jpg', 'seq10/p1.jpg'])
  })

  it('reports rejected formats and ignores hidden files', () => {
    const { accepted, rejected } = prepareImport([
      candidate('a.jpg'),
      candidate('dossier/.DS_Store'),
      candidate('dossier/._a.jpg'),
      candidate('b.tiff', 'image/tiff'),
    ])
    expect(accepted.map((c) => c.path)).toEqual(['a.jpg'])
    expect(rejected).toEqual(['b.tiff'])
  })
})
