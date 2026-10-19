import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { pruneImages } from './core/projectData'
import { t, useLocaleStore } from './i18n'
import { scheduleSave, startAutosave } from './storage/autosave'
import { collectUnusedImages, loadLastProject } from './storage/projectStorage'
import { useNoticeStore } from './store/noticeStore'
import { useProjectStore } from './store/projectStore'

/** Unexpected error outside rendering (a rejected promise…): reported without blocking. */
function reportUnexpected(error: unknown) {
  console.error(error)
  useNoticeStore.getState().show('error', t().boot.unexpected)
}

/** The page language follows the interface language (screen readers, spell check). */
function syncDocumentLanguage() {
  const apply = () => {
    document.documentElement.lang = useLocaleStore.getState().locale
  }
  apply()
  useLocaleStore.subscribe(apply)
}

/** Restores the last project, starts autosaving, then shows the app. */
async function start() {
  window.addEventListener('unhandledrejection', (e) => reportUnexpected(e.reason))
  syncDocumentLanguage()

  const restored = await loadLastProject().catch(() => null)
  const store = useProjectStore.getState()
  store.openProject(restored ? pruneImages(restored) : store.project)
  const { project } = useProjectStore.getState()

  startAutosave()
  // A brand-new project is saved right away, so it is found again after a reload.
  if (!restored) scheduleSave(project)
  // Empty history: images no longer used can safely be deleted.
  void collectUnusedImages(project).catch(() => {})
  // Asks the browser not to evict the data when storage runs low.
  void navigator.storage?.persist?.().catch(() => false)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}

start().catch((error: unknown) => {
  console.error(error)
  const message = document.createElement('p')
  message.className = 'boot'
  message.textContent = t().boot.failed
  document.getElementById('root')!.replaceChildren(message)
})
