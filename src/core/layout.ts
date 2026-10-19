// Layout engine: the single source of truth for the preview and the export.
// Pure functions, all lengths in inches.

import type { BoardSettings } from './types'
import type { Size } from './units'
import { ptToIn } from './units'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type LayoutSettings = Pick<
  BoardSettings,
  | 'columns'
  | 'rows'
  | 'margins'
  | 'gutterH'
  | 'gutterV'
  | 'titleEnabled'
  | 'titleHeight'
  | 'textMode'
  | 'textHeight'
  | 'textGap'
  | 'lastRowAlign'
>

export interface LayoutInput {
  slide: Size
  settings: LayoutSettings
  /** Number of frames (images and empty frames). */
  frameCount: number
  /** Width / height ratio of the frames. */
  frameAspect: number
}

export interface Layout {
  columns: number
  rows: number
  cellWidth: number
  cellHeight: number
  /** Rectangle of each placed frame, in order. */
  frames: Rect[]
  /** Text block under each frame ("under each image" mode), otherwise empty. */
  frameTexts: Rect[]
  /** Text block under each used row ("under each row" mode), otherwise empty. */
  rowTexts: Rect[]
  title: Rect | null
  /** Space available for the grid (after margins and title). */
  area: Rect
  /** Number of frames that do not fit in a fixed grid. */
  overflow: number
}

/** Two frame widths within 0.5 pt of each other are considered equal. */
export const TIE_TOLERANCE = ptToIn(0.5)

interface GridSpace {
  /** Available width. */
  W: number
  /** Available height. */
  H: number
  /** Height added to each row for the text. */
  t: number
  gutterH: number
  gutterV: number
  aspect: number
}

/** Frame width for a grid of c columns and r rows (0 if impossible). */
export function cellWidthFor(space: GridSpace, c: number, r: number): number {
  if (!(space.aspect > 0) || !Number.isFinite(space.aspect)) return 0
  const wMax = (space.W - (c - 1) * space.gutterH) / c
  const hMax = (space.H - (r - 1) * space.gutterV) / r - space.t
  return Math.max(0, Math.min(wMax, hMax * space.aspect))
}

const toFixedCount = (value: number): number => Math.max(1, Math.floor(value))

const range = (from: number, to: number): number[] =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)

/** Picks (c, r): largest frame, then fewest empty frames, then fewest rows. */
function chooseGrid(
  space: GridSpace,
  n: number,
  columns: LayoutSettings['columns'],
  rows: LayoutSettings['rows'],
): { c: number; r: number; width: number } {
  if (columns !== 'auto' && rows !== 'auto') {
    const c = toFixedCount(columns)
    const r = toFixedCount(rows)
    return { c, r, width: cellWidthFor(space, c, r) }
  }

  const cs = columns === 'auto' ? range(1, n) : [toFixedCount(columns)]
  const rs = rows === 'auto' ? range(1, n) : [toFixedCount(rows)]

  let best: { c: number; r: number; width: number } | null = null
  for (const c of cs) {
    for (const r of rs) {
      if (c * r < n) continue
      const width = cellWidthFor(space, c, r)
      if (!best || isBetter({ c, r, width }, best, n)) best = { c, r, width }
    }
  }
  // Always set: at least one combination satisfies c × r ≥ n.
  return best!
}

function isBetter(
  a: { c: number; r: number; width: number },
  b: { c: number; r: number; width: number },
  n: number,
): boolean {
  if (Math.abs(a.width - b.width) > TIE_TOLERANCE) return a.width > b.width
  const emptyA = a.c * a.r - n
  const emptyB = b.c * b.r - n
  if (emptyA !== emptyB) return emptyA < emptyB
  return a.r < b.r
}

export function computeLayout({ slide, settings, frameCount, frameAspect }: LayoutInput): Layout {
  const { margins } = settings
  const titleHeight = settings.titleEnabled ? settings.titleHeight : 0
  const W = slide.width - margins.left - margins.right
  const H = slide.height - margins.top - margins.bottom - titleHeight
  const textGap = settings.textMode === 'none' ? 0 : settings.textGap
  const textHeight = settings.textMode === 'none' ? 0 : settings.textHeight
  const t = textGap + textHeight

  const area: Rect = {
    x: margins.left,
    y: margins.top + titleHeight,
    w: Math.max(0, W),
    h: Math.max(0, H),
  }
  const title: Rect | null = settings.titleEnabled
    ? { x: margins.left, y: margins.top, w: Math.max(0, W), h: titleHeight }
    : null

  const n = Math.max(0, Math.floor(frameCount))
  if (n === 0) {
    return {
      columns: 0,
      rows: 0,
      cellWidth: 0,
      cellHeight: 0,
      frames: [],
      frameTexts: [],
      rowTexts: [],
      title,
      area,
      overflow: 0,
    }
  }

  const space: GridSpace = {
    W,
    H,
    t,
    gutterH: settings.gutterH,
    gutterV: settings.gutterV,
    aspect: frameAspect,
  }
  const { c, r, width: cellWidth } = chooseGrid(space, n, settings.columns, settings.rows)
  const cellHeight = cellWidth > 0 ? cellWidth / frameAspect : 0

  // The whole c × r grid is centered in the available space.
  const gridW = c * cellWidth + (c - 1) * settings.gutterH
  const gridH = r * (cellHeight + t) + (r - 1) * settings.gutterV
  const x0 = area.x + (W - gridW) / 2
  const y0 = area.y + (H - gridH) / 2
  const stepX = cellWidth + settings.gutterH
  const stepY = cellHeight + t + settings.gutterV

  const placed = Math.min(n, c * r)
  const usedRows = Math.ceil(placed / c)
  const lastRow = usedRows - 1
  const lastRowCount = placed - lastRow * c
  const lastRowOffset =
    settings.lastRowAlign === 'center' ? ((c - lastRowCount) * stepX) / 2 : 0

  const frames: Rect[] = []
  const frameTexts: Rect[] = []
  for (let i = 0; i < placed; i++) {
    const row = Math.floor(i / c)
    const col = i % c
    const x = x0 + col * stepX + (row === lastRow ? lastRowOffset : 0)
    const y = y0 + row * stepY
    frames.push({ x, y, w: cellWidth, h: cellHeight })
    if (settings.textMode === 'perImage') {
      frameTexts.push({ x, y: y + cellHeight + textGap, w: cellWidth, h: textHeight })
    }
  }

  // A row's text block spans the full width of the grid.
  const rowTexts: Rect[] = []
  if (settings.textMode === 'perRow') {
    for (let row = 0; row < usedRows; row++) {
      rowTexts.push({
        x: x0,
        y: y0 + row * stepY + cellHeight + textGap,
        w: gridW,
        h: textHeight,
      })
    }
  }

  return {
    columns: c,
    rows: r,
    cellWidth,
    cellHeight,
    frames,
    frameTexts,
    rowTexts,
    title,
    area,
    overflow: n - placed,
  }
}
