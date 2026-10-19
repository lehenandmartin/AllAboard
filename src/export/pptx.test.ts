import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { DEFAULT_BOARD_SETTINGS } from '../core/settings'
import type { BoardSettings, ImageMeta, Project } from '../core/types'
import { SLIDE_FORMATS } from '../core/units'
import type { ImageLoader } from './pptx'
import { messagesFor } from '../i18n'
import { buildPresentation, exportFileName, writePresentation } from './pptx'

// 1 × 1 pixel PNG.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const EMU = 914400

function project(overrides: Partial<BoardSettings>, boards = 1): Project {
  const images: ImageMeta[] = [
    { id: 'a', fileName: 'a.png', width: 2000, height: 1000 },
    { id: 'b', fileName: 'b.png', width: 1000, height: 1000 },
  ]
  return {
    id: 'p',
    name: 'My project',
    slide: { id: '16:9', ...SLIDE_FORMATS['16:9'] },
    fontFamily: 'Georgia',
    // Fixed 16:9 frames: the crops expected below depend on it.
    defaults: { ...DEFAULT_BOARD_SETTINGS, frameRatio: '16:9' },
    images: Object.fromEntries(images.map((i) => [i.id, i])),
    boards: Array.from({ length: boards }, (_, n) => ({
      id: `b${n}`,
      name: `Board ${n + 1}`,
      title: `Title ${n + 1}`,
      frames: [
        { id: `f${n}a`, imageId: 'a', text: 'Wide shot & <city>' },
        { id: `f${n}b`, imageId: 'b', text: '' },
        { id: `f${n}c`, imageId: null, text: '' },
      ],
      rowTexts: [],
      overrides,
    })),
  }
}

async function unzip(p: Project, loader: ImageLoader = async () => PNG, names = messagesFor('en').pptx) {
  const result = await buildPresentation(p, loader, undefined, names)
  const { missingCount } = result
  const zip = await JSZip.loadAsync(await writePresentation(result, 'nodebuffer'))
  const read = (path: string) => zip.file(path)!.async('string')
  return { zip, read, missingCount }
}

describe('exportFileName', () => {
  it('project name + date, without forbidden characters', () => {
    const date = new Date(2026, 9, 5)
    expect(exportFileName('Ad / Summer: v2', date)).toBe('Ad - Summer- v2 2026-10-05.pptx')
    expect(exportFileName('   ', date)).toBe('Storyboard 2026-10-05.pptx')
  })
})

