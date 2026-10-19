// Layout of a board from the project: used by the preview and the export.

import type { Layout } from './layout'
import { computeLayout } from './layout'
import { resolveFrameAspect, resolveSettings } from './settings'
import type { Board, BoardSettings, Project } from './types'

export interface BoardLayout {
  settings: BoardSettings
  frameAspect: number
  layout: Layout
}

export function computeBoardLayout(project: Project, board: Board): BoardLayout {
  const settings = resolveSettings(project.defaults, board.overrides)
  const firstImageId = board.frames.find((f) => f.imageId !== null)?.imageId
  const firstImage = firstImageId ? project.images[firstImageId] : undefined
  const frameAspect = resolveFrameAspect(settings, firstImage)
  const layout = computeLayout({
    slide: project.slide,
    settings,
    frameCount: board.frames.length,
    frameAspect,
  })
  return { settings, frameAspect, layout }
}
