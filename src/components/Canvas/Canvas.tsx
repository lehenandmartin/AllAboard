import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { computeBoardLayout } from '../../core/boardLayout'
import { formatDecimal, hexToRgba } from '../../core/format'
import { placeImage } from '../../core/crop'
import {
  LINE_HEIGHT,
  NUMBER_BADGE,
  badgeFontSize,
  formatNumber,
  numberBadgeRect,
  titleFontSize,
} from '../../core/text'
import { inToCm, ptToIn } from '../../core/units'
import { t, useT } from '../../i18n'
import { useElementSize } from '../../hooks/useElementSize'
import { continuationName } from '../../core/boards'
import { PROJECT_FILE_EXTENSION } from '../../storage/projectFile'
import { openProjectFile } from '../../storage/projectActions'
import { openContextMenuAt } from '../../store/contextMenuStore'
import { startCrop, stopCrop, useCropStore } from '../../store/cropStore'
import { useDndStore } from '../../store/dndStore'
import { useActiveBoard, useProjectStore } from '../../store/projectStore'
import { FrameHandle } from '../Frame/FrameHandle'
import { FrameView } from '../Frame/FrameView'
import { Icon } from '../Icon/Icon'
import { ImportButton } from '../Import/ImportButton'
import { chooseImageForFrame } from '../Import/importImages'
import { pickFiles } from '../Import/pickFiles'
import { CropEditor } from './CropEditor'
import { EditableText } from './EditableText'
import { frameActions } from './frameActions'
import { SelectionBar } from './SelectionBar'
import { place } from './place'
import { useFrameKeyboard } from './useFrameKeyboard'
import './Canvas.css'

async function openProjectFromDisk() {
  const [file] = await pickFiles(`${PROJECT_FILE_EXTENSION},application/zip`, false)
  if (file) await openProjectFile(file)
}

/** Space around the slide in the central area, in px. */
const CANVAS_PADDING = 40

/** Width of the insertion line, in px. */
const INSERT_MARKER_WIDTH = 3

