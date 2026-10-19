import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { MouseEvent } from 'react'
import type { Rect } from '../../core/layout'
import { useT } from '../../i18n'
import { useDndStore } from '../../store/dndStore'
import { place } from '../Canvas/place'
import './Frame.css'

interface FrameHandleProps {
  frameId: string
  label: string
  /** The frame holds an image (otherwise it is empty). */
  hasImage: boolean
  rect: Rect
  scale: number
  selected: boolean
  /** The frame is among the frames being moved. */
  dimmed: boolean
  /** The frame is the target of a swap (Alt + drag). */
  swapTarget: boolean
  onSelect: (frameId: string, mode: 'single' | 'toggle' | 'range') => void
  onOpen: (frameId: string) => void
  /** Right-click (or Menu key): context menu of the frame actions. */
  onContextMenu: (frameId: string, event: MouseEvent<HTMLElement>) => void
}

/**
 * Interactive area over a frame: selection, double-click, and drag and drop
 * (the frame is both draggable and a target).
 */
export function FrameHandle({
  frameId,
  label,
  hasImage,
  rect,
  scale,
  selected,
  dimmed,
  swapTarget,
  onSelect,
  onOpen,
  onContextMenu,
}: FrameHandleProps) {
  const { canvas } = useT()
  const draggable = useDraggable({ id: frameId })
  const droppable = useDroppable({ id: frameId })
  const fileTarget = useDndStore((s) => s.fileDropFrameId === frameId)

  const onClick = (e: MouseEvent) => {
    e.stopPropagation()
    onSelect(frameId, e.shiftKey ? 'range' : e.metaKey || e.ctrlKey ? 'toggle' : 'single')
  }

  const className = [
    'frame-handle',
    selected && 'frame-handle--selected',
    dimmed && 'frame-handle--dimmed',
    swapTarget && 'frame-handle--swap-target',
    fileTarget && 'frame-handle--file-target',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={(el) => {
        draggable.setNodeRef(el)
        droppable.setNodeRef(el)
      }}
      className={className}
      style={place(rect, scale)}
      data-frame-id={frameId}
      {...draggable.attributes}
      {...draggable.listeners}
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onOpen(frameId)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onContextMenu(frameId, e)
      }}
    >
      {fileTarget && (
        <span className="frame-handle__drop-label">{hasImage ? canvas.replaceImage : canvas.addImage}</span>
      )}
    </div>
  )
}
