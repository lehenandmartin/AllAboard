import { describe, expect, it } from 'vitest'
import type { Layout, LayoutInput, LayoutSettings, Rect } from './layout'
import { TIE_TOLERANCE, cellWidthFor, computeLayout } from './layout'
import { RATIO_PRESETS } from './settings'
import type { TextMode } from './types'
import { SLIDE_FORMATS, cmToIn } from './units'

const EPS = 1e-9

const bare: LayoutSettings = {
  columns: 'auto',
  rows: 'auto',
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
  gutterH: 0,
  gutterV: 0,
  titleEnabled: false,
  titleHeight: 0,
  textMode: 'none',
  textHeight: 0,
  textGap: 0,
  lastRowAlign: 'left',
}

function layout(
  overrides: Partial<LayoutSettings>,
  frameCount: number,
  frameAspect = 1,
  slide = { width: 10, height: 5 },
): Layout {
  return computeLayout({ slide, settings: { ...bare, ...overrides }, frameCount, frameAspect })
}

function expectRect(actual: Rect | undefined, expected: Rect): void {
  expect(actual).toBeDefined()
  expect(actual!.x).toBeCloseTo(expected.x, 9)
  expect(actual!.y).toBeCloseTo(expected.y, 9)
  expect(actual!.w).toBeCloseTo(expected.w, 9)
  expect(actual!.h).toBeCloseTo(expected.h, 9)
}

const inside = (r: Rect, area: Rect): boolean =>
  r.x >= area.x - EPS &&
  r.y >= area.y - EPS &&
  r.x + r.w <= area.x + area.w + EPS &&
  r.y + r.h <= area.y + area.h + EPS

const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS

describe('cellWidthFor', () => {
  const space = { W: 10, H: 5, t: 0, gutterH: 0, gutterV: 0, aspect: 1 }

  it('takes the minimum of the width and height constraints', () => {
    expect(cellWidthFor(space, 2, 1)).toBeCloseTo(5)
    expect(cellWidthFor(space, 1, 2)).toBeCloseTo(2.5)
    expect(cellWidthFor(space, 4, 2)).toBeCloseTo(2.5)
  })

  it('accounts for gutters and text', () => {
    const s = { W: 8, H: 4, t: 0.5, gutterH: 0.2, gutterV: 0.4, aspect: 2 }
    // wMax = (8 − 0.4) / 3 = 2.5333; hMax = (4 − 0.4) / 2 − 0.5 = 1.3 → 2.6
    expect(cellWidthFor(s, 3, 2)).toBeCloseTo(7.6 / 3)
    // wMax = 8; hMax = 4 − 0.5 = 3.5 → 7
    expect(cellWidthFor(s, 1, 1)).toBeCloseTo(7)
  })

  it('returns 0 when room is lacking or the ratio is invalid', () => {
    expect(cellWidthFor({ ...space, W: -1 }, 1, 1)).toBe(0)
    expect(cellWidthFor({ ...space, t: 6 }, 1, 1)).toBe(0)
    expect(cellWidthFor({ ...space, gutterH: 20 }, 2, 1)).toBe(0)
    expect(cellWidthFor({ ...space, aspect: 0 }, 1, 1)).toBe(0)
    expect(cellWidthFor({ ...space, aspect: Number.NaN }, 1, 1)).toBe(0)
  })
})

