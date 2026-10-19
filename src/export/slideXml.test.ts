import { describe, expect, it } from 'vitest'
import { ptToIn } from '../core/units'
import { addPictureBorders, explicitNoLine, groupShapes, insetForBorder } from './slideXml'

const pic = (name: string) =>
  `<p:pic><p:nvPicPr><p:cNvPr id="2" name="${name}" descr="x"></p:cNvPr></p:nvPicPr>` +
  `<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`

describe('addPictureBorders', () => {
  it('adds the outline only to the requested pictures', () => {
    const xml = `<p:spTree>${pic('Image 1')}${pic('Image 2')}</p:spTree>`
    const out = addPictureBorders(xml, new Map([['Image 2', { color: '#e5484d', width: 2 }]]))
    const [first, second] = out.match(/<p:pic>[\s\S]*?<\/p:pic>/g)!
    expect(first).not.toContain('<a:ln')
    expect(second).toContain(
      '</a:prstGeom><a:ln w="25400"><a:solidFill><a:srgbClr val="E5484D"/></a:solidFill><a:miter lim="800000"/></a:ln></p:spPr>',
    )
  })

  it('touches nothing without a border', () => {
    const xml = pic('Image 1')
    expect(addPictureBorders(xml, new Map())).toBe(xml)
  })
})

describe('insetForBorder', () => {
  it('insets the image by half the width on each side', () => {
    const r = insetForBorder({ x: 1, y: 1, w: 3, h: 2 }, 2)
    expect(r.x).toBeCloseTo(1 + ptToIn(1))
    expect(r.w).toBeCloseTo(3 - ptToIn(2))
    expect(r.h).toBeCloseTo(2 - ptToIn(2))
  })

  it('never returns a negative size', () => {
    const r = insetForBorder({ x: 0, y: 0, w: 0.01, h: 0.01 }, 20)
    expect(r.w).toBe(0)
    expect(r.h).toBe(0)
  })
})

describe('explicitNoLine', () => {
  it('replaces empty outlines, leaving the others alone', () => {
    const xml = '<a:ln></a:ln><a:ln w="9525"><a:solidFill/></a:ln><a:ln></a:ln>'
    expect(explicitNoLine(xml)).toBe(
      '<a:ln><a:noFill/></a:ln><a:ln w="9525"><a:solidFill/></a:ln><a:ln><a:noFill/></a:ln>',
    )
  })
})

describe('groupShapes', () => {
  const sp = (name: string, x: number, y: number, cx: number, cy: number) =>
    `<p:sp><p:nvSpPr><p:cNvPr id="3" name="${name}"></p:cNvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm></p:spPr></p:sp>`
  const picAt = (name: string, x: number, y: number, cx: number, cy: number) =>
    `<p:pic><p:nvPicPr><p:cNvPr id="2" name="${name}" descr="x"></p:cNvPr></p:nvPicPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm></p:spPr></p:pic>`

  it('gathers the image and its bars into a group, in place of the image', () => {
    const xml =
      sp('Title', 0, 0, 10, 10) +
      picAt('Image 1', 100, 200, 400, 300) +
      sp('Letterbox haut 1', 100, 200, 400, 30) +
      sp('Letterbox bas 1', 100, 470, 400, 30) +
      sp('Texte 1', 100, 520, 400, 50)
    const out = groupShapes(xml, [
      { name: 'Image 1 (letterbox)', members: ['Image 1', 'Letterbox haut 1', 'Letterbox bas 1'] },
    ])
    const group = /<p:grpSp>[\s\S]*<\/p:grpSp>/.exec(out)![0]
    expect(group).toContain('name="Image 1 (letterbox)"')
    expect(group).toContain(
      '<a:off x="100" y="200"/><a:ext cx="400" cy="300"/><a:chOff x="100" y="200"/><a:chExt cx="400" cy="300"/>',
    )
    expect(group.indexOf('name="Image 1"')).toBeLessThan(group.indexOf('Letterbox haut 1'))
    expect(group).toContain('Letterbox bas 1')
    // The other objects stay outside the group, in the same order.
    expect(out.indexOf('name="Title"')).toBeLessThan(out.indexOf('<p:grpSp>'))
    expect(out.indexOf('name="Texte 1"')).toBeGreaterThan(out.indexOf('</p:grpSp>'))
    expect(out.match(/Letterbox haut 1/g)).toHaveLength(1)
  })

  it('does not create the group if a member is missing', () => {
    const xml = sp('Letterbox haut 1', 0, 0, 1, 1) + sp('Letterbox bas 1', 0, 1, 1, 1)
    expect(
      groupShapes(xml, [{ name: 'G', members: ['Image 1', 'Letterbox haut 1', 'Letterbox bas 1'] }]),
    ).toBe(xml)
  })

  it('does not confuse "Image 1" and "Image 10"', () => {
    const xml = picAt('Image 10', 0, 0, 5, 5) + picAt('Image 1', 50, 50, 5, 5) + sp('Bande 1', 50, 50, 5, 1)
    const out = groupShapes(xml, [{ name: 'G', members: ['Image 1', 'Bande 1'] }])
    expect(out.startsWith(picAt('Image 10', 0, 0, 5, 5))).toBe(true)
    expect(/<p:grpSp>[\s\S]*<\/p:grpSp>/.exec(out)![0]).toContain('name="Image 1"')
  })
})
