// Touch-ups of the slide XML, for what PptxGenJS cannot write:
// - an image border (<a:ln> on the picture itself: in PowerPoint this is the
//   "Picture Border", a single object that moves with it);
// - explicit "no outline" (PptxGenJS writes an empty <a:ln>);
// - groups (an image and its overlays: letterbox bars, notice).

import { ptToIn } from '../core/units'

export interface PictureBorder {
  color: string
  /** Width in points. */
  width: number
}

/** 1 point = 12,700 EMU. */
const EMU_PER_PT = 12700

/** Image rectangle inset by half the width: the stroke, centered on the edge, stays inside the frame. */
export function insetForBorder<R extends { x: number; y: number; w: number; h: number }>(
  rect: R,
  widthPt: number,
): R {
  const half = Math.min(ptToIn(widthPt) / 2, rect.w / 2, rect.h / 2)
  return { ...rect, x: rect.x + half, y: rect.y + half, w: rect.w - 2 * half, h: rect.h - 2 * half }
}

function lineXml({ color, width }: PictureBorder): string {
  const rgb = color.replace('#', '').toUpperCase()
  // Square corners, as in the preview.
  return `<a:ln w="${Math.round(width * EMU_PER_PT)}"><a:solidFill><a:srgbClr val="${rgb}"/></a:solidFill><a:miter lim="800000"/></a:ln>`
}

/** Adds an outline to the pictures named in `borders` (object name → border). */
export function addPictureBorders(slideXml: string, borders: ReadonlyMap<string, PictureBorder>): string {
  if (borders.size === 0) return slideXml
  return slideXml.replace(/<p:pic>[\s\S]*?<\/p:pic>/g, (pic) => {
    const name = /<p:cNvPr [^>]*name="([^"]*)"/.exec(pic)?.[1]
    const border = name === undefined ? undefined : borders.get(name)
    if (!border) return pic
    // In <p:spPr>, the outline comes right after the geometry.
    return pic.replace('</a:prstGeom>', `</a:prstGeom>${lineXml(border)}`)
  })
}

/** PptxGenJS's empty outline → explicit "no outline", read the same way everywhere. */
export function explicitNoLine(slideXml: string): string {
  return slideXml.replaceAll('<a:ln></a:ln>', '<a:ln><a:noFill/></a:ln>')
}

/** Group of objects to create: the group name and its members' names (the 1st keeps its place). */
export interface ShapeGroup {
  name: string
  members: string[]
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** <p:pic> or <p:sp> element whose object has this name, if any. */
function findShape(xml: string, name: string): string | null {
  const n = escapeRegExp(escapeXml(name))
  const tag = '(pic|sp)'
  // The element cannot contain its own closing tag before the name: this stays within the same object.
  const re = new RegExp(`<p:${tag}>(?:(?!</p:\\1>)[\\s\\S])*?<p:cNvPr [^>]*name="${n}"[\\s\\S]*?</p:\\1>`)
  return re.exec(xml)?.[0] ?? null
}

/** Rectangle (EMU) of an object, from its first <a:off>/<a:ext>. */
function bounds(shape: string): { x: number; y: number; x2: number; y2: number } | null {
  const off = /<a:off x="(-?\d+)" y="(-?\d+)"\/>/.exec(shape)
  const ext = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(shape)
  if (!off || !ext) return null
  const x = Number(off[1])
  const y = Number(off[2])
  return { x, y, x2: x + Number(ext[1]), y2: y + Number(ext[2]) }
}

/**
 * Gathers objects into PowerPoint groups (<p:grpSp>), in place of the first
 * member. A group with a missing member is not created. Group ids start at
 * `firstId`, beyond those of PptxGenJS.
 */
export function groupShapes(slideXml: string, groups: readonly ShapeGroup[], firstId = 10000): string {
  let xml = slideXml
  groups.forEach((group, i) => {
    const shapes = group.members.map((name) => findShape(xml, name))
    if (shapes.some((s) => s === null) || shapes.length < 2) return
    const boxes = shapes.map((s) => bounds(s!))
    if (boxes.some((b) => b === null)) return
    const x = Math.min(...boxes.map((b) => b!.x))
    const y = Math.min(...boxes.map((b) => b!.y))
    const cx = Math.max(...boxes.map((b) => b!.x2)) - x
    const cy = Math.max(...boxes.map((b) => b!.y2)) - y
    // Identity transform: the members keep their coordinates.
    const group_ =
      `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${firstId + i}" name="${escapeXml(group.name)}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
      `<p:grpSpPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/><a:chOff x="${x}" y="${y}"/><a:chExt cx="${cx}" cy="${cy}"/></a:xfrm></p:grpSpPr>` +
      shapes.join('') +
      `</p:grpSp>`
    const [first, ...others] = shapes as string[]
    for (const other of others) xml = xml.replace(other, '')
    xml = xml.replace(first!, group_)
  })
  return xml
}
