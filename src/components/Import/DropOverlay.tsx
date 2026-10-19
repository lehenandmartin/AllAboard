import { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import { useDndStore } from '../../store/dndStore'
import { useActiveBoard } from '../../store/projectStore'
import { PROJECT_FILE_EXTENSION } from '../../storage/projectFile'
import { openProjectFile } from '../../storage/projectActions'
import { useUiStore } from '../../store/uiStore'
import { candidatesFromDataTransfer } from './dataTransfer'
import { importIntoActiveBoard, replaceFrameImage } from './importImages'
import './Import.css'

const carriesFiles = (e: DragEvent): boolean => e.dataTransfer?.types.includes('Files') ?? false

/** Preview frame under the pointer, if any. */
function frameIdAt(x: number, y: number): string | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const id =
      el instanceof HTMLElement ? el.closest<HTMLElement>('[data-frame-id]')?.dataset.frameId : undefined
    if (id) return id
  }
  return null
}

/**
 * Is a single file being dragged? While hovering, some browsers (Safari) do
 * not give the list: the answer is then "no", and the decision is made on
 * drop, when the files are known.
 */
const singleFileDragged = (dataTransfer: DataTransfer): boolean =>
  [...dataTransfer.items].filter((item) => item.kind === 'file').length === 1

/** A single dropped file, and not a folder. */
function singleDroppedFile(dataTransfer: DataTransfer): File | null {
  const items = [...dataTransfer.items].filter((item) => item.kind === 'file')
  if (dataTransfer.files.length !== 1 || items.length > 1) return null
  if (items[0]?.webkitGetAsEntry()?.isDirectory) return null
  return dataTransfer.files[0] ?? null
}

const setFileDropFrame = (frameId: string | null) => {
  if (useDndStore.getState().fileDropFrameId !== frameId) useDndStore.setState({ fileDropFrameId: frameId })
}

/**
 * Accepts files or a folder dragged anywhere in the window. A single image
 * dropped onto a preview frame replaces its image.
 */
export function DropOverlay() {
  const { importing } = useT()
  const [active, setActive] = useState(false)
  const replacing = useDndStore((s) => s.fileDropFrameId !== null)
  const board = useActiveBoard()
  const splitImport = useUiStore((s) => s.splitImport)
  const splitSize = useUiStore((s) => s.splitSize)

  useEffect(() => {
    // dragenter/dragleave fire for every hovered element: count them.
    let depth = 0

    const onDragEnter = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      depth++
      setActive(true)
    }
    const onDragOver = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      e.preventDefault()
      if (!e.dataTransfer) return
      e.dataTransfer.dropEffect = 'copy'
      setFileDropFrame(singleFileDragged(e.dataTransfer) ? frameIdAt(e.clientX, e.clientY) : null)
    }
    const onDragLeave = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) {
        setActive(false)
        setFileDropFrame(null)
      }
    }
    const onDrop = (e: DragEvent) => {
      if (!carriesFiles(e) || !e.dataTransfer) return
      e.preventDefault()
      depth = 0
      setActive(false)
      setFileDropFrame(null)
      // A dragged project file opens; a single image dropped onto a frame
      // replaces its image; otherwise the images are imported at the end of the board.
      const projectFile = [...e.dataTransfer.files].find((f) =>
        f.name.toLowerCase().endsWith(PROJECT_FILE_EXTENSION),
      )
      const single = singleDroppedFile(e.dataTransfer)
      const frameId = single ? frameIdAt(e.clientX, e.clientY) : null
      if (projectFile) void openProjectFile(projectFile)
      else if (single && frameId) void replaceFrameImage(frameId, single)
      else void candidatesFromDataTransfer(e.dataTransfer).then(importIntoActiveBoard)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  // When replacing, only the target frame is highlighted.
  if (!active || replacing) return null
  return (
    <div className="drop-overlay" aria-hidden="true">
      <div className="drop-overlay__panel">
        <strong>{importing.dropTitle}</strong>
        <span>{splitImport ? importing.dropSpread(splitSize, board.name) : importing.dropAppend(board.name)}</span>
      </div>
    </div>
  )
}
