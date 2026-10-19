import { create } from 'zustand'
import type { MenuEntry } from '../components/Menu/menuTypes'

interface ContextMenu {
  /** Pointer position (px, window coordinates). */
  x: number
  y: number
  /** Menu name for screen readers (e.g. "Actions on Board 1"). */
  label: string
  entries: MenuEntry[]
}

interface ContextMenuStore {
  menu: ContextMenu | null
  open: (menu: ContextMenu) => void
  close: () => void
}

/** Open context menu (right-click), shown by ContextMenuHost. */
export const useContextMenuStore = create<ContextMenuStore>()((set) => ({
  menu: null,
  open: (menu) => set({ menu }),
  close: () => set({ menu: null }),
}))

/**
 * Opens a context menu at the pointer, or under the element if the menu was
 * requested from the keyboard (Menu key, Shift+F10: the event has no position).
 */
export function openContextMenuAt(
  event: { clientX: number; clientY: number; currentTarget: Element },
  label: string,
  entries: MenuEntry[],
) {
  let { clientX: x, clientY: y } = event
  if (x === 0 && y === 0) {
    const rect = event.currentTarget.getBoundingClientRect()
    x = rect.left + 8
    y = rect.bottom - 8
  }
  useContextMenuStore.getState().open({ x, y, label, entries })
}
