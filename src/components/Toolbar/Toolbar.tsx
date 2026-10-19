import { useCallback, useState } from 'react'
import { useStore } from 'zustand'
import { useT } from '../../i18n'
import type { SaveStatus } from '../../storage/autosave'
import { useSaveStore } from '../../storage/autosave'
import { redo, undo, useProjectStore } from '../../store/projectStore'
import { Icon } from '../Icon/Icon'
import type { IconName } from '../Icon/icons'
import { ImportButton } from '../Import/ImportButton'
import { ShortcutsDialog } from '../Shortcuts/ShortcutsDialog'
import { ExportMenu } from './ExportMenu'
import { ProjectMenu } from './ProjectMenu'
import { runExport } from './runExport'
import { useGlobalShortcuts } from './useGlobalShortcuts'
import './Toolbar.css'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = IS_MAC ? '⌘' : 'Ctrl+'

const SAVE_ICONS: Record<SaveStatus, IconName> = {
  saved: 'cloud-checkmark',
  pending: 'arrow-sync',
  saving: 'arrow-sync',
  error: 'cloud-dismiss',
}

/** App mark: a grid of frames, the last one still to be drawn. */
function AppMark() {
  return (
    <svg className="topbar__mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#fff" />
      <rect x="6" y="8" width="9" height="6" rx="1" fill="currentColor" />
      <rect x="17" y="8" width="9" height="6" rx="1" fill="currentColor" />
      <rect x="6" y="18" width="9" height="6" rx="1" fill="currentColor" opacity=".7" />
      <rect
        x="17"
        y="18"
        width="9"
        height="6"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2 1.5"
      />
    </svg>
  )
}

function SaveIndicator() {
  const status = useSaveStore((s) => s.status)
  const { topbar } = useT()
  return (
    <span className={`topbar__save topbar__save--${status}`} role="status" title={topbar.autosaveHint}>
      <Icon name={SAVE_ICONS[status]} size={16} />
      {topbar.save[status]}
    </span>
  )
}

/** Brand bar (project title, save status, help) and command bar. */
export function Toolbar() {
  const { appName, topbar, cmdbar } = useT()
  const name = useProjectStore((s) => s.project.name)
  const setProjectName = useProjectStore((s) => s.setProjectName)
  const insertEmptyFrame = useProjectStore((s) => s.insertEmptyFrame)
  // After the last selected frame, otherwise at the end of the board.
  const lastSelected = useProjectStore((s) => s.selectedFrameIds.at(-1) ?? null)
  const [exporting, setExporting] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const canUndo = useStore(useProjectStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useProjectStore.temporal, (s) => s.futureStates.length > 0)

  const onExport = useCallback(async () => {
    const hasFrames = useProjectStore.getState().project.boards.some((b) => b.frames.length > 0)
    if (exporting || !hasFrames) return
    setExporting(true)
    try {
      await runExport()
    } finally {
      setExporting(false)
    }
  }, [exporting])
  const openHelp = useCallback(() => setHelpOpen(true), [])
  useGlobalShortcuts({ onExport: () => void onExport(), onHelp: openHelp })

  return (
    <>
      <header className="topbar">
        <span className="topbar__brand">
          <AppMark />
          {appName}
        </span>
        <div className="topbar__title">
          <input
            className="topbar__name"
            type="text"
            value={name}
            aria-label={topbar.projectName}
            title={topbar.renameProject}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <SaveIndicator />
        </div>
        <div className="topbar__actions">
          <button
            type="button"
            className="topbar__button"
            onClick={openHelp}
            aria-label={topbar.help}
            title={topbar.helpTitle}
          >
            <Icon name="question-circle" />
          </button>
        </div>
      </header>

      <div className="cmdbar" role="toolbar" aria-label={cmdbar.label}>
        <ProjectMenu />
        <span className="cmdbar__sep" aria-hidden="true" />
        <button
          type="button"
          className="button button--ghost button--icon"
          onClick={undo}
          disabled={!canUndo}
          aria-label={cmdbar.undo}
          title={cmdbar.undoTitle(`${MOD}Z`)}
        >
          <Icon name="arrow-undo" />
        </button>
        <button
          type="button"
          className="button button--ghost button--icon"
          onClick={redo}
          disabled={!canRedo}
          aria-label={cmdbar.redo}
          title={cmdbar.redoTitle(IS_MAC ? '⇧⌘Z' : 'Ctrl+Y')}
        >
          <Icon name="arrow-redo" />
        </button>
        <span className="cmdbar__sep" aria-hidden="true" />
        <ImportButton className="button button--ghost">
          <Icon name="image-add" />
          {cmdbar.addImages}
        </ImportButton>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => insertEmptyFrame(lastSelected, 'after')}
          title={cmdbar.emptyFrameTitle}
        >
          <Icon name="add-square" />
          {cmdbar.emptyFrame}
        </button>
        <div className="cmdbar__grow" />
        <ExportMenu exporting={exporting} onExport={() => void onExport()} />
      </div>

      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}
