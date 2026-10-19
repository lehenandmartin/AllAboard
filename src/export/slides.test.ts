import { describe, expect, it } from 'vitest'
import { computeBoardLayout } from '../core/boardLayout'
import { containRect } from '../core/fit'
import { DEFAULT_BOARD_SETTINGS } from '../core/settings'
import type { Board, BoardSettings, ImageMeta, Project } from '../core/types'
import { SLIDE_FORMATS, ptToIn } from '../core/units'
import type { SlideItem } from './slides'
import { describeBoard } from './slides'

const img = (id: string, width = 1920, height = 1080): ImageMeta => ({ id, fileName: `${id}.jpg`, width, height })

function project(overrides: Partial<BoardSettings>, frames: (string | null)[], images: ImageMeta[]): Project {
  const board: Board = {
    id: 'b1',
    name: 'Board 1',
    title: 'Sequence 1',
    frames: frames.map((imageId, i) => ({ id: `f${i}`, imageId, text: imageId ? `Text ${imageId}` : '' })),
    rowTexts: ['Voice-over\nline 2'],
    overrides,
  }
  return {
    id: 'p',
    name: 'Test',
    slide: { id: '16:9', ...SLIDE_FORMATS['16:9'] },
    fontFamily: 'Arial',
    defaults: DEFAULT_BOARD_SETTINGS,
    boards: [board],
    images: Object.fromEntries(images.map((i) => [i.id, i])),
  }
}

const ofKind = <K extends SlideItem['kind']>(items: SlideItem[], kind: K) =>
  items.filter((i): i is Extract<SlideItem, { kind: K }> => i.kind === kind)

describe('describeBoard', () => {
  it("places images at the engine's rectangles (cover)", () => {
    const p = project({}, ['a', 'b', 'c'], [img('a'), img('b'), img('c')])
    const { layout } = computeBoardLayout(p, p.boards[0]!)
    const images = ofKind(describeBoard(p, p.boards[0]!).items, 'image')
    expect(images.map((i) => i.rect)).toEqual(layout.frames)
    expect(images.every((i) => i.fit === 'cover')).toBe(true)
  })

  it('in contain, places the fitted image in the frame', () => {
    const p = project({ fit: 'contain' }, ['a'], [img('a', 1000, 1000)])
    const { layout } = computeBoardLayout(p, p.boards[0]!)
    const [image] = ofKind(describeBoard(p, p.boards[0]!).items, 'image')
    expect(image!.rect).toEqual(containRect(layout.frames[0]!, 1000, 1000))
  })

  it('an empty frame becomes a gray outline drawn inside', () => {
    const p = project({}, [null], [])
    const { layout } = computeBoardLayout(p, p.boards[0]!)
    const [outline] = ofKind(describeBoard(p, p.boards[0]!).items, 'outline')
    const frame = layout.frames[0]!
    const half = ptToIn(0.75) / 2
    expect(outline!.color).toBe('#BFBFBF')
    expect(outline!.rect.x).toBeCloseTo(frame.x + half)
    expect(outline!.rect.w).toBeCloseTo(frame.w - 2 * half)
  })

  it('the border belongs to the picture itself', () => {
    const p = project({ border: { enabled: true, width: 2, color: '#FF0000' } }, ['a'], [img('a')])
    const items = describeBoard(p, p.boards[0]!).items
    const [image] = ofKind(items, 'image')
    expect(image!.border).toEqual({ color: '#FF0000', width: 2 })
    expect(image!.name).toBe('Image 1')
    expect(ofKind(items, 'outline')).toHaveLength(0)
  })

  it('letterbox: two black bars on each image, none on empty frames', () => {
    const p = project({ letterbox: { enabled: true, percent: 10 } }, ['a', null], [img('a')])
    const items = describeBoard(p, p.boards[0]!).items
    const [image] = ofKind(items, 'image')
    const bands = ofKind(items, 'fill')
    expect(bands.map((b) => b.name)).toEqual(['Letterbox top 1', 'Letterbox bottom 1'])
    expect(bands[0]!.color).toBe('#000000')
    expect(bands[0]!.rect.y).toBeCloseTo(image!.rect.y)
    expect(bands[0]!.rect.h).toBeCloseTo(image!.rect.h * 0.1)
    expect(bands[1]!.rect.y + bands[1]!.rect.h).toBeCloseTo(image!.rect.y + image!.rect.h)
    // The bars come right after their image (so above it).
    expect(items.indexOf(bands[0]!)).toBe(items.indexOf(image!) + 1)
  })

  it('letterbox off: no bars', () => {
    const p = project({ letterbox: { enabled: false, percent: 10 } }, ['a'], [img('a')])
    expect(ofKind(describeBoard(p, p.boards[0]!).items, 'fill')).toHaveLength(0)
  })

  it('title, per-image texts with a bold number, multi-line', () => {
    const p = project(
      { titleEnabled: true, textMode: 'perImage', numbering: { enabled: true, prefix: 'P', digits: 2 } },
      ['a', null],
      [img('a')],
    )
    const { layout } = computeBoardLayout(p, p.boards[0]!)
    const texts = ofKind(describeBoard(p, p.boards[0]!).items, 'text')
    const [title, first, second] = texts
    expect(title!.runs).toEqual([{ text: 'Sequence 1' }])
    expect(title!.rect).toEqual(layout.title)
    expect(title!.bold).toBe(true)
    expect(first!.rect).toEqual(layout.frameTexts[0])
    expect(first!.runs).toEqual([
      { text: 'P01', bold: true, breakLine: true },
      { text: 'Text a', bold: false, breakLine: false },
    ])
    // Empty frame without text: only the number.
    expect(second!.runs).toEqual([{ text: 'P02', bold: true, breakLine: false }])
    expect(texts).toHaveLength(3)
  })

  it('multi-line per-row text, and number on the image', () => {
    const p = project(
      { textMode: 'perRow', numbering: { enabled: true, prefix: 'Shot ', digits: 1 } },
      ['a', 'b'],
      [img('a'), img('b')],
    )
    const { layout } = computeBoardLayout(p, p.boards[0]!)
    const texts = ofKind(describeBoard(p, p.boards[0]!).items, 'text')
    const badges = texts.filter((t) => t.fill !== null)
    expect(badges.map((b) => b.runs[0]!.text)).toEqual(['Shot 1', 'Shot 2'])
    expect(badges[0]!.rect.x).toBe(layout.frames[0]!.x)
    const rows = texts.filter((t) => t.fill === null)
    expect(rows).toHaveLength(layout.rowTexts.length)
    expect(rows[0]!.runs).toEqual([
      { text: 'Voice-over', bold: false, breakLine: true },
      { text: 'line 2', bold: false, breakLine: false },
    ])
  })

  it('empty text boxes are still exported (editable)', () => {
    const p = project({ textMode: 'perImage' }, [null], [])
    const texts = ofKind(describeBoard(p, p.boards[0]!).items, 'text')
    expect(texts).toHaveLength(1)
    expect(texts[0]!.runs).toEqual([])
  })

  it('reports an image whose metadata is missing', () => {
    const p = project({}, ['unknown'], [])
    const { items, missingImages } = describeBoard(p, p.boards[0]!)
    expect(missingImages).toEqual(['unknown'])
    expect(ofKind(items, 'outline')).toHaveLength(1)
  })
})