describe('buildPresentation', () => {
  it('one slide per board, in the project format', async () => {
    const { zip, read } = await unzip(project({}, 2))
    expect(Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))).toHaveLength(2)
    const pres = await read('ppt/presentation.xml')
    expect(pres).toContain(`cx="${Math.round((40 / 3) * EMU)}"`)
    expect(pres).toContain(`cy="${Math.round(7.5 * EMU)}"`)
  })

  it('cover images cropped around the center, empty frame as a gray outline', async () => {
    const { read, zip } = await unzip(project({}))
    const slide = await read('ppt/slides/slide1.xml')
    // 2:1 image in a 16:9 frame: cropped on the left and right only.
    expect(slide).toMatch(/<a:srcRect l="5\d{3}" r="5\d{3}" t="0" b="0"\/>/)
    // Square image: cropped at the top and bottom.
    expect(slide).toMatch(/<a:srcRect l="0" r="0" t="21875" b="21875"\/>/)
    expect((slide.match(/<p:pic>/g) ?? []).length).toBe(2)
    expect(slide).toContain('name="Empty frame 3"')
    expect(slide).toContain('<a:srgbClr val="BFBFBF"/>')
    expect(Object.values(zip.files).filter((f) => !f.dir && f.name.startsWith('ppt/media/'))).toHaveLength(2)
  })

  it('frame-specific crop: the chosen part of the image, at the frame size', async () => {
    const p = project({})
    // Square image moved all the way down: the top of the image is kept.
    p.boards[0]!.frames[1] = { ...p.boards[0]!.frames[1]!, crop: { x: 0.5, y: 1, scale: 1 } }
    // 2:1 image enlarged 2 times, centered.
    p.boards[0]!.frames[0] = { ...p.boards[0]!.frames[0]!, crop: { x: 0.5, y: 0.5, scale: 2 } }
    const { read } = await unzip(p)
    const slide = await read('ppt/slides/slide1.xml')
    expect(slide).toMatch(/<a:srcRect l="0" r="0" t="0" b="43750"\/>/)
    // Enlarged 2 times: half its height is kept, centered (a quarter cut at the top and bottom).
    const big = slide.match(/<a:srcRect l="(\d+)" r="(\d+)" t="(\d+)" b="(\d+)"\/>/)!
    expect(Number(big[1])).toBe(Number(big[2]))
    expect(Number(big[3])).toBe(Number(big[4]))
    expect(Number(big[3])).toBe(25000)
    // The frame keeps its size: both images have the same width.
    const widths = [...slide.matchAll(/<p:pic>[\s\S]*?<a:ext cx="(\d+)"/g)].map((m) => m[1])
    expect(widths[0]).toBe(widths[1])
  })

  it('in contain, no cropping', async () => {
    const { read } = await unzip(project({ fit: 'contain' }))
    const slide = await read('ppt/slides/slide1.xml')
    expect(slide).not.toContain('<a:srcRect')
  })

  it('editable texts: wrapping, no autofit, small margins, exact line spacing', async () => {
    const { read } = await unzip(project({ titleEnabled: true, textMode: 'perImage' }))
    const slide = await read('ppt/slides/slide1.xml')
    expect(slide).toContain('Title 1')
    expect(slide).toContain('Wide shot &amp; &lt;city&gt;')
    expect(slide).toContain('wrap="square"')
    expect(slide).not.toContain('normAutofit')
    expect(slide).not.toContain('spAutoFit')
    // Inner margin of 3 pt = 38100 EMU.
    expect(slide).toContain('lIns="38100" tIns="38100" rIns="38100" bIns="38100"')
    // 10 pt text → exact line spacing of 12 pt.
    expect(slide).toContain('<a:spcPts val="1200"/>')
    expect(slide).toContain('typeface="Georgia"')
    expect(slide).toContain('anchor="t"')
  })

  it('the border is set on the picture itself, without a separate frame', async () => {
    const { read } = await unzip(project({ border: { enabled: true, width: 2, color: '#e5484d' } }))
    const slide = await read('ppt/slides/slide1.xml')
    const pics = slide.match(/<p:pic>[\s\S]*?<\/p:pic>/g) ?? []
    expect(pics).toHaveLength(2)
    for (const pic of pics) expect(pic).toContain('<a:ln w="25400"><a:solidFill><a:srgbClr val="E5484D"/>')
    // Only the empty frame stays a separate rectangle.
    expect((slide.match(/<p:sp>/g) ?? []).length).toBe(1)
  })

  it('letterbox: solid black rectangles, no outline, above the images', async () => {
    const { read } = await unzip(project({ letterbox: { enabled: true, percent: 12.5 } }))
    const slide = await read('ppt/slides/slide1.xml')
    const bands = slide.match(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*name="Letterbox [^"]*"[\s\S]*?<\/p:sp>/g) ?? []
    expect(bands).toHaveLength(4)
    for (const band of bands) {
      expect(band).toContain('<a:solidFill><a:srgbClr val="000000"/></a:solidFill>')
      expect(band).toContain('<a:ln><a:noFill/></a:ln>')
    }
    // The 1st bar is written after the 1st image, so drawn over it.
    expect(slide.indexOf('Letterbox top 1')).toBeGreaterThan(slide.indexOf('<p:pic>'))
  })

  it('letterbox: each image is grouped with its two bars', async () => {
    const { read } = await unzip(project({ letterbox: { enabled: true, percent: 12.5 } }))
    const slide = await read('ppt/slides/slide1.xml')
    const groups = slide.match(/<p:grpSp>[\s\S]*?<\/p:grpSp>/g) ?? []
    // Two images; the empty frame has neither bars nor a group.
    expect(groups).toHaveLength(2)
    for (const [n, group] of groups.entries()) {
      expect(group).toContain(`name="Image ${n + 1} (with overlays)"`)
      expect(group.match(/<p:pic>/g)).toHaveLength(1)
      expect(group).toContain(`name="Letterbox top ${n + 1}"`)
      expect(group).toContain(`name="Letterbox bottom ${n + 1}"`)
    }
    expect(slide.match(/name="Letterbox/g)).toHaveLength(4)
  })

  it('notice in a band: editable text box, transparent background, chosen font, grouped with the image', async () => {
    const mention = {
      ...DEFAULT_BOARD_SETTINGS.mention,
      enabled: true,
      text: 'Eat & move',
      fontFamily: 'Georgia' as const,
      fontSize: 8,
      bandOpacity: 40,
    }
    const { read } = await unzip(project({ mention }))
    const slide = await read('ppt/slides/slide1.xml')
    const groups = slide.match(/<p:grpSp>[\s\S]*?<\/p:grpSp>/g) ?? []
    expect(groups).toHaveLength(2)
    const group = groups[0]!
    expect(group).toContain('name="Image 1 (with overlays)"')
    expect(group).toContain('name="Notice 1"')
    expect(group).toContain('Eat &amp; move')
    expect(group).toContain('typeface="Georgia"')
    expect(group).toContain('sz="800"')
    // Black background at 40 % opacity = 60 % transparency.
    expect(group).toMatch(/<a:srgbClr val="000000"><a:alpha val="40000"\/><\/a:srgbClr>/)
    expect(group).toContain('anchor="ctr"')
    // No notice on the empty frame.
    expect(slide.match(/name="Notice/g)).toHaveLength(2)
  })

  it('letterbox without a loaded image: the bars stay, without a group', async () => {
    const { read } = await unzip(project({ letterbox: { enabled: true, percent: 12.5 } }), async () => null)
    const slide = await read('ppt/slides/slide1.xml')
    expect(slide).not.toContain('<p:grpSp>')
  })

  it('an unreadable image is replaced by an empty frame and counted', async () => {
    const { read, missingCount } = await unzip(project({}), async () => null)
    const slide = await read('ppt/slides/slide1.xml')
    expect(missingCount).toBe(2)
    expect(slide).not.toContain('<p:pic>')
    expect(slide).toContain('Missing image: a.png')
  })

  it('names the objects in the interface language', async () => {
    const p = project({ letterbox: { enabled: true, percent: 12.5 } })
    const { read } = await unzip(p, undefined, messagesFor('fr').pptx)
    const slide = await read('ppt/slides/slide1.xml')
    expect(slide).toContain('name="Case vide 3"')
    expect(slide).toContain('name="Letterbox haut 1"')
    expect(slide).toContain('name="Image 1 (habillage)"')
  })
})
