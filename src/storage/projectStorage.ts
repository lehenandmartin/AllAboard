// Projects saved in IndexedDB: autosave, recent projects, restoring at
// startup, and cleanup of images no longer used.

import { createStore, del, entries, get, set } from 'idb-keyval'
import { normalizeProject, usedImageIds } from '../core/projectData'
import type { Project } from '../core/types'
import { deleteImageBlob, listImageIds } from './imageStore'

const store = createStore('allaboard-projects', 'projects')
const LAST_OPENED_KEY = 'allaboard:last-project'

interface SavedProject {
  project: Project
  /** Date of the last save (ms). */
  savedAt: number
}

export interface ProjectSummary {
  id: string
  name: string
  savedAt: number
  boardCount: number
  imageCount: number
}

export async function saveProject(project: Project): Promise<void> {
  await set(project.id, { project, savedAt: Date.now() } satisfies SavedProject, store)
}

/** Saved project, checked; null if not found or unreadable. */
export async function loadProject(id: string): Promise<Project | null> {
  const saved = await get<SavedProject>(id, store)
  if (!saved) return null
  try {
    return normalizeProject(saved.project)
  } catch {
    return null
  }
}

export async function deleteProject(id: string): Promise<void> {
  await del(id, store)
}

/** Recent projects, from the most recently edited to the oldest. */
export async function listProjects(): Promise<ProjectSummary[]> {
  const all = await entries<string, SavedProject>(store)
  return all
    .map(([, { project, savedAt }]) => ({
      id: project.id,
      name: project.name,
      savedAt,
      boardCount: project.boards.length,
      imageCount: usedImageIds(project).size,
    }))
    .sort((a, b) => b.savedAt - a.savedAt)
}

export function rememberLastOpened(id: string): void {
  try {
    localStorage.setItem(LAST_OPENED_KEY, id)
  } catch {
    // Storage unavailable: the most recent project will be reopened.
  }
}

/** Project to reopen at startup: the last one opened, otherwise the most recently edited. */
export async function loadLastProject(): Promise<Project | null> {
  let lastId: string | null = null
  try {
    lastId = localStorage.getItem(LAST_OPENED_KEY)
  } catch {
    lastId = null
  }
  if (lastId) {
    const project = await loadProject(lastId)
    if (project) return project
  }
  for (const summary of await listProjects()) {
    const project = await loadProject(summary.id)
    if (project) return project
  }
  return null
}

/**
 * Deletes the images used by no saved project (nor by the open project). Run
 * it when the undo history is empty: otherwise an image removed then brought
 * back by "undo" could be gone.
 */
export async function collectUnusedImages(openProject: Project): Promise<number> {
  const used = usedImageIds(openProject)
  for (const [, saved] of await entries<string, SavedProject>(store)) {
    for (const id of usedImageIds(saved.project)) used.add(id)
  }
  let removed = 0
  for (const id of await listImageIds()) {
    if (!used.has(id)) {
      await deleteImageBlob(id)
      removed++
    }
  }
  return removed
}