describe('auto mode: values computed by hand (10 × 5 slide, 1:1 frames)', () => {
  it.each([
    [1, 1, 1, 5],
    [2, 2, 1, 5],
    [3, 3, 1, 10 / 3],
    [4, 4, 1, 2.5],
    [7, 4, 2, 2.5],
    [8, 4, 2, 2.5],
  ])('n = %i → %i × %i, frame of %f', (n, c, r, w) => {
    const l = layout({}, n)
    expect([l.columns, l.rows]).toEqual([c, r])
    expect(l.cellWidth).toBeCloseTo(w)
    expect(l.cellHeight).toBeCloseTo(w)
  })

  it('for equal widths, prefers the fewest empty frames', () => {
    // n = 5: 3 × 2 and 4 × 2 both give 2.5; 3 × 2 has only one empty frame.
    const l = layout({}, 5)
    expect([l.columns, l.rows]).toEqual([3, 2])
  })

  it('for equal widths and empty frames, prefers the fewest rows', () => {
    // 2 × 2 slide, n = 2, 1:1 frames: 2 × 1 and 1 × 2 both give 1.
    const tie = layout({}, 2, 1, { width: 2, height: 2 })
    expect([tie.columns, tie.rows]).toEqual([2, 1])
  })

  it('considers two widths less than 0.5 pt apart as equal', () => {
    // n = 5: 5 × 1 (no empty frame) gives 1; 3 × 2 gives H / 2.
    const within = layout({}, 5, 1, { width: 5, height: 2 + 2 * 0.8 * TIE_TOLERANCE })
    expect([within.columns, within.rows]).toEqual([5, 1])
    const beyond = layout({}, 5, 1, { width: 5, height: 2 + 2 * 1.2 * TIE_TOLERANCE })
    expect([beyond.columns, beyond.rows]).toEqual([3, 2])
  })

  it('realistic case: 6 16:9 shots on a 16:9 slide → 3 × 2', () => {
    const l = computeLayout({
      slide: SLIDE_FORMATS['16:9'],
      settings: { ...bare, margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 }, gutterH: 0.2, gutterV: 0.2 },
      frameCount: 6,
      frameAspect: 16 / 9,
    })
    expect([l.columns, l.rows]).toEqual([3, 2])
    expect(l.cellWidth).toBeCloseTo((40 / 3 - 1 - 0.4) / 3)
  })
})

describe('auto mode: properties for n = 1 to 24', () => {
  const settings: LayoutSettings = {
    ...bare,
    margins: { top: cmToIn(1), right: cmToIn(1.2), bottom: cmToIn(0.8), left: cmToIn(1) },
    gutterH: cmToIn(0.5),
    gutterV: cmToIn(0.3),
    titleEnabled: true,
    titleHeight: cmToIn(1.5),
    textHeight: cmToIn(1),
    textGap: cmToIn(0.2),
  }
  const ratios = ['16:9', '1:1', '9:16'] as const
  const textModes: TextMode[] = ['none', 'perImage', 'perRow']

  for (const ratio of ratios) {
    for (const textMode of textModes) {
      for (let n = 1; n <= 24; n++) {
        it(`ratio ${ratio}, text ${textMode}, n = ${n}`, () => {
          const input: LayoutInput = {
            slide: SLIDE_FORMATS['16:9'],
            settings: { ...settings, textMode },
            frameCount: n,
            frameAspect: RATIO_PRESETS[ratio],
          }
          const l = computeLayout(input)
          const { columns: c, rows: r } = l

          // All frames fit in the grid.
          expect(c * r).toBeGreaterThanOrEqual(n)
          expect(l.frames).toHaveLength(n)
          expect(l.overflow).toBe(0)
          // No entirely empty row.
          expect(c * (r - 1)).toBeLessThan(n)

          // Frames have the right ratio and a positive size.
          expect(l.cellWidth).toBeGreaterThan(0)
          expect(l.cellWidth / l.cellHeight).toBeCloseTo(RATIO_PRESETS[ratio], 9)

          // The number of text blocks depends on the mode.
          expect(l.frameTexts).toHaveLength(textMode === 'perImage' ? n : 0)
          expect(l.rowTexts).toHaveLength(textMode === 'perRow' ? r : 0)

          // Everything is within the available area, without overlap.
          const rects = [...l.frames, ...l.frameTexts, ...l.rowTexts]
          for (const rect of rects) expect(inside(rect, l.area)).toBe(true)
          for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
              expect(overlap(rects[i]!, rects[j]!)).toBe(false)
            }
          }

          // The grid is centered (the first row is always complete).
          const first = l.frames[0]!
          const lastOfFirstRow = l.frames[c - 1]!
          const left = first.x - l.area.x
          const right = l.area.x + l.area.w - (lastOfFirstRow.x + lastOfFirstRow.w)
          expect(left).toBeCloseTo(right, 9)
          const lastFrame = l.frames[n - 1]!
          const bottomEdge =
            textMode === 'none' ? lastFrame.y + lastFrame.h : lastFrame.y + lastFrame.h + input.settings.textGap + input.settings.textHeight
          const top = first.y - l.area.y
          const bottom = l.area.y + l.area.h - bottomEdge
          expect(top).toBeCloseTo(bottom, 9)

          // No other combination gives a clearly larger frame.
          const t = textMode === 'none' ? 0 : input.settings.textGap + input.settings.textHeight
          const space = {
            W: l.area.w,
            H: l.area.h,
            t,
            gutterH: settings.gutterH,
            gutterV: settings.gutterV,
            aspect: input.frameAspect,
          }
          for (let cc = 1; cc <= n; cc++) {
            for (let rr = 1; rr <= n; rr++) {
              if (cc * rr < n) continue
              expect(cellWidthFor(space, cc, rr)).toBeLessThanOrEqual(l.cellWidth + TIE_TOLERANCE)
            }
          }
        })
      }
    }
  }
})

