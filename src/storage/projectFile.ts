// Project file: a .zip that holds project.json and an images/ folder. It is
// used to archive and share a project that stays editable.
// JSZip is loaded only when needed, to keep the app light at startup.

import type JSZip from 'jszip'
import { datedFileName } from '../core/format'
import { sniffImageType } from '../core/imageData'
import { PROJECT_FORMAT_VERSION, ProjectFormatError, normalizeProject, pruneImages } from '../core/projectData'
import type { Project } from '../core/types'

export const PROJECT_FILE_EXTENSION = '.zip'
const FORMAT_NAME = 'allaboard'

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

/** Access to image data (IndexedDB in the app, memory in tests). */
export interface ImageIO {
  get: (id: string) => Promise<Blob | undefined>
  put: (id: string, blob: Blob) => Promise<void>
}

interface ProjectFileJson {
  format: typeof FORMAT_NAME
  version: number
  savedAt: string
  project: Project
}

export const projectFileName = (projectName: string, date = new Date(), fallback?: string): string =>
  datedFileName(projectName, PROJECT_FILE_EXTENSION, date, fallback)

/** Creates the project file. Missing images are counted, not blocking. */
export async function writeProjectFile(
  project: Project,
  images: Pick<ImageIO, 'get'>,
): Promise<{ data: Uint8Array; missingCount: number }> {
  const { default: JSZipLib } = await import('jszip')
  const zip = new JSZipLib()
  const pruned = pruneImages(project)
  const json: ProjectFileJson = {
    format: FORMAT_NAME,
    version: PROJECT_FORMAT_VERSION,
    savedAt: new Date().toISOString(),
    project: pruned,
  }
  zip.file('project.json', JSON.stringify(json, null, 2))

  let missingCount = 0
  for (const id of Object.keys(pruned.images)) {
    const blob = await images.get(id)
    if (!blob) {
      missingCount++
      continue
    }
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const extension = EXTENSIONS[sniffImageType(bytes) ?? ''] ?? 'bin'
    // Images are already compressed: no point compressing them again in the zip.
    zip.file(`images/${id}.${extension}`, bytes, { compression: 'STORE' })
  }

  const data = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  return { data, missingCount }
}

/**
 * Reads a project file and stores its images. The project gets new ids
 * (project and images): importing the same file twice gives two independent
 * projects, without overwriting anything.
 */
export async function readProjectFile(
  data: ArrayBuffer | Uint8Array | Blob,
  images: Pick<ImageIO, 'put'>,
  newId: () => string = () => crypto.randomUUID(),
): Promise<{ project: Project; missingCount: number }> {
  const { default: JSZipLib } = await import('jszip')
  let zip: JSZip
  try {
    zip = await JSZipLib.loadAsync(data)
  } catch {
    throw new ProjectFormatError('notAProject')
  }
  const jsonFile = zip.file('project.json')
  if (!jsonFile) throw new ProjectFormatError('notAProject')

  let json: Partial<ProjectFileJson>
  try {
    json = JSON.parse(await jsonFile.async('string')) as Partial<ProjectFileJson>
  } catch {
    throw new ProjectFormatError('damaged')
  }
  if (json.format !== FORMAT_NAME) throw new ProjectFormatError('notAProject')
  if (typeof json.version !== 'number' || json.version > PROJECT_FORMAT_VERSION) {
    throw new ProjectFormatError('newer')
  }

  const project = normalizeProject(json.project)

  // New image ids, and copy of the files.
  const renamed = new Map<string, string>()
  const imageFiles = new Map(
    Object.values(zip.files)
      .filter((f) => !f.dir && f.name.startsWith('images/'))
      .map((f) => [f.name.slice('images/'.length).replace(/\.[^.]+$/, ''), f]),
  )
  let missingCount = 0
  for (const meta of Object.values(project.images)) {
    const id = newId()
    renamed.set(meta.id, id)
    const file = imageFiles.get(meta.id)
    if (!file) {
      missingCount++
      continue
    }
    const bytes = await file.async('uint8array')
    const type = sniffImageType(bytes)
    if (!type) {
      missingCount++
      continue
    }
    await images.put(id, new Blob([bytes as Uint8Array<ArrayBuffer>], { type }))
  }

  const imported: Project = {
    ...project,
    id: newId(),
    images: Object.fromEntries(
      Object.values(project.images).map((meta) => {
        const id = renamed.get(meta.id)!
        return [id, { ...meta, id }]
      }),
    ),
    boards: project.boards.map((board) => ({
      ...board,
      frames: board.frames.map((f) => ({ ...f, imageId: f.imageId ? (renamed.get(f.imageId) ?? null) : null })),
    })),
  }
  return { project: imported, missingCount }
}
