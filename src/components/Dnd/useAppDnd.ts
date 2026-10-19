import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type {
  CollisionDetection,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  Modifier,
  UniqueIdentifier,
} from '@dnd-kit/core'
import { useEffect, useRef } from 'react'
import type { DropTarget } from '../../store/dndStore'
import { boardIdFromDnd, isBoardDndId, sameTarget, useDndStore } from '../../store/dndStore'
import { useProjectStore } from '../../store/projectStore'

/** Maximum distance (px) between the pointer and a target to aim at it. */
const MAX_TARGET_DISTANCE = 80

/**
 * Target closest to the pointer, even over a gutter. A dragged board only
 * targets other boards; a frame targets frames or boards.
 */
export const closestToPointer: CollisionDetection = ({
  active,
  droppableContainers,
  droppableRects,
  pointerCoordinates,
}) => {
  if (!pointerCoordinates) return []
  const { x, y } = pointerCoordinates
  const draggingBoard = isBoardDndId(String(active.id))
  let best: { id: UniqueIdentifier; distance: number; container: (typeof droppableContainers)[number] } | null = null
  for (const container of droppableContainers) {
    if (draggingBoard && !isBoardDndId(String(container.id))) continue
    const r = droppableRects.get(container.id)
    if (!r) continue
    const dx = Math.max(r.left - x, 0, x - r.right)
    const dy = Math.max(r.top - y, 0, y - r.bottom)
    const distance = Math.hypot(dx, dy)
    if (!best || distance < best.distance) best = { id: container.id, distance, container }
  }
  if (!best || best.distance > MAX_TARGET_DISTANCE) return []
  return [{ id: best.id, data: { droppableContainer: best.container, value: best.distance } }]
}

const pointerOf = (event: Event | null): { x: number; y: number } | null =>
  event && 'clientX' in event ? { x: (event as PointerEvent).clientX, y: (event as PointerEvent).clientY } : null

/** Centers the dragged preview under the pointer. */
export const centerOnPointer: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  const p = pointerOf(activatorEvent)
  if (!p || !draggingNodeRect) return transform
  return {
    ...transform,
    x: transform.x + p.x - draggingNodeRect.left - draggingNodeRect.width / 2,
    y: transform.y + p.y - draggingNodeRect.top - draggingNodeRect.height / 2,
  }
}

/**
 * The app's drag and drop:
 * - a frame onto a frame: insertion before/after (hovered half), or swap with Alt;
 * - a frame onto a sidebar board: move to the end of that board;
 * - a board onto a board: reordering.
 * A selected frame takes the whole selection along.
 */
export function useAppDnd() {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const active = useDndStore((s) => s.active)
  const altRef = useRef(false)
  const lastMoveRef = useRef<DragMoveEvent | null>(null)

  const computeTarget = (event: DragMoveEvent): DropTarget | null => {
    const { active: dragged, over, activatorEvent, delta } = event
    if (!over) return null
    const activeId = String(dragged.id)
    const overId = String(over.id)
    const start = pointerOf(activatorEvent)
    if (!start) return null
    const pointer = { x: start.x + delta.x, y: start.y + delta.y }

    if (isBoardDndId(activeId)) {
      if (!isBoardDndId(overId) || overId === activeId) return null
      const side = pointer.y < over.rect.top + over.rect.height / 2 ? 'before' : 'after'
      return { kind: 'boardOrder', boardId: boardIdFromDnd(overId), side }
    }

    if (isBoardDndId(overId)) {
      const boardId = boardIdFromDnd(overId)
      return boardId === useProjectStore.getState().activeBoardId ? null : { kind: 'board', boardId }
    }

    const framesDragged = useDndStore.getState().draggedFrameIds
    if (framesDragged.includes(overId)) return null
    if (altRef.current && framesDragged.length === 1) return { kind: 'frame', targetId: overId, mode: 'swap' }
    const side = pointer.x < over.rect.left + over.rect.width / 2 ? 'before' : 'after'
    return { kind: 'frame', targetId: overId, mode: side }
  }

  const updateTarget = (event: DragMoveEvent) => {
    lastMoveRef.current = event
    const next = computeTarget(event)
    if (!sameTarget(useDndStore.getState().dropTarget, next)) useDndStore.setState({ dropTarget: next })
  }

  // Alt can be pressed or released during the drag, without moving the mouse.
  useEffect(() => {
    if (active?.kind !== 'frame') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Alt') return
      altRef.current = e.type === 'keydown'
      if (lastMoveRef.current) updateTarget(lastMoveRef.current)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
    // updateTarget only depends on refs and stores.
  }, [active])

  const reset = () => {
    useDndStore.setState({ active: null, draggedFrameIds: [], dropTarget: null })
    lastMoveRef.current = null
  }

  const onDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    if (isBoardDndId(id)) {
      useDndStore.setState({ active: { kind: 'board', id: boardIdFromDnd(id) }, draggedFrameIds: [] })
      return
    }
    const store = useProjectStore.getState()
    let ids = store.selectedFrameIds
    if (!ids.includes(id)) {
      store.selectFrame(id, 'single')
      ids = [id]
    }
    altRef.current = (event.activatorEvent as PointerEvent).altKey ?? false
    useDndStore.setState({ active: { kind: 'frame', id }, draggedFrameIds: ids })
  }

  const onDragEnd = (event: DragEndEvent) => {
    const target = computeTarget(event)
    const { active: dragged, draggedFrameIds } = useDndStore.getState()
    reset()
    if (!target || !dragged) return
    const store = useProjectStore.getState()
    if (target.kind === 'boardOrder' && dragged.kind === 'board') {
      store.moveBoard(dragged.id, target.boardId, target.side)
    } else if (target.kind === 'board') {
      store.moveFramesToBoard(draggedFrameIds, target.boardId)
    } else if (target.kind === 'frame') {
      if (target.mode === 'swap') store.swapFrames(draggedFrameIds[0]!, target.targetId)
      else store.moveFrames(draggedFrameIds, target.targetId, target.mode)
    }
  }

  return {
    sensors,
    handlers: { onDragStart, onDragMove: updateTarget, onDragOver: updateTarget, onDragEnd, onDragCancel: reset },
  }
}
