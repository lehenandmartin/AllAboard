import { DndContext, DragOverlay } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import { computeBoardLayout } from '../../core/boardLayout'
import { useT } from '../../i18n'
import { useDndStore } from '../../store/dndStore'
import { useProjectStore } from '../../store/projectStore'
import { BoardThumbnail } from '../BoardList/BoardThumbnail'
import { DragPreview } from '../Frame/DragPreview'
import { centerOnPointer, closestToPointer, useAppDnd } from './useAppDnd'

/** Maximum size (px) of the dragged preview. */
const PREVIEW_SIZE = 140

type Over = { over: { id: string | number } | null }

function DragOverlayContent() {
  const active = useDndStore((s) => s.active)
  const count = useDndStore((s) => s.draggedFrameIds.length)
  const project = useProjectStore((s) => s.project)
  const activeBoardId = useProjectStore((s) => s.activeBoardId)

  if (active?.kind === 'board') {
    const board = project.boards.find((b) => b.id === active.id)
    return board ? (
      <div className="drag-preview drag-preview--board">
        <BoardThumbnail board={board} width={PREVIEW_SIZE} />
      </div>
    ) : null
  }
  if (active?.kind === 'frame') {
    const board = project.boards.find((b) => b.id === activeBoardId)
    const frame = board?.frames.find((f) => f.id === active.id)
    if (!board || !frame) return null
    const { frameAspect } = computeBoardLayout(project, board)
    const width = frameAspect >= 1 ? PREVIEW_SIZE : PREVIEW_SIZE * frameAspect
    return (
      <DragPreview
        image={frame.imageId ? (project.images[frame.imageId] ?? null) : null}
        count={count}
        width={width}
        height={width / frameAspect}
      />
    )
  }
  return null
}

/** Drag-and-drop context shared by the preview and the boards sidebar. */
export function DndRoot({ children }: { children: ReactNode }) {
  const { dnd } = useT()
  const { sensors, handlers } = useAppDnd()
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestToPointer}
      autoScroll={false}
      accessibility={{
        announcements: {
          onDragStart: () => dnd.started,
          onDragOver: ({ over }: Over) => (over ? dnd.over : dnd.notOver),
          onDragEnd: ({ over }: Over) => (over ? dnd.dropped : dnd.cancelled),
          onDragCancel: () => dnd.cancelled,
        },
        screenReaderInstructions: { draggable: dnd.instructions },
      }}
      {...handlers}
    >
      {children}
      <DragOverlay dropAnimation={null} modifiers={[centerOnPointer]}>
        <DragOverlayContent />
      </DragOverlay>
    </DndContext>
  )
}
