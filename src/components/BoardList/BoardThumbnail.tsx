import { useMemo } from 'react'
import { computeBoardLayout } from '../../core/boardLayout'
import type { Rect } from '../../core/layout'
import type { Board } from '../../core/types'
import { useProjectStore } from '../../store/projectStore'
import { place } from '../Canvas/place'
import { FrameView } from '../Frame/FrameView'

/** Gray bar in place of a text: unreadable at this size, but it shows that it exists. */
function TextHint({ rect, scale }: { rect: Rect; scale: number }) {
  const h = Math.max(2, Math.min(rect.h * scale * 0.35, 4))
  return (
    <div
      className="thumb__text"
      style={{ ...place({ ...rect, h: 0 }, scale), height: h, top: rect.y * scale + 2 }}
    />
  )
}

/** Faithful thumbnail of a board: same rectangles as the preview and the export. */
export function BoardThumbnail({ board, width }: { board: Board; width: number }) {
  const project = useProjectStore((s) => s.project)
  const { settings, layout } = useMemo(() => computeBoardLayout(project, board), [project, board])
  const { slide } = project
  const scale = width / slide.width

  return (
    <div className="thumb" style={{ width, height: slide.height * scale }}>
      {layout.title && board.title && <TextHint rect={layout.title} scale={scale} />}
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
      {settings.textMode === 'perImage' &&
        layout.frameTexts.map((rect, i) =>
          board.frames[i]?.text ? <TextHint key={board.frames[i]!.id} rect={rect} scale={scale} /> : null,
        )}
      {settings.textMode === 'perRow' &&
        layout.rowTexts.map((rect, row) =>
          board.rowTexts[row] ? <TextHint key={row} rect={rect} scale={scale} /> : null,
        )}
    </div>
  )
}
