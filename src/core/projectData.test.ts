import { describe, expect, it } from 'vitest'
import { ProjectFormatError, normalizeProject, pruneImages, usedImageIds } from './projectData'
import { DEFAULT_BOARD_SETTINGS } from './settings'
import type { Project } from './types'
import { SLIDE_FORMATS } from './units'

const valid = (): Project => ({
  id: 'p1',
  name: 'Ad',
  slide: { id: '16:9', ...SLIDE_FORMATS['16:9'] },
  fontFamily: 'Georgia',
  defaults: DEFAULT_BOARD_SETTINGS,
  boards: [
    {
      id: 'b1',
      name: 'Intro',
      title: 'Title',
      frames: [
        { id: 'f1', imageId: 'a', text: 'Shot 1', crop: { x: 0.3, y: 0.5, scale: 1.2 } },
        { id: 'f2', imageId: null, text: '' },
      ],
      rowTexts: ['VO'],
      overrides: { columns: 3, margins: { top: 1, right: 1, bottom: 1, left: 1 } },
    },
  ],
  images: {
    a: { id: 'a', fileName: 'a.jpg', width: 1920, height: 1080 },
    orphan: { id: 'orphan', fileName: 'o.jpg', width: 10, height: 10 },
  },
})

describe('normalizeProject', () => {
  it('reads a valid project back unchanged', () => {
    const p = valid()
    expect(normalizeProject(JSON.parse(JSON.stringify(p)))).toEqual(p)
  })

  it('ignores an incomplete or invalid crop', () => {
    const raw = JSON.parse(JSON.stringify(valid()))
    raw.boards[0].frames[0].crop = { x: 0.3, y: 'haut', scale: 1 }
    raw.boards[0].frames[1].crop = 'anything'
    const p = normalizeProject(raw)
    expect(p.boards[0]!.frames[0]).not.toHaveProperty('crop')
    expect(p.boards[0]!.frames[1]).not.toHaveProperty('crop')
  })

  it('fills missing settings (older version) with the defaults', () => {
    const raw = JSON.parse(JSON.stringify(valid()))
    delete raw.defaults.border
    delete raw.defaults.letterbox
    delete raw.defaults.mention
    delete raw.defaults.textStyle.color
    raw.defaults.unknown = 42
    const p = normalizeProject(raw)
    expect(p.defaults.border).toEqual(DEFAULT_BOARD_SETTINGS.border)
    expect(p.defaults.letterbox).toEqual(DEFAULT_BOARD_SETTINGS.letterbox)
    expect(p.defaults.mention).toEqual(DEFAULT_BOARD_SETTINGS.mention)
    expect(p.defaults.textStyle.color).toBe(DEFAULT_BOARD_SETTINGS.textStyle.color)
    expect(p.defaults).not.toHaveProperty('unknown')
  })

  it('ignores values of the wrong type', () => {
    const raw = JSON.parse(JSON.stringify(valid()))
    raw.boards[0].overrides = {
      columns: 0,
      rows: 'lots',
      gutterH: '1cm',
      fit: 'contain',
      textMode: 'everywhere',
    }
    raw.defaults.textStyle.align = 'justified'
    raw.defaults.mention = {
      enabled: true,
      text: 'Notice',
      placement: 'everywhere',
      bandColor: 'red',
      fontFamily: 'Comic Sans',
    }
    raw.fontFamily = 'Comic Sans'
    raw.images.bad = { id: 'bad', width: -1, height: 10 }
    const p = normalizeProject(raw)
    expect(p.boards[0]!.overrides).toEqual({ fit: 'contain' })
    expect(p.fontFamily).toBe('Arial')
    expect(p.defaults.textStyle.align).toBe(DEFAULT_BOARD_SETTINGS.textStyle.align)
    expect(p.defaults.mention).toEqual({
      ...DEFAULT_BOARD_SETTINGS.mention,
      enabled: true,
      text: 'Notice',
    })
    expect(p.images.bad).toBeUndefined()
  })

  it('keeps partial overrides of a composite setting, and ignores an invalid field', () => {
    const raw = JSON.parse(JSON.stringify(valid()))
    raw.boards[0].overrides = {
      mention: { fontSize: 12, bandColor: 'red' },
      textStyle: { color: '#FF0000' },
    }
    expect(normalizeProject(raw).boards[0]!.overrides).toEqual({
      mention: { fontSize: 12 },
      textStyle: { color: '#FF0000' },
    })
  })

  it('keeps a custom format, but resets a known format to its real dimensions', () => {
    const raw = JSON.parse(JSON.stringify(valid()))
    raw.slide = { id: 'custom', width: 8, height: 4 }
    expect(normalizeProject(raw).slide).toEqual({ id: 'custom', width: 8, height: 4 })
    raw.slide = { id: '4:3', width: 99, height: 1 }
    expect(normalizeProject(raw).slide).toEqual({ id: '4:3', ...SLIDE_FORMATS['4:3'] })
  })

  it('rejects data that is not a project', () => {
    expect(() => normalizeProject(null)).toThrow(ProjectFormatError)
    expect(() => normalizeProject({ id: 'x', boards: [] })).toThrow(ProjectFormatError)
    expect(() => normalizeProject({ id: 'x', boards: [{ name: 'no id' }] })).toThrow(ProjectFormatError)
  })
})

describe('used images', () => {
  it('lists the images present in frames', () => {
    expect([...usedImageIds(valid())]).toEqual(['a'])
  })

  it('removes orphan metadata', () => {
    const p = pruneImages(valid())
    expect(Object.keys(p.images)).toEqual(['a'])
    expect(pruneImages(p)).toBe(p)
  })
})
