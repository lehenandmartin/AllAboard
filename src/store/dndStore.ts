import { create } from 'zustand'
import type { Side } from '../core/frames'

/** Prefix of the boards' drag-and-drop ids (frames use their own id). */
export const BOARD_DND_PREFIX = 'board:'
export const boardDndId = (boardId: string): string => BOARD_DND_PREFIX + boardId
export const isBoardDndId = (id: string): boolean => id.startsWith(BOARD_DND_PREFIX)
export const boardIdFromDnd = (id: string): string => id.slice(BOARD_DND_PREFIX.length)

export type DropTarget =
  /** Target frame: insertion before/after, or swap (Alt). */
  | { kind: 'frame'; targetId: string; mode: Side | 'swap' }
  /** Sidebar board targeted by frames: they will be moved there. */
  | { kind: 'board'; boardId: string }
  /** Board targeted by another board: reordering. */
  | { kind: 'boardOrder'; boardId: string; side: Side }

interface DndStore {
  /** Dragged item: a frame or a board. */
  active: { kind: 'frame'; id: string } | { kind: 'board'; id: string } | null
  /** Moved frames (the whole selection if the dragged frame is part of it). */
  draggedFrameIds: string[]
  dropTarget: DropTarget | null
  /** Frame hovered by a file from the computer (it will replace its image). */
  fileDropFrameId: string | null
}

/** State of the current drag and drop, shared by the preview and the sidebar. */
export const useDndStore = create<DndStore>()(() => ({
  active: null,
  draggedFrameIds: [],
  dropTarget: null,
  fileDropFrameId: null,
}))

export const sameTarget = (a: DropTarget | null, b: DropTarget | null): boolean =>
  JSON.stringify(a) === JSON.stringify(b)
