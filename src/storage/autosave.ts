// Continuous autosave: every change to the project is stored in IndexedDB
// shortly after (and immediately if the page is hidden).

import { create } from 'zustand'
import type { Project } from '../core/types'
import { t } from '../i18n'
import { useNoticeStore } from '../store/noticeStore'
import { useProjectStore } from '../store/projectStore'
import { rememberLastOpened, saveProject } from './projectStorage'

/** Delay (ms) between the last change and the save. */
const SAVE_DELAY_MS = 500

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

export const useSaveStore = create<{ status: SaveStatus }>()(() => ({ status: 'saved' }))

let pending: Project | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let errorShown = false

async function flush(): Promise<void> {
  clearTimeout(timer)
  const project = pending
  if (!project) return
  pending = null
  useSaveStore.setState({ status: 'saving' })
  try {
    await saveProject(project)
    errorShown = false
    if (!pending) useSaveStore.setState({ status: 'saved' })
  } catch (error) {
    console.error(error)
    useSaveStore.setState({ status: 'error' })
    if (!errorShown) {
      errorShown = true
      useNoticeStore.getState().show('error', t().notices.autosaveFailed)
    }
  }
}

/** Schedules saving the project. */
export function scheduleSave(project: Project): void {
  pending = project
  useSaveStore.setState({ status: 'pending' })
  clearTimeout(timer)
  timer = setTimeout(() => void flush(), SAVE_DELAY_MS)
}

/** Starts autosaving; returns the function that stops it. */
export function startAutosave(): () => void {
  rememberLastOpened(useProjectStore.getState().project.id)
  const unsubscribe = useProjectStore.subscribe((state, previous) => {
    if (state.project === previous.project) return
    if (state.project.id !== previous.project.id) {
      // Project switch: finish saving the previous one.
      void flush()
      rememberLastOpened(state.project.id)
    }
    scheduleSave(state.project)
  })
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') void flush()
  }
  const onPageHide = () => void flush()
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHide)
  return () => {
    unsubscribe()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', onPageHide)
  }
}
