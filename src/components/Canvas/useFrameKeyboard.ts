import { useEffect } from 'react'
import { useProjectStore } from '../../store/projectStore'

const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/**
 * Frame shortcuts: Del to delete, arrows to move (up/down: by a row), Esc to
 * deselect, Cmd/Ctrl+A to select all.
 */
export function useFrameKeyboard(columns: number) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return
      const store = useProjectStore.getState()
      const selected = store.selectedFrameIds

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        store.selectAllFrames()
        return
      }
      if (selected.length === 0) return

      const step = Math.max(1, columns)
      const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -step, ArrowDown: step }
      if (e.key in deltas && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        store.shiftFrames(selected, deltas[e.key]!)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        store.deleteFrames(selected)
      } else if (e.key === 'Escape') {
        store.clearSelection()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [columns])
}
