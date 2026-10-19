import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useT } from '../../i18n'
import { boardSelection, useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { NumberInput, Toggle } from '../SettingsPanel/fields'
import { Icon } from '../Icon/Icon'
import { deleteBoardsWithConfirm } from './boardActions'
import { BoardItem } from './BoardItem'
import './BoardList.css'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/**
 * Del on the selected boards: when the focus is in the list, or when several
 * boards are selected (and no frame: Del then targets the frames).
 */
function useBoardKeyboard(listRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (isEditable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      const store = useProjectStore.getState()
      if (store.selectedFrameIds.length > 0) return
      const inList = listRef.current?.contains(document.activeElement) ?? false
      if (!inList && store.selectedBoardIds.length < 2) return
      e.preventDefault()
      deleteBoardsWithConfirm(boardSelection(store))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [listRef])
}

/** Left sidebar: the list of boards, and the import options. */
export function BoardList() {
  const { boardList } = useT()
  const boards = useProjectStore((s) => s.project.boards)
  const activeBoardId = useProjectStore((s) => s.activeBoardId)
  const selectedBoardIds = useProjectStore((s) => s.selectedBoardIds)
  const listRef = useRef<HTMLOListElement>(null)
  useBoardKeyboard(listRef)
  const addBoard = useProjectStore((s) => s.addBoard)
  const { splitImport, splitSize, setSplitImport, setSplitSize } = useUiStore()

  return (
    <aside className="board-list" aria-label={boardList.label}>
      <header className="board-list__header">
        <h2>{boardList.label}</h2>
        <button
          type="button"
          className="button button--ghost button--icon board-list__add"
          onClick={() => addBoard(null)}
          title={boardList.addTitle(IS_MAC ? '⌥N' : 'Alt+N')}
          aria-label={boardList.add}
        >
          <Icon name="slide-add" />
        </button>
      </header>
      <ol className="board-list__items" ref={listRef} aria-multiselectable="true">
        {boards.map((board, i) => (
          <BoardItem
            key={board.id}
            board={board}
            index={i}
            active={board.id === activeBoardId}
            selected={selectedBoardIds.includes(board.id)}
            canDelete={boards.length > 1}
          />
        ))}
      </ol>
      <footer className="board-list__footer">
        <div className="board-list__option">
          <Toggle
            label={boardList.splitImport}
            checked={splitImport}
            onChange={setSplitImport}
          />
          <span aria-hidden="true">{boardList.splitImportShort}</span>
        </div>
        {splitImport && (
          <label className="board-list__option board-list__option--sub">
            <span>{boardList.splitBy}</span>
            <NumberInput
              value={splitSize}
              onChange={(v) => v !== null && setSplitSize(v)}
              min={1}
              max={60}
              integer
              ariaLabel={boardList.splitCount}
            />
            <span>{boardList.splitImages}</span>
          </label>
        )}
      </footer>
    </aside>
  )
}
