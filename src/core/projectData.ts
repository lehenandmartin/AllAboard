// Reading a saved project (IndexedDB or .zip project file): the data is not
// trusted, its structure is checked, and missing settings (file from an
// earlier version) are filled in with the default values.

import { DEFAULT_BOARD_SETTINGS, RATIO_PRESETS } from './settings'
import type { Board, BoardOverrides, BoardSettings, Frame, ImageCrop, ImageMeta, Project, SafeFont } from './types'
import { SAFE_FONTS } from './types'
import type { SlideFormatId } from './units'
import { SLIDE_FORMATS } from './units'

/** Version of the project data format. */
export const PROJECT_FORMAT_VERSION = 1

/** Why a project could not be read; the interface shows the matching text. */
export type ProjectFormatProblem = 'notAProject' | 'damaged' | 'newer'

export class ProjectFormatError extends Error {
  readonly problem: ProjectFormatProblem

  constructor(problem: ProjectFormatProblem, detail?: string) {
    super(detail ? `${problem}: ${detail}` : problem)
    this.problem = problem
  }
}

type Raw = Record<string, unknown>

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback)
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

function requireString(v: unknown, what: string): string {
  if (typeof v !== 'string' || v === '') throw new ProjectFormatError('damaged', `missing ${what}`)
  return v
}

/** Settings with a closed set of values: any other value is ignored. */
const ALLOWED: Partial<Record<keyof BoardSettings, readonly string[]>> = {
  frameRatio: [...Object.keys(RATIO_PRESETS), 'custom', 'firstImage'],
  fit: ['cover', 'contain'],
  textMode: ['none', 'perImage', 'perRow'],
  lastRowAlign: ['left', 'center'],
}
const TEXT_ALIGNS = ['left', 'center', 'right']

/** Fields with a closed set of values in composite settings: an unknown value falls back to the default. */
const NESTED_ALLOWED: Partial<Record<keyof BoardSettings, Record<string, readonly string[]>>> = {
  textStyle: { align: TEXT_ALIGNS },
  mention: {
    align: TEXT_ALIGNS,
    placement: ['letterboxBottom', 'band'],
    bandColor: ['black', 'white'],
    fontFamily: SAFE_FONTS,
  },
}

/** Project default settings: complete, each missing field taken from the default values. */
function normalizeSettings(raw: unknown, base: BoardSettings): BoardSettings {
  if (!isObject(raw)) return base
  const overrides = normalizeOverrides(raw, base)
  const settings = { ...base }
  for (const [key, value] of Object.entries(overrides)) {
    const expected = base[key as keyof BoardSettings]
    Object.assign(settings, { [key]: isObject(expected) ? { ...(expected as object), ...(value as object) } : value })
  }
  return settings
}

/**
 * Settings specific to a board: only the valid values present. For a
 * composite setting, only the provided (and valid) fields are kept: the
 * others stay inherited from the project.
 */
function normalizeOverrides(raw: unknown, base: BoardSettings): BoardOverrides {
  if (!isObject(raw)) return {}
  const out: BoardOverrides = {}
  for (const key of Object.keys(base) as (keyof BoardSettings)[]) {
    const value = raw[key]
    if (value === undefined) continue
    const expected = base[key]
    if (isObject(expected)) {
      if (!isObject(value)) continue
      const fields = pickSameTypes(value, expected as object)
      for (const [field, allowed] of Object.entries(NESTED_ALLOWED[key] ?? {})) {
        if (field in fields && !allowed.includes(fields[field] as string)) delete fields[field]
      }
      if (Object.keys(fields).length > 0) Object.assign(out, { [key]: fields })
    } else if (key === 'columns' || key === 'rows') {
      if (value === 'auto' || (typeof value === 'number' && value >= 1)) Object.assign(out, { [key]: value })
    } else if (typeof value === typeof expected) {
      const allowed = ALLOWED[key]
      if (!allowed || allowed.includes(value as string)) Object.assign(out, { [key]: value })
    }
  }
  return out
}

function pickSameTypes(value: Raw, expected: object): Raw {
  const out: Raw = {}
  for (const [k, v] of Object.entries(expected)) {
    if (typeof value[k] === typeof v) out[k] = value[k]
  }
  return out
}

