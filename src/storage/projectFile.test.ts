import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { ProjectFormatError } from '../core/projectData'
import { DEFAULT_BOARD_SETTINGS } from '../core/settings'
import type { Project } from '../core/types'
import { SLIDE_FORMATS } from '../core/units'
import { projectFileName, readProjectFile, writeProjectFile } from './projectFile'

const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
)

const project = (): Project => ({
  id: 'p1',
  name: 'Summer ad',
  slide: { id: '16:9', ...SLIDE_FORMATS['16:9'] },
  fontFamily: 'Arial',
  defaults: DEFAULT_BOARD_SETTINGS,
  boards: [
    {
      id: 'b1',
      name: 'Intro',
      title: 'Titre',
      frames: [
        { id: 'f1', imageId: 'a', text: 'Shot 1' },
        { id: 'f2', imageId: null, text: 'to draw' },
        { id: 'f3', imageId: 'a', text: 'same image' },
      ],
      rowTexts: [],
      overrides: { columns: 3 },
    },
  ],
  images: {
    a: { id: 'a', fileName: 'a.png', width: 1, height: 1 },
    orphelin: { id: 'orphelin', fileName: 'o.png', width: 1, height: 1 },
  },
})

function memoryImages(initial: Record<string, Uint8Array> = {}) {
  const blobs = new Map(Object.entries(initial).map(([id, b]) => [id, new Blob([b as Uint8Array<ArrayBuffer>])]))
  return {
    blobs,
    get: async (id: string) => blobs.get(id),
    put: async (id: string, blob: Blob) => void blobs.set(id, blob),
  }
}

let counter = 0
const sequentialIds = () => `id-${++counter}`

describe('.zip project file', () => {
  it('file name: project + date', () => {
    expect(projectFileName('Summer / ad', new Date(2026, 0, 2))).toBe('Summer - ad 2026-01-02.zip')
  })

  it('holds project.json and only the used images', async () => {
    const { data, missingCount } = await writeProjectFile(project(), memoryImages({ a: PNG }))
    expect(missingCount).toBe(0)
    const zip = await JSZip.loadAsync(data)
    const files = Object.values(zip.files).filter((f) => !f.dir).map((f) => f.name)
    expect(files.sort()).toEqual(['images/a.png', 'project.json'])
    const json = JSON.parse(await zip.file('project.json')!.async('string'))
    expect(json.format).toBe('allaboard')
    expect(json.version).toBe(1)
    expect(Object.keys(json.project.images)).toEqual(['a'])
  })

  it('round trip: same content, new ids', async () => {
    const original = project()
    const { data } = await writeProjectFile(original, memoryImages({ a: PNG }))
    const target = memoryImages()
    const { project: imported, missingCount } = await readProjectFile(data, target, sequentialIds)

    expect(missingCount).toBe(0)
    expect(imported.id).not.toBe(original.id)
    expect(imported.name).toBe('Summer ad')
    const board = imported.boards[0]!
    expect(board.frames.map((f) => f.text)).toEqual(['Shot 1', 'to draw', 'same image'])
    expect(board.overrides).toEqual({ columns: 3 })
    // The same image, used twice, keeps a single (new) id.
    const [first, , third] = board.frames
    expect(first!.imageId).toBe(third!.imageId)
    expect(first!.imageId).not.toBe('a')
    expect(imported.images[first!.imageId!]).toMatchObject({ fileName: 'a.png', width: 1, height: 1 })
    const stored = target.blobs.get(first!.imageId!)!
    expect(stored.type).toBe('image/png')
    expect(new Uint8Array(await stored.arrayBuffer())).toEqual(PNG)
  })

  it('an image missing when saving is counted', async () => {
    const { data, missingCount } = await writeProjectFile(project(), memoryImages())
    expect(missingCount).toBe(1)
    const { missingCount: missingOnRead } = await readProjectFile(data, memoryImages(), sequentialIds)
    expect(missingOnRead).toBe(1)
  })

  it('rejects a file that is not a project', async () => {
    await expect(readProjectFile(new Uint8Array([1, 2, 3]), memoryImages())).rejects.toThrow(ProjectFormatError)
    const zip = new JSZip()
    zip.file('project.json', JSON.stringify({ format: 'other', version: 1, project: {} }))
    const other = await zip.generateAsync({ type: 'uint8array' })
    await expect(readProjectFile(other, memoryImages())).rejects.toThrow('notAProject')
  })

  it('rejects a file from a newer version', async () => {
    const zip = new JSZip()
    zip.file('project.json', JSON.stringify({ format: 'allaboard', version: 99, project: project() }))
    const future = await zip.generateAsync({ type: 'uint8array' })
    await expect(readProjectFile(future, memoryImages())).rejects.toThrow('newer')
  })
})