export function Canvas() {
  const texts = useT()
  const { canvas } = texts
  const project = useProjectStore((s) => s.project)
  const board = useActiveBoard()
  const { settings, layout } = useMemo(() => computeBoardLayout(project, board), [project, board])
  const [containerRef, size] = useElementSize<HTMLDivElement>()

  const { slide } = project
  const scale = size
    ? Math.max(
        0,
        Math.min(
          (size.width - 2 * CANVAS_PADDING) / slide.width,
          (size.height - 2 * CANVAS_PADDING) / slide.height,
        ),
      )
    : 0

  const { textStyle, numbering, textMode } = settings
  const selectedIds = useProjectStore((s) => s.selectedFrameIds)
  const selectFrame = useProjectStore((s) => s.selectFrame)
  const clearSelection = useProjectStore((s) => s.clearSelection)
  const insertEmptyFrame = useProjectStore((s) => s.insertEmptyFrame)
  const setBoardTitle = useProjectStore((s) => s.setBoardTitle)
  const setFrameText = useProjectStore((s) => s.setFrameText)
  const setRowText = useProjectStore((s) => s.setRowText)
  // New project: a single, empty board.
  const isNewProject = useProjectStore(
    (s) => s.project.boards.length === 1 && s.project.boards[0]!.frames.length === 0,
  )
  const dropTarget = useDndStore((s) => (s.dropTarget?.kind === 'frame' ? s.dropTarget : null))
  const draggedIds = useDndStore((s) => s.draggedFrameIds)
  const createOverflowBoards = useProjectStore((s) => s.createOverflowBoards)
  const boardNames = useProjectStore((s) => s.project.boards.map((b) => b.name).join('\n'))
  useFrameKeyboard(layout.columns)

  // Cropping in progress: the frame must be in the active board and have an image.
  const cropId = useCropStore((s) => s.frameId)
  const cropIndex = cropId ? board.frames.findIndex((f) => f.id === cropId) : -1
  const cropFrame = cropIndex >= 0 ? board.frames[cropIndex] : undefined
  const cropImage = cropFrame?.imageId ? project.images[cropFrame.imageId] : undefined
  const cropRect = cropIndex >= 0 ? layout.frames[cropIndex] : undefined
  const cropping = !!(cropFrame && cropImage && cropRect && cropRect.w > 0)
  useEffect(() => {
    if (cropId && !cropping) stopCrop()
  }, [cropId, cropping])
  const [cropBar, setCropBar] = useState<HTMLDivElement | null>(null)

  // Right-click on a frame: it joins the selection if it is not part of it,
  // then the menu offers the same actions as the actions bar.
  const openFrameMenu = (frameId: string, event: MouseEvent<HTMLElement>) => {
    const store = useProjectStore.getState()
    if (!store.selectedFrameIds.includes(frameId)) store.selectFrame(frameId, 'single')
    const ids = useProjectStore.getState().selectedFrameIds
    const label = t().selection.actionsOn(ids.length)
    openContextMenuAt(event, label, frameActions(ids))
  }

  const selected = new Set(selectedIds)
  const dragged = new Set(draggedIds)

  // Insertion line, in the middle of the gutter before or after the target frame.
  const insertMarker = (() => {
    if (!dropTarget || dropTarget.mode === 'swap') return null
    const index = board.frames.findIndex((f) => f.id === dropTarget.targetId)
    const rect = layout.frames[index]
    if (!rect) return null
    const gap = settings.gutterH / 2
    const x = dropTarget.mode === 'before' ? rect.x - gap : rect.x + rect.w + gap
    return { left: x * scale - INSERT_MARKER_WIDTH / 2, top: rect.y * scale, height: rect.h * scale }
  })()

  return (
    <div className="canvas">
      {cropping ? (
        <div className="selection-bar" ref={setCropBar} role="toolbar" aria-label={texts.crop.toolbar} />
      ) : (
        <SelectionBar />
      )}
      <div className="canvas__stage" ref={containerRef} onClick={clearSelection}>
        {scale > 0 && (
          <div
            className={cropping ? 'slide slide--cropping' : 'slide'}
            style={{
              width: slide.width * scale,
              height: slide.height * scale,
              fontFamily: `${project.fontFamily}, sans-serif`,
            }}
          >
            {layout.title && (
              <EditableText
                rect={layout.title}
                scale={scale}
                style={{ fontSize: titleFontSize(layout.title.h), align: 'left', color: '#000000' }}
                value={board.title}
                onChange={(title) => setBoardTitle(board.id, title)}
                placeholder={canvas.titlePlaceholder}
                ariaLabel={canvas.titleLabel}
                singleLine
                bold
              />
            )}

            {layout.frames.map((rect, i) => {
              const frame = board.frames[i]!
              return (
                <FrameView
                  key={frame.id}
                  rect={rect}
                  scale={scale}
                  image={frame.imageId ? (project.images[frame.imageId] ?? null) : null}
                  fit={settings.fit}
                  crop={frame.crop}
                  border={settings.border}
                  letterbox={settings.letterbox}
                  mention={settings.mention}
                />
              )
            })}

            {board.frames.length === 0 && (
              <div className="slide__empty">
                <p className="slide__empty-title">
                  {isNewProject ? canvas.start : canvas.boardEmpty(board.name)}
                </p>
                <p>{canvas.dropAnywhere}</p>
                <ImportButton className="button button--primary">
                  <Icon name="image-add" />
                  {texts.cmdbar.addImages}
                </ImportButton>
                <p className="slide__empty-hint">{canvas.sortedByName}</p>
                <div className="slide__empty-links">
                  <button
                    type="button"
                    className="link-button"
                    onClick={(e) => {
                      e.stopPropagation()
                      insertEmptyFrame(null, 'after')
                    }}
                  >
                    {canvas.startEmpty}
                  </button>
                  {isNewProject && (
                    <button
                      type="button"
                      className="link-button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void openProjectFromDisk()
                      }}
                    >
                      {canvas.openProject}
                    </button>
                  )}
                </div>
              </div>
            )}

            {textMode === 'perImage' &&
              layout.frameTexts.map((rect, i) => {
                const frame = board.frames[i]!
                return (
                  <EditableText
                    key={frame.id}
                    rect={rect}
                    scale={scale}
                    style={textStyle}
                    value={frame.text}
                    onChange={(text) => setFrameText(frame.id, text)}
                    label={numbering.enabled ? formatNumber(i, numbering) : null}
                    placeholder={canvas.textPlaceholder}
                    ariaLabel={canvas.textLabel(i + 1)}
                  />
                )
              })}

            {textMode === 'perRow' &&
              layout.rowTexts.map((rect, row) => (
                <EditableText
                  key={row}
                  rect={rect}
                  scale={scale}
                  style={textStyle}
                  value={board.rowTexts[row] ?? ''}
                  onChange={(text) => setRowText(row, text)}
                  placeholder={canvas.rowTextPlaceholder}
                  ariaLabel={canvas.rowTextLabel(row + 1)}
                />
              ))}

            {/* Without a text block per image, the number sits on the image. */}
            {textMode !== 'perImage' &&
              numbering.enabled &&
              layout.frames.map((rect, i) => {
                const frame = board.frames[i]!
                const image = frame.imageId ? project.images[frame.imageId] : undefined
                const visible = image ? placeImage(rect, image, settings.fit, frame.crop).visible : rect
                const label = formatNumber(i, numbering)
                const fontSize = badgeFontSize(visible.h)
                return (
                  <div
                    key={frame.id}
                    className="slide__badge"
                    style={{
                      ...place(numberBadgeRect(visible, label, fontSize), scale),
                      padding: `${NUMBER_BADGE.insetY * scale}px ${NUMBER_BADGE.insetX * scale}px`,
                      fontSize: ptToIn(fontSize) * scale,
                      lineHeight: LINE_HEIGHT,
                      background: hexToRgba(NUMBER_BADGE.background, NUMBER_BADGE.backgroundOpacity),
                      color: NUMBER_BADGE.color,
                    }}
                  >
                    {label}
                  </div>
                )
              })}

            {layout.frames.map((rect, i) => {
              const frame = board.frames[i]!
              const image = frame.imageId ? project.images[frame.imageId] : undefined
              return (
                <FrameHandle
                  key={frame.id}
                  frameId={frame.id}
                  hasImage={frame.imageId !== null}
                  label={canvas.frameLabel(i + 1, image?.fileName ?? null)}
                  rect={rect}
                  scale={scale}
                  selected={selected.has(frame.id)}
                  dimmed={dragged.has(frame.id)}
                  swapTarget={dropTarget?.mode === 'swap' && dropTarget.targetId === frame.id}
                  onSelect={selectFrame}
                  onOpen={(id) => (frame.imageId ? startCrop(id) : void chooseImageForFrame(id))}
                  onContextMenu={openFrameMenu}
                />
              )
            })}

            {cropping && (
              <CropEditor
                key={cropFrame!.id}
                frameId={cropFrame!.id}
                rect={cropRect!}
                scale={scale}
                image={cropImage!}
                fit={settings.fit}
                crop={cropFrame!.crop}
                letterbox={settings.letterbox}
                borderWidth={settings.border.enabled ? settings.border.width : 0}
                toolbarHost={cropBar}
              />
            )}

            {insertMarker && (
              <div className="slide__insert-marker" style={{ ...insertMarker, width: INSERT_MARKER_WIDTH }} />
            )}
          </div>
        )}
      </div>

      <footer className="canvas__status">
        {layout.frames.length > 0 ? (
          <span>
            {canvas.status(
              layout.columns,
              layout.rows,
              formatDecimal(inToCm(layout.cellWidth)),
              formatDecimal(inToCm(layout.cellHeight)),
            )}
          </span>
        ) : (
          <span>{canvas.noImages}</span>
        )}
        {layout.overflow > 0 && (
          <>
            <span className="canvas__warning" role="status">
              {canvas.overflow(layout.overflow, layout.columns, layout.rows)}
            </span>
            <button
              type="button"
              className="button"
              onClick={() => createOverflowBoards(board.id)}
              title={canvas.overflowTitle}
            >
              {layout.overflow > layout.columns * layout.rows
                ? canvas.createContinuations
                : canvas.createContinuation(
                    continuationName(board.name, boardNames.split('\n'), texts.defaults.continuationSuffix),
                  )}
            </button>
          </>
        )}
        {layout.frames.length > 0 && layout.cellWidth === 0 && (
          <span className="canvas__warning" role="status">
            {canvas.noRoom}
          </span>
        )}
      </footer>
    </div>
  )
}
