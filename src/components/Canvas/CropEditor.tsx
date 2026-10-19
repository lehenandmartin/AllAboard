import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { MAX_CROP_SCALE, clampCrop, containScale, cropForFit, placeImage } from '../../core/crop'
import type { Rect } from '../../core/layout'
import { LETTERBOX_COLOR, letterboxRects } from '../../core/letterbox'
import type { ImageCrop, ImageFit, ImageMeta, Letterbox } from '../../core/types'
import { useImageUrl } from '../../hooks/useImageUrl'
import { useT } from '../../i18n'
import { stopCrop } from '../../store/cropStore'
import { useProjectStore } from '../../store/projectStore'
import { Icon } from '../Icon/Icon'
import { place } from './place'

interface CropEditorProps {
  frameId: string
  /** Frame rectangle, in inches. */
  rect: Rect
  /** Preview scale, in px per inch. */
  scale: number
  image: ImageMeta
  fit: ImageFit
  crop: ImageCrop | undefined
  letterbox: Letterbox
  borderWidth: number
  /** Where the crop toolbar goes (in place of the actions bar). */
  toolbarHost: HTMLElement | null
}

/** Current gesture: moving the image, or resizing it from a corner. */
type Gesture =
  | { kind: 'move'; startX: number; startY: number; from: ImageCrop }
  | { kind: 'resize'; anchorX: number; anchorY: number; left: boolean; top: boolean }

/** Step of the arrow keys (as a fraction of the frame) and of the zoom (factor). */
const NUDGE = 0.01
const ZOOM_STEP = 1.1

const CORNERS = [
  { left: true, top: true, cursor: 'nwse-resize', name: 'topLeft' },
  { left: false, top: true, cursor: 'nesw-resize', name: 'topRight' },
  { left: true, top: false, cursor: 'nesw-resize', name: 'bottomLeft' },
  { left: false, top: false, cursor: 'nwse-resize', name: 'bottomRight' },
] as const

/**
 * Cropping an image, in the manner of PowerPoint: the whole image shows
 * semi-transparent around the frame; drag it to move it, pull a corner (or
 * zoom with the wheel) to resize it. Esc, Enter or a click outside finish.
 */
