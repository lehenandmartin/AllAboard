import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useCallback, useMemo, useRef, useState } from 'react'
import { computeBoardLayout } from '../../core/boardLayout'
import { useDismiss } from '../../hooks/useDismiss'
import type { Board } from '../../core/types'
import type { Messages } from '../../i18n'
import { t, useT } from '../../i18n'
import { openContextMenuAt } from '../../store/contextMenuStore'
import { boardDndId, useDndStore } from '../../store/dndStore'
import { boardSelection, useProjectStore } from '../../store/projectStore'
import { Icon } from '../Icon/Icon'
import { MenuItems } from '../Menu/MenuItems'
import { boardActions, boardSelectionActions } from './boardActions'
import { BoardThumbnail } from './BoardThumbnail'

const THUMB_WIDTH = 176

/** Approximate height of the actions menu, in px. */
const MENU_HEIGHT = 220

function countLabel(board: Board, texts: Messages['boardList']): string {
  const images = board.frames.filter((f) => f.imageId).length
  const empty = board.frames.length - images
  if (board.frames.length === 0) return texts.empty
  const parts = [texts.images(images)]
  if (empty > 0) parts.push(texts.emptyFrames(empty))
  return parts.join(' · ')
}

/** Actions of a board's menu: the selection's if it is part of it along with others. */
function menuEntries(board: Board, canDelete: boolean, onRename: () => void) {
  const { boardList } = t()
  const selection = boardSelection(useProjectStore.getState())
  return selection.length > 1 && selection.includes(board.id)
    ? { label: boardList.selectedCount(selection.length), entries: boardSelectionActions(selection) }
    : { label: boardList.actionsOn(board.name), entries: boardActions(board, canDelete, onRename) }
}

function BoardMenu({
  board,
  canDelete,
  onRename,
}: {
  board: Board
  canDelete: boolean
  onRename: () => void
}) {
  const { boardList } = useT()
  const [open, setOpen] = useState(false)
  // Opens upward when there is no room below the button (bottom of the list).
  const [upward, setUpward] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, ref, close)

  return (
    <div
      className="board-menu"
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="button button--ghost button--icon board-menu__button"
        aria-label={boardList.actionsOn(board.name)}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          const button = e.currentTarget.getBoundingClientRect()
          const list = e.currentTarget.closest('.board-list__items')?.getBoundingClientRect()
          setUpward(button.bottom + MENU_HEIGHT > (list?.bottom ?? window.innerHeight))
          setOpen((o) => !o)
        }}
      >
        <Icon name="more-horizontal" />
      </button>
      {open && (
        <div
          className={`menu-panel menu-panel--right board-menu__list${upward ? ' board-menu__list--up' : ''}`}
          role="menu"
        >
          <MenuItems entries={menuEntries(board, canDelete, onRename).entries} onDone={close} />
        </div>
      )}
    </div>
  )
}

/** A sidebar board: thumbnail, editable name, menu; draggable and a drop target. */
export function BoardItem({
  board,
  index,
  active,
  selected,
  canDelete,
}: {
  board: Board
  index: number
  active: boolean
  /** Part of a selection of several boards (Shift or Cmd/Ctrl + click), active board included. */
  selected: boolean
  canDelete: boolean
}) {
  const { boardList } = useT()
  const dndId = boardDndId(board.id)
  const draggable = useDraggable({ id: dndId })
  const droppable = useDroppable({ id: dndId })
  const dropTarget = useDndStore((s) =>
    s.dropTarget && 'boardId' in s.dropTarget && s.dropTarget.boardId === board.id ? s.dropTarget : null,
  )
  const dragging = useDndStore((s) => s.active?.kind === 'board' && s.active.id === board.id)
  const setActiveBoard = useProjectStore((s) => s.setActiveBoard)
  const selectBoard = useProjectStore((s) => s.selectBoard)
  const renameBoard = useProjectStore((s) => s.renameBoard)
  const [editing, setEditing] = useState(false)
  const project = useProjectStore((s) => s.project)
  const overflow = useMemo(() => computeBoardLayout(project, board).layout.overflow, [project, board])

  const className = [
    'board-item',
    active && 'board-item--active',
    selected && 'board-item--selected',
    dragging && 'board-item--dragging',
    dropTarget?.kind === 'board' && 'board-item--drop',
    dropTarget?.kind === 'boardOrder' && `board-item--insert-${dropTarget.side}`,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li
      ref={(el) => {
        draggable.setNodeRef(el)
        droppable.setNodeRef(el)
      }}
      className={className}
      {...draggable.attributes}
      {...draggable.listeners}
      aria-current={active ? 'true' : undefined}
      aria-selected={selected || active}
      aria-label={`${board.name}, ${countLabel(board, boardList)}`}
      onClick={(e) => selectBoard(board.id, e.shiftKey ? 'range' : e.metaKey || e.ctrlKey ? 'toggle' : 'single')}
      onContextMenu={(e) => {
        // As in PowerPoint's slide pane: right-click also activates the board, unless
        // it is part of a selection of several boards (the menu then targets the selection).
        e.preventDefault()
        if (!boardSelection(useProjectStore.getState()).includes(board.id)) setActiveBoard(board.id)
        const menu = menuEntries(board, canDelete, () => setEditing(true))
        openContextMenuAt(e, menu.label, menu.entries)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !editing) setActiveBoard(board.id)
      }}
    >
      <span className="board-item__index" aria-hidden="true">
        {index + 1}
      </span>
      <div className="board-item__thumb">
        <BoardThumbnail board={board} width={THUMB_WIDTH} />
        {dropTarget?.kind === 'board' && <span className="board-item__drop-label">{boardList.moveHere}</span>}
      </div>
      <div className="board-item__meta">
        {editing ? (
          <input
            className="board-item__rename"
            defaultValue={board.name}
            aria-label={boardList.rename}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                e.currentTarget.value = board.name
                e.currentTarget.blur()
              }
            }}
            onBlur={(e) => {
              renameBoard(board.id, e.currentTarget.value)
              setEditing(false)
            }}
          />
        ) : (
          <span
            className="board-item__name"
            title={boardList.renameHint}
            onDoubleClick={(e) => {
              e.stopPropagation()
              setEditing(true)
            }}
          >
            {board.name}
          </span>
        )}
        <span className="board-item__count">
          {countLabel(board, boardList)}
          {overflow > 0 && (
            <span className="board-item__overflow" title={boardList.outsideGridTitle}>
              {' · '}
              {boardList.outsideGrid(overflow)}
            </span>
          )}
        </span>
      </div>
      <BoardMenu board={board} canDelete={canDelete} onRename={() => setEditing(true)} />
    </li>
  )
}
