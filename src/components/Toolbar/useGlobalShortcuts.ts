import { useEffect } from 'react'
import { t } from '../../i18n'
import { useNoticeStore } from '../../store/noticeStore'
import { boardSelection, redo, undo, useProjectStore } from '../../store/projectStore'

const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/**
 * Global shortcuts:
 * - undo Cmd/Ctrl+Z, redo Shift+Cmd/Ctrl+Z or Ctrl+Y (everywhere, texts
 *   included: their content is part of the project history);
 * - Cmd/Ctrl+S: reminder that everything is saved automatically (instead of
 *   the browser's "Save page");
 * - Cmd/Ctrl+E: export; "?": shortcuts help;
 * - Cmd/Ctrl+D: duplicate the selected frames, otherwise the selected boards;
 * - Alt+N (and Cmd/Ctrl+N if the browser lets it through): new board after
 *   the active board. Browsers reserve Cmd/Ctrl+N for opening a window and do
 *   not pass it to the page: hence Alt+N.
 * D and N do nothing while typing a text.
 */

/** Cmd/Ctrl+D: the frame selection if any, otherwise the selected boards (at least the active one). */
function duplicate() {
  const store = useProjectStore.getState()
  if (store.selectedFrameIds.length > 0) store.duplicateFrames(store.selectedFrameIds)
  else store.duplicateBoards(boardSelection(store))
}

function newBoardAfterActive() {
  const store = useProjectStore.getState()
  store.addBoard(store.activeBoardId)
}
export function useGlobalShortcuts({ onExport, onHelp }: { onExport: () => void; onHelp: () => void }): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (mod && !e.altKey) {
        if (key === 'z') {
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
        } else if (key === 'y' && e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          redo()
        } else if (key === 's') {
          e.preventDefault()
          useNoticeStore.getState().show('info', t().notices.saveReminder)
        } else if (key === 'e') {
          e.preventDefault()
          onExport()
        } else if (key === 'd' && !e.shiftKey && !isEditable(e.target)) {
          e.preventDefault()
          duplicate()
        } else if (key === 'n' && !e.shiftKey && !isEditable(e.target)) {
          e.preventDefault()
          newBoardAfterActive()
        }
      } else if (e.altKey && !mod && !e.shiftKey && e.code === 'KeyN' && !isEditable(e.target)) {
        // e.code: with Alt, e.key gives a special character ("~" on a Mac).
        e.preventDefault()
        newBoardAfterActive()
      } else if (e.key === '?' && !isEditable(e.target)) {
        e.preventDefault()
        onHelp()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onExport, onHelp])
}
