// Project actions: new, open a recent project, delete, save and open a .zip
// project file. Autosave stores any open project by itself.

import { ProjectFormatError, pruneImages } from '../core/projectData'
import { t } from '../i18n'
import { useNoticeStore } from '../store/noticeStore'
import { createProject, useProjectStore } from '../store/projectStore'
import { downloadBlob } from './download'
import { getImageBlob, putImageBlob } from './imageStore'
import { readProjectFile, projectFileName, writeProjectFile } from './projectFile'
import { collectUnusedImages, deleteProject, loadProject } from './projectStorage'

const notify = (...args: Parameters<ReturnType<typeof useNoticeStore.getState>['show']>) =>
  useNoticeStore.getState().show(...args)

export function newProject(): void {
  useProjectStore.getState().openProject(createProject())
}

export async function openSavedProject(id: string): Promise<void> {
  const project = await loadProject(id)
  if (!project) {
    notify('error', t().notices.projectNotFound)
    return
  }
  useProjectStore.getState().openProject(pruneImages(project))
}

/** Deletes a saved project (not the open one), then the images no longer needed. */
export async function deleteSavedProject(id: string): Promise<void> {
  await deleteProject(id)
  await collectUnusedImages(useProjectStore.getState().project)
}

/** Downloads the open project as a .zip project file. */
export async function saveProjectFile(): Promise<void> {
  const { project } = useProjectStore.getState()
  const { notices, defaults } = t()
  notify('progress', notices.preparingFile)
  try {
    const { data, missingCount } = await writeProjectFile(project, { get: getImageBlob })
    const fileName = projectFileName(project.name, new Date(), defaults.fileName)
    downloadBlob(new Blob([data as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), fileName)
    if (missingCount > 0) notify('warning', notices.fileSavedMissing(fileName, missingCount))
    else notify('info', notices.fileSaved(fileName))
  } catch (error) {
    console.error(error)
    notify('error', notices.fileSaveFailed)
  }
}

/** Opens a .zip project file: it becomes a new project, saved in the browser. */
export async function openProjectFile(file: File): Promise<void> {
  const texts = t()
  notify('progress', texts.notices.opening(file.name))
  try {
    const { project, missingCount } = await readProjectFile(file, { put: putImageBlob })
    useProjectStore.getState().openProject(project)
    if (missingCount > 0) notify('warning', texts.notices.openedMissing(project.name, missingCount))
    else notify('info', texts.notices.opened(project.name))
  } catch (error) {
    if (!(error instanceof ProjectFormatError)) console.error(error)
    notify(
      'error',
      error instanceof ProjectFormatError ? texts.projectFile[error.problem] : texts.notices.openFailed,
    )
  }
}