/** Crop of a frame: kept only if complete (it is brought back within its limits later). */
function normalizeCrop(raw: unknown): { crop?: ImageCrop } {
  if (!isObject(raw)) return {}
  const { x, y, scale } = raw
  const valid = [x, y, scale].every((v) => typeof v === 'number' && Number.isFinite(v))
  return valid ? { crop: { x: x as number, y: y as number, scale: scale as number } } : {}
}

function normalizeFrame(raw: unknown): Frame {
  if (!isObject(raw)) throw new ProjectFormatError('damaged', 'invalid frame')
  return {
    id: requireString(raw.id, 'frame id'),
    imageId: typeof raw.imageId === 'string' ? raw.imageId : null,
    text: str(raw.text, ''),
    ...normalizeCrop(raw.crop),
  }
}

function normalizeBoard(raw: unknown, defaults: BoardSettings, index: number): Board {
  if (!isObject(raw)) throw new ProjectFormatError('damaged', 'invalid board')
  return {
    id: requireString(raw.id, 'board id'),
    name: str(raw.name, `Board ${index + 1}`),
    title: str(raw.title, ''),
    frames: Array.isArray(raw.frames) ? raw.frames.map(normalizeFrame) : [],
    rowTexts: Array.isArray(raw.rowTexts) ? raw.rowTexts.map((t) => str(t, '')) : [],
    overrides: normalizeOverrides(raw.overrides, defaults),
  }
}

function normalizeImage(raw: unknown): ImageMeta | null {
  if (!isObject(raw) || typeof raw.id !== 'string') return null
  const width = num(raw.width, 0)
  const height = num(raw.height, 0)
  if (width <= 0 || height <= 0) return null
  return { id: raw.id, fileName: str(raw.fileName, 'image'), width, height }
}

/** Checks and completes a project read from outside. */
export function normalizeProject(raw: unknown): Project {
  if (!isObject(raw)) throw new ProjectFormatError('damaged', 'invalid project')
  const defaults = normalizeSettings(raw.defaults, DEFAULT_BOARD_SETTINGS)

  const rawSlide = isObject(raw.slide) ? raw.slide : {}
  const slideId = (Object.keys(SLIDE_FORMATS) as SlideFormatId[]).includes(rawSlide.id as SlideFormatId)
    ? (rawSlide.id as SlideFormatId)
    : 'custom'
  const fallback = SLIDE_FORMATS['16:9']
  const width = num(rawSlide.width, fallback.width)
  const height = num(rawSlide.height, fallback.height)
  const slide =
    slideId === 'custom' ? { id: slideId, width, height } : { id: slideId, ...SLIDE_FORMATS[slideId] }

  const boards = Array.isArray(raw.boards) ? raw.boards.map((b, i) => normalizeBoard(b, defaults, i)) : []
  if (boards.length === 0) throw new ProjectFormatError('damaged', 'no boards')

  const images: Record<string, ImageMeta> = {}
  if (isObject(raw.images)) {
    for (const value of Object.values(raw.images)) {
      const image = normalizeImage(value)
      if (image) images[image.id] = image
    }
  }

  return {
    id: requireString(raw.id, 'project id'),
    name: str(raw.name, 'Untitled'),
    slide: width > 0 && height > 0 ? slide : { id: '16:9', ...fallback },
    fontFamily: SAFE_FONTS.includes(raw.fontFamily as SafeFont) ? (raw.fontFamily as SafeFont) : 'Arial',
    defaults,
    boards,
    images,
  }
}

/** Ids of the images used by at least one frame. */
export function usedImageIds(project: Pick<Project, 'boards'>): Set<string> {
  const ids = new Set<string>()
  for (const board of project.boards) for (const f of board.frames) if (f.imageId) ids.add(f.imageId)
  return ids
}

/** Removes the metadata of images no longer in any frame. */
export function pruneImages(project: Project): Project {
  const used = usedImageIds(project)
  const images = Object.fromEntries(Object.entries(project.images).filter(([id]) => used.has(id)))
  return Object.keys(images).length === Object.keys(project.images).length ? project : { ...project, images }
}