describe('margins, gutters and title', () => {
  it('places the frames at positions computed by hand', () => {
    const l = layout(
      {
        columns: 3,
        rows: 2,
        margins: { top: 0.5, right: 1, bottom: 0.5, left: 1 },
        gutterH: 0.2,
        gutterV: 0.4,
        titleEnabled: true,
        titleHeight: 1,
      },
      6,
      1,
      { width: 10, height: 6 },
    )
    // W = 8, H = 4; wMax = 2.5333, hMax = 1.8 → frame of 1.8.
    expect(l.cellWidth).toBeCloseTo(1.8)
    expectRect(l.area, { x: 1, y: 1.5, w: 8, h: 4 })
    expectRect(l.title!, { x: 1, y: 0.5, w: 8, h: 1 })
    // Grid 5.8 × 4 → x0 = 2.1, y0 = 1.5.
    expectRect(l.frames[0], { x: 2.1, y: 1.5, w: 1.8, h: 1.8 })
    expectRect(l.frames[4], { x: 4.1, y: 3.7, w: 1.8, h: 1.8 })
    expectRect(l.frames[5], { x: 6.1, y: 3.7, w: 1.8, h: 1.8 })
  })

  it('without a title, the title rectangle is null and the area starts at the margin', () => {
    const l = layout({ titleEnabled: false, titleHeight: 2, margins: { top: 0.3, right: 0, bottom: 0, left: 0 } }, 1)
    expect(l.title).toBeNull()
    expect(l.area.y).toBeCloseTo(0.3)
    expect(l.area.h).toBeCloseTo(4.7)
  })
})

describe('text modes', () => {
  it('under each image: a block as wide as the frame', () => {
    const l = layout({ textMode: 'perImage', textHeight: 1, textGap: 0.5 }, 1)
    // t = 1.5; hMax = 3.5 → frame of 3.5, horizontally centered.
    expect(l.cellWidth).toBeCloseTo(3.5)
    expectRect(l.frames[0], { x: 3.25, y: 0, w: 3.5, h: 3.5 })
    expectRect(l.frameTexts[0], { x: 3.25, y: 4, w: 3.5, h: 1 })
    expect(l.rowTexts).toHaveLength(0)
  })

  it('under each row: a block as wide as the grid, even for a centered incomplete row', () => {
    const l = layout(
      { columns: 2, textMode: 'perRow', textHeight: 1, textGap: 0.5, lastRowAlign: 'center' },
      3,
    )
    // 2 × 2; hMax = 2.5 − 1.5 = 1 → frame of 1; grid 2 × 5.
    expect([l.columns, l.rows]).toEqual([2, 2])
    expect(l.rowTexts).toHaveLength(2)
    expectRect(l.rowTexts[0], { x: 4, y: 1.5, w: 2, h: 1 })
    expectRect(l.rowTexts[1], { x: 4, y: 4, w: 2, h: 1 })
    // The single image of the last row is centered.
    expectRect(l.frames[2], { x: 4.5, y: 2.5, w: 1, h: 1 })
    expect(l.frameTexts).toHaveLength(0)
  })

  it('in none mode, the text gap and height are ignored', () => {
    const l = layout({ textMode: 'none', textHeight: 3, textGap: 1 }, 1)
    expect(l.cellWidth).toBeCloseTo(5)
    expect(l.frameTexts).toHaveLength(0)
    expect(l.rowTexts).toHaveLength(0)
  })
})

