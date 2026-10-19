import type { ImportCandidate } from '../../core/imageFiles'
import { isAcceptedImage, prepareImport } from '../../core/imageFiles'
import type { ImageMeta } from '../../core/types'
import { t } from '../../i18n'
import { ImageStorageError, storeImage } from '../../storage/imageStore'
import { useNoticeStore } from '../../store/noticeStore'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { pickImageFiles } from './pickFiles'

interface StoredFiles {
  images: ImageMeta[]
  /** Names of the unreadable files. */
  failed: string[]
  /** The browser storage is full: the following files were not processed. */
  storageFull: boolean
}

/** Stores the files (already sorted) in IndexedDB, with progress. */
async function storeFiles(accepted: readonly ImportCandidate[]): Promise<StoredFiles> {
  const { show } = useNoticeStore.getState()
  const images: ImageMeta[] = []
  const failed: string[] = []
  for (const [i, { file }] of accepted.entries()) {
    show('progress', t().importing.progress(i + 1, accepted.length))
    try {
      images.push(await storeImage(file))
    } catch (error) {
      // Storage full: no point trying the next images.
      if (error instanceof ImageStorageError) return { images, failed, storageFull: true }
      failed.push(file.name)
    }
  }
  return { images, failed, storageFull: false }
}

/** Ignored, unreadable or unstored files, to report after an import. */
function describeProblems(rejected: readonly string[], stored: StoredFiles, acceptedCount: number): string[] {
  const { importing } = t()
  const parts: string[] = []
  if (rejected.length > 0) parts.push(importing.ignored(rejected.length))
  if (stored.failed.length > 0) parts.push(importing.unreadable(stored.failed.length, stored.failed.join(', ')))
  if (stored.storageFull) {
    parts.push(importing.storageFull(acceptedCount - stored.images.length - stored.failed.length))
  }
  return parts
}

/** Imports files at the end of the active board, in natural order. */
export async function importIntoActiveBoard(candidates: readonly ImportCandidate[]): Promise<void> {
  const { show } = useNoticeStore.getState()
  const { importing } = t()
  const { accepted, rejected } = prepareImport(candidates)

  if (accepted.length === 0) {
    if (candidates.length > 0) show('error', importing.noneImported)
    return
  }

  const boardId = useProjectStore.getState().activeBoardId
  const stored = await storeFiles(accepted)
  const { images } = stored

  const { splitImport, splitSize } = useUiStore.getState()
  let boardsUsed = images.length > 0 ? 1 : 0
  if (images.length > 0) {
    if (splitImport) boardsUsed = useProjectStore.getState().addImagesAcrossBoards(boardId, images, splitSize)
    else useProjectStore.getState().addImages(boardId, images)
  }

  const added = importing.added(images.length)
  const parts = [boardsUsed > 1 ? importing.spread(added, boardsUsed) : added]
  const problems = describeProblems(rejected, stored, accepted.length)
  show(
    images.length === 0 ? 'error' : problems.length > 0 ? 'warning' : 'info',
    [...parts, ...problems].join(' · '),
  )
}

/** Replaces the image of a frame of the active board (or fills an empty frame). */
export async function replaceFrameImage(frameId: string, file: File): Promise<void> {
  const { show } = useNoticeStore.getState()
  const { importing } = t()
  if (!isAcceptedImage(file)) {
    show('error', importing.unsupported(file.name))
    return
  }
  try {
    const image = await storeImage(file)
    useProjectStore.getState().setFrameImage(frameId, image)
  } catch (error) {
    show('error', error instanceof ImageStorageError ? importing.noRoom : importing.unreadableOne(file.name))
  }
}

/** Opens the file picker to replace a frame's image (or fill an empty frame). */
export async function chooseImageForFrame(frameId: string): Promise<void> {
  const [file] = await pickImageFiles(false)
  if (file) await replaceFrameImage(frameId, file)
}

/**
 * Replaces all the images of a board with new files, sorted by name and
 * placed in frame order. Texts, title and settings stay.
 */
export async function replaceAllImagesInBoard(boardId: string): Promise<void> {
  const files = await pickImageFiles(true)
  if (files.length === 0) return
  const { show } = useNoticeStore.getState()
  const { importing, defaults } = t()
  const { accepted, rejected } = prepareImport(files.map((file) => ({ file, path: file.name })))
  if (accepted.length === 0) {
    show('error', importing.noneReplaced)
    return
  }

  const stored = await storeFiles(accepted)
  const problems = describeProblems(rejected, stored, accepted.length)
  if (stored.images.length === 0) {
    show('error', [importing.noneReplacedShort, ...problems].join(' · '))
    return
  }

  const store = useProjectStore.getState()
  const name = store.project.boards.find((b) => b.id === boardId)?.name ?? defaults.boardName
  const { replaced, kept, added } = store.replaceBoardImages(boardId, stored.images)
  const parts = [importing.replaced(name, replaced)]
  if (kept > 0) parts.push(importing.kept(kept))
  if (added > 0) parts.push(importing.appended(added))
  show(problems.length > 0 || kept > 0 ? 'warning' : 'info', [...parts, ...problems].join(' · '))
}
