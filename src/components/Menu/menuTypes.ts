import type { IconName } from '../Icon/icons'

/** A menu action ("…" menu, context menu or actions bar). */
export interface MenuAction {
  label: string
  icon: IconName
  onSelect: () => void
  /** Keyboard shortcut shown on the right (e.g. "⌘D"). */
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  /** Tooltip: details on the action, or why it is unavailable. */
  title?: string
}

export type MenuEntry = MenuAction | 'separator'