describe('last row alignment', () => {
  it('left', () => {
    const l = layout({ columns: 3 }, 5)
    // 3 × 2, frame of 2.5, grid 7.5 → x0 = 1.25.
    expect(l.frames[3]!.x).toBeCloseTo(1.25)
    expect(l.frames[4]!.x).toBeCloseTo(3.75)
  })

  it('centered', () => {
    const l = layout({ columns: 3, lastRowAlign: 'center' }, 5)
    expect(l.frames[3]!.x).toBeCloseTo(2.5)
    expect(l.frames[4]!.x).toBeCloseTo(5)
    // Complete rows do not move.
    expect(l.frames[0]!.x).toBeCloseTo(1.25)
  })
})

describe('user constraints', () => {
  it('columns only: the number of rows follows', () => {
    const l = layout({ columns: 2 }, 5)
    expect([l.columns, l.rows]).toEqual([2, 3])
    expect(l.frames).toHaveLength(5)
  })

  it('rows only: the number of columns follows', () => {
    const l = layout({ rows: 1 }, 5)
    expect([l.columns, l.rows]).toEqual([5, 1])
  })

  it('more fixed columns than frames: the grid keeps its columns', () => {
    const l = layout({ columns: 4 }, 2)
    expect([l.columns, l.rows]).toEqual([4, 1])
    expect(l.cellWidth).toBeCloseTo(2.5)
    expect(l.frames[0]!.x).toBeCloseTo(0)
  })

  it('fixed columns and rows, no overflow', () => {
    const l = layout({ columns: 3, rows: 3 }, 4)
    expect([l.columns, l.rows]).toEqual([3, 3])
    expect(l.frames).toHaveLength(4)
    expect(l.overflow).toBe(0)
  })

  it('fixed columns and rows, with overflow', () => {
    const l = layout({ columns: 2, rows: 2 }, 7)
    expect(l.frames).toHaveLength(4)
    expect(l.overflow).toBe(3)
  })

  it('non-integer or zero fixed values become an integer ≥ 1', () => {
    const l = layout({ columns: 2.7, rows: 0 }, 2)
    expect([l.columns, l.rows]).toEqual([2, 1])
  })
})

describe('impossible cases and limits', () => {
  it('no frames: only the title', () => {
    const l = layout({ titleEnabled: true, titleHeight: 1 }, 0)
    expect(l.frames).toHaveLength(0)
    expect(l.rowTexts).toHaveLength(0)
    expect(l.title).not.toBeNull()
    expect(l.overflow).toBe(0)
  })

  it('margins larger than the slide: zero-size frames', () => {
    const l = layout({ margins: { top: 3, right: 6, bottom: 3, left: 6 } }, 3)
    expect(l.cellWidth).toBe(0)
    expect(l.cellHeight).toBe(0)
    expect(l.frames).toHaveLength(3)
    expect(l.area.w).toBe(0)
    expect(l.area.h).toBe(0)
    for (const f of l.frames) expect([f.w, f.h]).toEqual([0, 0])
  })

  it('text taller than the area: zero-size frames', () => {
    const l = layout({ textMode: 'perImage', textHeight: 6 }, 2)
    expect(l.cellWidth).toBe(0)
  })

  it('invalid ratio: zero-size frames', () => {
    const l = layout({}, 2, 0)
    expect(l.cellWidth).toBe(0)
    expect(l.cellHeight).toBe(0)
  })
})
