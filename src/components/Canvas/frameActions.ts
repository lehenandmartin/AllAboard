import { t } from '../../i18n'
import { startCrop } from '../../store/cropStore'
import { useProjectStore } from '../../store/projectStore'
import { chooseImageForFrame } from '../Import/importImages'
import type { MenuEntry } from '../Menu/menuTypes'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = IS_MAC ? '⌘' : 'Ctrl+'

/** Actions on the selected frames of the active board: the same in the actions bar and on right-click. */
export function frameActions(selected: readonly string[]): MenuEntry[] {
  const store = useProjectStore.getState()
  const { frameActions: texts } = t()
  const board = store.project.boards.find((b) => b.id === store.activeBoardId)
  if (!board || selected.length === 0) return []
  const first = selected[0]!
  const last = selected[selected.length - 1]!
  const single = selected.length === 1 ? board.frames.find((f) => f.id === first) : undefined

  return [
    { label: texts.emptyBefore, icon: 'add-square', onSelect: () => store.insertEmptyFrame(first, 'before') },
    { label: texts.emptyAfter, icon: 'add-square', onSelect: () => store.insertEmptyFrame(last, 'after') },
    {
      label: texts.duplicate,
      icon: 'copy',
      shortcut: `${MOD}D`,
      onSelect: () => store.duplicateFrames(selected),
    },
    ...(single
      ? [
          {
            label: single.imageId ? texts.replaceImage : texts.addImage,
            icon: 'image',
            onSelect: () => void chooseImageForFrame(single.id),
          } satisfies MenuEntry,
        ]
      : []),
    ...(single?.imageId
      ? [
          {
            label: texts.crop,
            icon: 'crop',
            shortcut: texts.doubleClick,
            onSelect: () => startCrop(single.id),
          } satisfies MenuEntry,
        ]
      : []),
    ...(selected.some((id) => board.frames.find((f) => f.id === id)?.crop)
      ? [
          {
            label: texts.resetCrop,
            icon: 'arrow-reset',
            onSelect: () => {
              for (const id of selected) store.setFrameCrop(id, null)
            },
          } satisfies MenuEntry,
        ]
      : []),
    'separator',
    {
      label: texts.delete,
      icon: 'delete',
      shortcut: texts.deleteKey,
      danger: true,
      onSelect: () => store.deleteFrames(selected),
    },
  ]
}