export function CropEditor({
  frameId,
  rect,
  scale,
  image,
  fit,
  crop,
  letterbox,
  borderWidth,
  toolbarHost,
}: CropEditorProps) {
  const { crop: texts } = useT()
  const url = useImageUrl(image.id)
  const setFrameCrop = useProjectStore((s) => s.setFrameCrop)
  const rootRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  // During a gesture, the crop lives here; it is stored on release (one history step).
  const [draft, setDraft] = useState<ImageCrop | null>(null)

  const current = draft ?? crop ?? cropForFit(rect, image, fit)
  const { image: placed, visible } = placeImage(rect, image, fit, current)
  const minScale = containScale(rect, image)
  const commit = (next: ImageCrop) => setFrameCrop(frameId, clampCrop(rect, image, next))
  const zoomBy = (factor: number) => commit({ ...current, scale: current.scale * factor })

  // Keyboard: arrows to move, + / − to zoom, Esc or Enter to finish.
  // In the capture phase, before the frame shortcuts (where arrows move the frame).
  const keyState = useRef({ current, commit, zoomBy })
  useLayoutEffect(() => {
    keyState.current = { current, commit, zoomBy }
  })
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const { current, commit, zoomBy } = keyState.current
      const step = e.shiftKey ? NUDGE * 10 : NUDGE
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      const move = moves[e.key]
      if (move) commit({ ...current, x: current.x + move[0], y: current.y + move[1] })
      else if (e.key === '+' || e.key === '=') zoomBy(ZOOM_STEP)
      else if (e.key === '-') zoomBy(1 / ZOOM_STEP)
      else if (e.key === 'Escape' || e.key === 'Enter') stopCrop()
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        // No frame deletion while cropping.
      } else return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  // A click outside the editor finishes cropping.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!rootRef.current?.contains(target) && !toolbarRef.current?.contains(target)) stopCrop()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [])

  // Wheel: zoom (React attaches onWheel as passive, hence the direct listener).
  const wheelState = useRef(zoomBy)
  useLayoutEffect(() => {
    wheelState.current = zoomBy
  })
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      wheelState.current(Math.exp(-e.deltaY * 0.002))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const toInches = (e: { clientX: number; clientY: number }) => {
    const box = rootRef.current!.getBoundingClientRect()
    return { x: (e.clientX - box.left) / scale + rect.x, y: (e.clientY - box.top) / scale + rect.y }
  }

  const beginMove = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    gesture.current = { kind: 'move', startX: e.clientX, startY: e.clientY, from: current }
  }

  const beginResize = (e: ReactPointerEvent, left: boolean, top: boolean) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    // The opposite corner stays in place.
    gesture.current = {
      kind: 'resize',
      anchorX: left ? placed.x + placed.w : placed.x,
      anchorY: top ? placed.y + placed.h : placed.y,
      left,
      top,
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const g = gesture.current
    if (!g) return
    if (g.kind === 'move') {
      const dx = (e.clientX - g.startX) / scale / rect.w
      const dy = (e.clientY - g.startY) / scale / rect.h
      setDraft(clampCrop(rect, image, { ...g.from, x: g.from.x + dx, y: g.from.y + dy }))
      return
    }
    const p = toInches(e)
    const aspect = image.width / image.height
    // Width from the larger of the two distances to the opposite corner, ratio kept.
    const w = Math.max(Math.abs(p.x - g.anchorX), Math.abs(p.y - g.anchorY) * aspect, 0.01)
    const h = w / aspect
    const x = g.left ? g.anchorX - w : g.anchorX
    const y = g.top ? g.anchorY - h : g.anchorY
    const cover = Math.max(rect.w / image.width, rect.h / image.height)
    setDraft(
      clampCrop(rect, image, {
        x: (x + w / 2 - rect.x) / rect.w,
        y: (y + h / 2 - rect.y) / rect.h,
        scale: w / (image.width * cover),
      }),
    )
  }

  const endGesture = () => {
    gesture.current = null
    if (draft) commit(draft)
    setDraft(null)
  }

  // Positions relative to the frame (the editor sits on it).
  const local = (r: Rect): Rect => ({ x: r.x - rect.x, y: r.y - rect.y, w: r.w, h: r.h })
  const imageStyle = place(local(placed), scale)
  const bands = letterbox.enabled ? letterboxRects(visible, letterbox.percent, borderWidth) : []

  return (
    <div
      ref={rootRef}
      className="crop-editor"
      style={place(rect, scale)}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation()
        stopCrop()
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {url && (
        <>
          {/* The whole image, semi-transparent, and the part kept, sharp. */}
          <img className="crop-editor__ghost" src={url} alt="" draggable={false} style={imageStyle} />
          <div className="crop-editor__clip" style={place(local(visible), scale)}>
            <img
              className="crop-editor__image"
              src={url}
              alt=""
              draggable={false}
              style={place({ ...local(placed), x: placed.x - visible.x, y: placed.y - visible.y }, scale)}
            />
            {bands.map((band, i) => (
              <div
                key={i}
                className="crop-editor__band"
                style={{
                  ...place({ ...band, x: band.x - visible.x, y: band.y - visible.y }, scale),
                  background: LETTERBOX_COLOR,
                }}
              />
            ))}
          </div>
        </>
      )}
      <div className="crop-editor__frame" />
      <div
        className="crop-editor__grab"
        style={imageStyle}
        onPointerDown={beginMove}
        role="application"
        aria-label={texts.editorLabel(image.fileName)}
      >
        {CORNERS.map((c) => (
          <span
            key={c.name}
            className="crop-editor__handle"
            style={{
              left: c.left ? 0 : '100%',
              top: c.top ? 0 : '100%',
              cursor: c.cursor,
            }}
            onPointerDown={(e) => beginResize(e, c.left, c.top)}
            aria-hidden="true"
            title={texts.resize(texts.corners[c.name])}
          />
        ))}
      </div>

      {toolbarHost &&
        createPortal(
          <div className="crop-bar" ref={toolbarRef}>
            <span className="selection-bar__count crop-bar__title">
              <Icon name="crop" />
              {texts.title}
            </span>
            <span className="selection-bar__sep" aria-hidden="true" />
            <button
              type="button"
              className="button button--ghost button--icon"
              onClick={() => zoomBy(1 / ZOOM_STEP)}
              disabled={current.scale <= minScale + 1e-6}
              title={texts.zoomOutTitle}
              aria-label={texts.zoomOut}
            >
              <Icon name="zoom-out" />
            </button>
            <input
              className="crop-bar__zoom"
              type="range"
              min={Math.log(minScale)}
              max={Math.log(MAX_CROP_SCALE)}
              step={0.01}
              value={Math.log(current.scale)}
              onChange={(e) => commit({ ...current, scale: Math.exp(Number(e.target.value)) })}
              aria-label={texts.size}
            />
            <button
              type="button"
              className="button button--ghost button--icon"
              onClick={() => zoomBy(ZOOM_STEP)}
              disabled={current.scale >= MAX_CROP_SCALE - 1e-6}
              title={texts.zoomInTitle}
              aria-label={texts.zoomIn}
            >
              <Icon name="zoom-in" />
            </button>
            <span className="selection-bar__sep" aria-hidden="true" />
            <button
              type="button"
              className="button button--ghost"
              onClick={() => commit({ x: 0.5, y: 0.5, scale: 1 })}
              title={texts.fillTitle}
            >
              <Icon name="scale-fill" />
              <span className="button__label">{texts.fill}</span>
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => commit({ x: 0.5, y: 0.5, scale: minScale })}
              title={texts.wholeTitle}
            >
              <Icon name="scale-fit" />
              <span className="button__label">{texts.whole}</span>
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setFrameCrop(frameId, null)}
              disabled={!crop}
              title={texts.resetTitle}
            >
              <Icon name="arrow-reset" />
              <span className="button__label">{texts.reset}</span>
            </button>
            <span className="selection-bar__grow" />
            <button type="button" className="button button--primary" onClick={stopCrop} title={texts.doneTitle}>
              <Icon name="checkmark" />
              {texts.done}
            </button>
          </div>,
          toolbarHost,
        )}
    </div>
  )
}
