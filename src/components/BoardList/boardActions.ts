import type { Board } from '../../core/types'
import { t } from '../../i18n'
import { useProjectStore } from '../../store/projectStore'
import { replaceAllImagesInBoard } from '../Import/importImages'
import type { MenuEntry } from '../Menu/menuTypes'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = IS_MAC ? '⌘' : 'Ctrl+'
const ALT = IS_MAC ? '⌥' : 'Alt+'

/**
 * Actions on a board: the same in the "…" menu and on right-click.
 * `startRename` puts the board name into editing in the list.
 */
export function boardActions(board: Board, canDelete: boolean, startRename: () => void): MenuEntry[] {
  const store = useProjectStore.getState()
  const { boardActions: texts } = t()
  return [
    { label: texts.rename, icon: 'rename', onSelect: startRename },
    { label: texts.duplicate, icon: 'copy', shortcut: `${MOD}D`, onSelect: () => store.duplicateBoard(board.id) },
    {
      label: texts.newAfter,
      icon: 'slide-add',
      shortcut: `${ALT}N`,
      onSelect: () => store.addBoard(board.id),
    },
    {
      label: texts.replaceAll,
      icon: 'image',
      title: texts.replaceAllTitle,
      onSelect: () => void replaceAllImagesInBoard(board.id),
    },
    'separator',
    {
      label: texts.delete,
      icon: 'delete',
      danger: true,
      disabled: !canDelete,
      title: canDelete ? undefined : texts.keepOne,
      onSelect: () => deleteBoardsWithConfirm([board.id]),
    },
  ]
}

/** Actions on several selected boards (Shift or Cmd/Ctrl + click). */
export function boardSelectionActions(ids: readonly string[]): MenuEntry[] {
  const store = useProjectStore.getState()
  const { boardActions: texts, frameActions } = t()
  const all = ids.length >= store.project.boards.length
  return [
    {
      label: texts.duplicateMany(ids.length),
      icon: 'copy',
      shortcut: `${MOD}D`,
      onSelect: () => store.duplicateBoards(ids),
    },
    'separator',
    {
      label: texts.deleteMany(ids.length),
      icon: 'delete',
      shortcut: frameActions.deleteKey,
      danger: true,
      disabled: all,
      title: all ? texts.keepOne : undefined,
      onSelect: () => deleteBoardsWithConfirm(ids),
    },
  ]
}

/** Deletes boards, after confirmation if they contain frames (undoable with Cmd/Ctrl+Z). */
export function deleteBoardsWithConfirm(ids: readonly string[]) {
  const store = useProjectStore.getState()
  const { boardActions: texts } = t()
  const set = new Set(ids)
  const boards = store.project.boards.filter((b) => set.has(b.id))
  if (boards.length === 0 || boards.length >= store.project.boards.length) return
  const frames = boards.reduce((n, b) => n + b.frames.length, 0)
  const question =
    boards.length === 1
      ? texts.confirmDeleteOne(boards[0]!.name, frames)
      : texts.confirmDeleteMany(boards.length, frames)
  if (frames > 0 && !window.confirm(question)) return
  store.deleteBoards(boards.map((b) => b.id))
}
