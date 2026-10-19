import { temporal } from 'zundo'
import { create } from 'zustand'
import { computeBoardLayout } from '../core/boardLayout'
import { chunk, continuationName, copyName, nextBoardName } from '../core/boards'
import type { Side } from '../core/frames'
import {
  assignImagesInOrder,
  duplicateItems,
  insertItem,
  moveItems,
  rangeIds,
  removeItems,
  shiftItems,
  swapItems,
  withImage,
} from '../core/frames'
import { DEFAULT_BOARD_SETTINGS, localizeDefaults } from '../core/settings'
import type {
  Board,
  BoardSettings,
  CompositeSettingKey,
  Frame,
  ImageCrop,
  ImageMeta,
  Project,
  SafeFont,
} from '../core/types'
import type { SlideFormatId } from '../core/units'
import { SLIDE_FORMATS } from '../core/units'
import { t } from '../i18n'

const newId = (): string => crypto.randomUUID()

export function createFrame(imageId: string | null = null): Frame {
  return { id: newId(), imageId, text: '' }
}

export function createBoard(name: string, frameCount = 0): Board {
  return {
    id: newId(),
    name,
    title: '',
    frames: Array.from({ length: frameCount }, () => createFrame()),
    rowTexts: [],
    overrides: {},
  }
}

/** A new project, with the default texts of the interface language. */
export function createProject(): Project {
  const { defaults } = t()
  return {
    id: newId(),
    name: defaults.projectName,
    slide: { id: '16:9', ...SLIDE_FORMATS['16:9'] },
    fontFamily: 'Arial',
    defaults: localizeDefaults(DEFAULT_BOARD_SETTINGS, defaults),
    boards: [createBoard(nextBoardName([], defaults.boardName))],
    images: {},
  }
}

/** Board names in the interface language. */
const newBoardName = (existing: readonly string[]) => nextBoardName(existing, t().defaults.boardName)

interface ProjectStore {
  project: Project
  activeBoardId: string

  /** Opens a project (restored, imported or new): the history starts over. */
  openProject: (project: Project) => void

  setProjectName: (name: string) => void
  setSlideFormat: (id: SlideFormatId) => void
  setCustomSlideSize: (width: number, height: number) => void
  setFontFamily: (font: SafeFont) => void

  /** Changes a project default setting. */
  setDefault: <K extends keyof BoardSettings>(key: K, value: BoardSettings[K]) => void
  /** Overrides a setting for a board. */
  setOverride: <K extends keyof BoardSettings>(boardId: string, key: K, value: BoardSettings[K]) => void
  /** Changes a single field of a composite setting (margins, notice…) in the project defaults. */
  setDefaultField: <K extends CompositeSettingKey, F extends keyof BoardSettings[K]>(
    key: K,
    field: F,
    value: BoardSettings[K][F],
  ) => void
  /** Overrides a single field of a composite setting for a board; the others stay inherited. */
  setOverrideField: <K extends CompositeSettingKey, F extends keyof BoardSettings[K]>(
    boardId: string,
    key: K,
    field: F,
    value: BoardSettings[K][F],
  ) => void
  /** Goes back to the project default for this setting, or for just one of its fields. */
  resetOverride: (boardId: string, key: keyof BoardSettings, field?: string) => void
  resetAllOverrides: (boardId: string) => void

  setBoardTitle: (boardId: string, title: string) => void
  /** Text under an image ("per image" mode), in the active board. */
  setFrameText: (frameId: string, text: string) => void
  /** Crop of an image of the active board; null goes back to the board's fit mode. */
  setFrameCrop: (frameId: string, crop: ImageCrop | null) => void
  /** Text under a row ("per row" mode), in the active board. */
  setRowText: (row: number, text: string) => void
  /** Adds images (already stored) at the end of a board, one frame each. */
  addImages: (boardId: string, images: readonly ImageMeta[]) => void
  /**
   * Spreads images over boards of `perBoard`: first fills the given board,
   * then creates boards after it (same settings). Returns the number of
   * boards that received images.
   */
  addImagesAcrossBoards: (boardId: string, images: readonly ImageMeta[], perBoard: number) => number

  /**
   * Replaces a board's images in frame order, keeping the board's texts,
   * title and settings. Returns the summary.
   */
  replaceBoardImages: (
    boardId: string,
    images: readonly ImageMeta[],
  ) => { replaced: number; kept: number; added: number }

  // Boards.
  setActiveBoard: (boardId: string) => void
  /** Adds an empty board after `afterId` (at the end if null) and activates it. */
  addBoard: (afterId: string | null) => void
  duplicateBoard: (boardId: string) => void
  /** Deletes a board (except the last remaining one). */
  deleteBoard: (boardId: string) => void
  /** Deletes several boards; refused if none would remain. */
  deleteBoards: (boardIds: readonly string[]) => void
  /** Duplicates several boards: the copies follow the last of them. */
  duplicateBoards: (boardIds: readonly string[]) => void
  /**
   * Boards selected along with the active board (Shift + click, Cmd/Ctrl +
   * click), in list order. Empty: only the active board is selected.
   */
  selectedBoardIds: string[]
  /** Starting point of a range selection of boards. */
  boardAnchor: string | null
  /** single: activates the board; toggle: Cmd/Ctrl + click; range: Shift + click from the active board. */
  selectBoard: (boardId: string, mode: 'single' | 'toggle' | 'range') => void
  renameBoard: (boardId: string, name: string) => void
  moveBoard: (boardId: string, targetId: string, side: Side) => void
  /** Moves frames of the active board to the end of another board. */
  moveFramesToBoard: (frameIds: readonly string[], targetBoardId: string) => void
  /**
   * Fixed grid too small: moves the extra frames to continuation boards
   * created right after, with the same settings.
   */
  createOverflowBoards: (boardId: string) => void

  // Frames of the active board.
  /** Selected frames, in board order. */
  selectedFrameIds: string[]
  /** Starting point of a range selection (Shift + click). */
  selectionAnchor: string | null
  /** single: replaces the selection; toggle: Cmd/Ctrl + click; range: Shift + click. */
  selectFrame: (frameId: string, mode: 'single' | 'toggle' | 'range') => void
  clearSelection: () => void
  selectAllFrames: () => void

  /** Moves frames before or after another one (insertion). */
  moveFrames: (ids: readonly string[], targetId: string, side: Side) => void
  swapFrames: (a: string, b: string) => void
  /** Shifts frames by delta positions (arrow keys). */
  shiftFrames: (ids: readonly string[], delta: number) => void
  deleteFrames: (ids: readonly string[]) => void
  /** Duplicates frames (image and text) right after the last one, and selects the copies. */
  duplicateFrames: (ids: readonly string[]) => void
  /** Inserts an empty frame before or after refId (at the end if null) and selects it. */
  insertEmptyFrame: (refId: string | null, side: Side) => void
  /** Puts an image (already stored) into a frame, empty or not. */
  setFrameImage: (frameId: string, image: ImageMeta) => void
}

function updateBoard(project: Project, boardId: string, update: (board: Board) => Board): Project {
  return {
    ...project,
    boards: project.boards.map((b) => (b.id === boardId ? update(b) : b)),
  }
}

/** Applies an operation to the frames of the active board. */
function updateActiveFrames(
  s: { project: Project; activeBoardId: string },
  update: (frames: Frame[]) => Frame[],
): { project: Project } {
  return { project: updateBoard(s.project, s.activeBoardId, (b) => ({ ...b, frames: update(b.frames) })) }
}

function activeFrames(s: { project: Project; activeBoardId: string }): Frame[] {
  return s.project.boards.find((b) => b.id === s.activeBoardId)?.frames ?? []
}

/** Keeps the selection in frame order. */
function inFrameOrder(frames: readonly Frame[], ids: ReadonlySet<string>): string[] {
  return frames.filter((f) => ids.has(f.id)).map((f) => f.id)
}

/** Inserts boards right after `afterId`. */
function insertBoardsAfter(project: Project, afterId: string, boards: readonly Board[]): Project {
  const at = project.boards.findIndex((b) => b.id === afterId) + 1
  return { ...project, boards: [...project.boards.slice(0, at), ...boards, ...project.boards.slice(at)] }
}

const noSelection = { selectedFrameIds: [] as string[], selectionAnchor: null, selectedBoardIds: [] as string[] }

// History (undo / redo). Only the project counts: changing the active board or
// the selection does not create a step. Successive edits of the same text or
// setting (typing, arrow keys, color picker) are grouped into a single step.

/** Maximum number of undo steps. */
const HISTORY_LIMIT = 200
/** Delay (ms) under which two edits of the same kind are grouped. */
const MERGE_WINDOW_MS = 1000

let pendingMergeKey: string | null = null
let lastMerge: { key: string; at: number } | null = null

type HistoryState = Pick<ProjectStore, 'project' | 'activeBoardId'>

/** Applies a "groupable" edit under the given key. */
function mergeable(key: string, apply: () => void) {
  pendingMergeKey = key
  try {
    apply()
  } finally {
    pendingMergeKey = null
  }
}

const initialProject = createProject()

export const useProjectStore = create<ProjectStore>()(
  temporal(
    (set, get) => ({
      project: initialProject,
      activeBoardId: initialProject.boards[0]!.id,

      openProject: (project) => {
        set({ project, activeBoardId: project.boards[0]!.id, ...noSelection })
        useProjectStore.temporal.getState().clear()
        lastMerge = null
      },

      setProjectName: (name) =>
        mergeable('projectName', () => set((s) => ({ project: { ...s.project, name } }))),

      setSlideFormat: (id) =>
        set((s) => ({
          project: {
            ...s.project,
            // For a custom size, the current dimensions are the starting point.
            slide: id === 'custom' ? { ...s.project.slide, id } : { id, ...SLIDE_FORMATS[id] },
          },
        })),

      setCustomSlideSize: (width, height) =>
        set((s) => ({ project: { ...s.project, slide: { id: 'custom', width, height } } })),

      setFontFamily: (fontFamily) => set((s) => ({ project: { ...s.project, fontFamily } })),

      setDefault: (key, value) =>
        mergeable(`default:${key}`, () =>
          set((s) => ({ project: { ...s.project, defaults: { ...s.project.defaults, [key]: value } } })),
        ),

      setOverride: (boardId, key, value) =>
        mergeable(`override:${boardId}:${key}`, () =>
          set((s) => ({
            project: updateBoard(s.project, boardId, (b) => ({
              ...b,
              overrides: { ...b.overrides, [key]: value },
            })),
          })),
        ),

      setDefaultField: (key, field, value) =>
        mergeable(`default:${key}.${String(field)}`, () =>
          set((s) => ({
            project: {
              ...s.project,
              defaults: { ...s.project.defaults, [key]: { ...s.project.defaults[key], [field]: value } },
            },
          })),
        ),

      setOverrideField: (boardId, key, field, value) =>
        mergeable(`override:${boardId}:${key}.${String(field)}`, () =>
          set((s) => ({
            project: updateBoard(s.project, boardId, (b) => ({
              ...b,
              overrides: { ...b.overrides, [key]: { ...b.overrides[key], [field]: value } },
            })),
          })),
        ),

      resetOverride: (boardId, key, field) =>
        set((s) => ({
          project: updateBoard(s.project, boardId, (b) => {
            const overrides = { ...b.overrides }
            const current: unknown = overrides[key]
            if (field !== undefined && typeof current === 'object' && current !== null) {
              // A single field: the other overrides of this setting remain.
              const rest = { ...(current as Record<string, unknown>) }
              delete rest[field]
              if (Object.keys(rest).length > 0) return { ...b, overrides: { ...overrides, [key]: rest } }
            }
            delete overrides[key]
            return { ...b, overrides }
          }),
        })),

      resetAllOverrides: (boardId) =>
        set((s) => ({ project: updateBoard(s.project, boardId, (b) => ({ ...b, overrides: {} })) })),

      setBoardTitle: (boardId, title) =>
        mergeable(`title:${boardId}`, () =>
          set((s) => ({ project: updateBoard(s.project, boardId, (b) => ({ ...b, title })) })),
        ),

      setFrameText: (frameId, text) =>
        mergeable(`text:${frameId}`, () =>
          set((s) =>
            updateActiveFrames(s, (frames) => frames.map((f) => (f.id === frameId ? { ...f, text } : f))),
          ),
        ),

      setFrameCrop: (frameId, crop) =>
        mergeable(`crop:${frameId}`, () =>
          set((s) =>
            updateActiveFrames(s, (frames) =>
              frames.map((f) => {
                if (f.id !== frameId) return f
                if (crop) return { ...f, crop }
                const { crop: _crop, ...rest } = f
                return rest
              }),
            ),
          ),
        ),

      setRowText: (row, text) =>
        mergeable(`row:${row}`, () =>
          set((s) => ({
            project: updateBoard(s.project, s.activeBoardId, (b) => {
              const rowTexts = Array.from(
                { length: Math.max(b.rowTexts.length, row + 1) },
                (_, i) => b.rowTexts[i] ?? '',
              )
              rowTexts[row] = text
              return { ...b, rowTexts }
            }),
          })),
        ),

      addImages: (boardId, images) =>
        set((s) => {
          const withImages = {
            ...s.project,
            images: { ...s.project.images, ...Object.fromEntries(images.map((img) => [img.id, img])) },
          }
          return {
            project: updateBoard(withImages, boardId, (b) => ({
              ...b,
              frames: [...b.frames, ...images.map((img) => createFrame(img.id))],
            })),
          }
        }),

      addImagesAcrossBoards: (boardId, images, perBoard) => {
        let used = 0
        set((s) => {
          const board = s.project.boards.find((b) => b.id === boardId)
          if (!board || images.length === 0) return {}
          const size = Math.max(1, Math.floor(perBoard))
          const room = Math.max(0, size - board.frames.length)
          const first = images.slice(0, room)
          const rest = chunk(images.slice(room), size)
          used = (first.length > 0 ? 1 : 0) + rest.length

          let project: Project = {
            ...s.project,
            images: { ...s.project.images, ...Object.fromEntries(images.map((img) => [img.id, img])) },
          }
          project = updateBoard(project, boardId, (b) => ({
            ...b,
            frames: [...b.frames, ...first.map((img) => createFrame(img.id))],
          }))
          const names = project.boards.map((b) => b.name)
          const created = rest.map((group) => {
            const name = newBoardName(names)
            names.push(name)
            return {
              ...createBoard(name),
              overrides: board.overrides,
              frames: group.map((img) => createFrame(img.id)),
            }
          })
          return { project: insertBoardsAfter(project, boardId, created) }
        })
        return used
      },

      replaceBoardImages: (boardId, images) => {
        let summary = { replaced: 0, kept: 0, added: 0 }
        set((s) => {
          const board = s.project.boards.find((b) => b.id === boardId)
          if (!board || images.length === 0) return {}
          const { frames, ...counts } = assignImagesInOrder(
            board.frames,
            images.map((img) => img.id),
            (imageId) => createFrame(imageId),
          )
          summary = counts
          const project: Project = {
            ...s.project,
            images: { ...s.project.images, ...Object.fromEntries(images.map((img) => [img.id, img])) },
          }
          return { project: updateBoard(project, boardId, (b) => ({ ...b, frames })) }
        })
        return summary
      },

      setActiveBoard: (boardId) => set({ activeBoardId: boardId, ...noSelection }),

      addBoard: (afterId) =>
        set((s) => {
          const board = createBoard(newBoardName(s.project.boards.map((b) => b.name)))
          const project =
            afterId === null
              ? { ...s.project, boards: [...s.project.boards, board] }
              : insertBoardsAfter(s.project, afterId, [board])
          return { project, activeBoardId: board.id, ...noSelection }
        }),

      duplicateBoard: (boardId) => get().duplicateBoards([boardId]),

      selectedBoardIds: [],
      boardAnchor: null,

      selectBoard: (boardId, mode) =>
        set((s) => {
          const { boards } = s.project
          if (mode === 'single') return { activeBoardId: boardId, ...noSelection }
          const current = new Set(boardSelection(s))
          if (mode === 'range') {
            // Like the slide pane: from the anchor (the original active board) to the clicked board.
            const anchor = s.boardAnchor && current.has(s.boardAnchor) ? s.boardAnchor : s.activeBoardId
            const ids = rangeIds(boards, anchor, boardId)
            return {
              ...noSelection,
              activeBoardId: boardId,
              selectedBoardIds: ids.length > 1 ? ids : [],
              boardAnchor: anchor,
            }
          }
          if (current.has(boardId)) {
            if (current.size === 1) return {}
            current.delete(boardId)
          } else current.add(boardId)
          const ids = boards.filter((b) => current.has(b.id)).map((b) => b.id)
          // The clicked board becomes active; if it was just removed, another selected board replaces it.
          const activeBoardId = current.has(boardId) ? boardId : ids.includes(s.activeBoardId) ? s.activeBoardId : ids[0]!
          return {
            ...noSelection,
            activeBoardId,
            selectedBoardIds: ids.length > 1 ? ids : [],
            boardAnchor: boardId,
          }
        }),

      deleteBoards: (boardIds) =>
        set((s) => {
          const ids = new Set(boardIds)
          const { boards } = s.project
          const remaining = boards.filter((b) => !ids.has(b.id))
          if (remaining.length === 0 || remaining.length === boards.length) return {}
          // Active board deleted: the one after the first deleted board (otherwise the last one).
          const first = boards.findIndex((b) => ids.has(b.id))
          const next = boards.slice(first).find((b) => !ids.has(b.id)) ?? remaining[remaining.length - 1]!
          const activeBoardId = ids.has(s.activeBoardId) ? next.id : s.activeBoardId
          return { project: { ...s.project, boards: remaining }, activeBoardId, ...noSelection }
        }),

      duplicateBoards: (boardIds) =>
        set((s) => {
          const ids = new Set(boardIds)
          const sources = s.project.boards.filter((b) => ids.has(b.id))
          if (sources.length === 0) return {}
          const names = s.project.boards.map((b) => b.name)
          const copies = sources.map((source) => {
            const copy: Board = {
              ...source,
              id: newId(),
              name: copyName(source.name, names, t().defaults.copySuffix),
              frames: source.frames.map((f) => ({ ...f, id: newId() })),
              rowTexts: [...source.rowTexts],
            }
            names.push(copy.name)
            return copy
          })
          return {
            project: insertBoardsAfter(s.project, sources[sources.length - 1]!.id, copies),
            ...noSelection,
            activeBoardId: copies[0]!.id,
            selectedBoardIds: copies.length > 1 ? copies.map((b) => b.id) : [],
            boardAnchor: copies[0]!.id,
          }
        }),

      deleteBoard: (boardId) =>
        set((s) => {
          const { boards } = s.project
          const index = boards.findIndex((b) => b.id === boardId)
          if (index < 0 || boards.length <= 1) return {}
          const remaining = boards.filter((b) => b.id !== boardId)
          const activeBoardId =
            s.activeBoardId === boardId
              ? remaining[Math.min(index, remaining.length - 1)]!.id
              : s.activeBoardId
          return { project: { ...s.project, boards: remaining }, activeBoardId, ...noSelection }
        }),

      renameBoard: (boardId, name) =>
        set((s) => ({
          project: updateBoard(s.project, boardId, (b) => ({ ...b, name: name.trim() || b.name })),
        })),

      moveBoard: (boardId, targetId, side) =>
        set((s) => ({
          project: { ...s.project, boards: moveItems(s.project.boards, [boardId], targetId, side) },
        })),

      moveFramesToBoard: (frameIds, targetBoardId) =>
        set((s) => {
          if (targetBoardId === s.activeBoardId) return {}
          const ids = new Set(frameIds)
          const moving = activeFrames(s).filter((f) => ids.has(f.id))
          if (moving.length === 0) return {}
          let project = updateBoard(s.project, s.activeBoardId, (b) => ({
            ...b,
            frames: removeItems(b.frames, frameIds),
          }))
          project = updateBoard(project, targetBoardId, (b) => ({ ...b, frames: [...b.frames, ...moving] }))
          return { project, ...noSelection }
        }),

      createOverflowBoards: (boardId) =>
        set((s) => {
          const board = s.project.boards.find((b) => b.id === boardId)
          if (!board) return {}
          const { layout } = computeBoardLayout(s.project, board)
          if (layout.overflow === 0) return {}
          const capacity = layout.columns * layout.rows
          const names = s.project.boards.map((b) => b.name)
          let previous = board.name
          const created = chunk(board.frames.slice(capacity), capacity).map((frames) => {
            const name = continuationName(previous, names, t().defaults.continuationSuffix)
            names.push(name)
            previous = name
            return { ...createBoard(name), title: board.title, overrides: board.overrides, frames }
          })
          const project = updateBoard(s.project, boardId, (b) => ({
            ...b,
            frames: b.frames.slice(0, capacity),
          }))
          return { project: insertBoardsAfter(project, boardId, created), ...noSelection }
        }),

      selectedFrameIds: [],
      selectionAnchor: null,

      selectFrame: (frameId, mode) =>
        set((s) => {
          const frames = activeFrames(s)
          if (mode === 'single') return { selectedFrameIds: [frameId], selectionAnchor: frameId, selectedBoardIds: [] }
          if (mode === 'toggle') {
            const ids = new Set(s.selectedFrameIds)
            if (ids.has(frameId)) ids.delete(frameId)
            else ids.add(frameId)
            return { selectedFrameIds: inFrameOrder(frames, ids), selectionAnchor: frameId, selectedBoardIds: [] }
          }
          const anchor = s.selectionAnchor ?? frameId
          return {
            selectedFrameIds: rangeIds(frames, anchor, frameId),
            selectionAnchor: anchor,
            selectedBoardIds: [],
          }
        }),

      clearSelection: () => set({ selectedFrameIds: [], selectionAnchor: null }),

      selectAllFrames: () =>
        set((s) => {
          const frames = activeFrames(s)
          return { selectedFrameIds: frames.map((f) => f.id), selectionAnchor: frames[0]?.id ?? null }
        }),

      moveFrames: (ids, targetId, side) =>
        set((s) => {
          const next = updateActiveFrames(s, (frames) => moveItems(frames, ids, targetId, side))
          return { ...next, selectedFrameIds: inFrameOrder(activeFrames({ ...s, ...next }), new Set(ids)) }
        }),

      swapFrames: (a, b) => set((s) => updateActiveFrames(s, (frames) => swapItems(frames, a, b))),

      shiftFrames: (ids, delta) =>
        set((s) => {
          const next = updateActiveFrames(s, (frames) => shiftItems(frames, ids, delta))
          return { ...next, selectedFrameIds: inFrameOrder(activeFrames({ ...s, ...next }), new Set(ids)) }
        }),

      deleteFrames: (ids) =>
        set((s) => ({
          ...updateActiveFrames(s, (frames) => removeItems(frames, ids)),
          selectedFrameIds: [],
          selectionAnchor: null,
        })),

      duplicateFrames: (ids) =>
        set((s) => {
          let copies: Frame[] = []
          const next = updateActiveFrames(s, (frames) => {
            const result = duplicateItems(frames, ids, (f) => ({ ...f, id: newId() }))
            copies = result.copies
            return result.items
          })
          if (copies.length === 0) return {}
          return { ...next, selectedFrameIds: copies.map((f) => f.id), selectionAnchor: copies[0]!.id }
        }),

      insertEmptyFrame: (refId, side) =>
        set((s) => {
          const frame = createFrame()
          return {
            ...updateActiveFrames(s, (frames) => insertItem(frames, frame, refId, side)),
            selectedFrameIds: [frame.id],
            selectionAnchor: frame.id,
          }
        }),

      setFrameImage: (frameId, image) =>
        set((s) =>
          updateActiveFrames(
            { ...s, project: { ...s.project, images: { ...s.project.images, [image.id]: image } } },
            (frames) => frames.map((f) => (f.id === frameId ? withImage(f, image.id) : f)),
          ),
        ),
    }),
    {
      limit: HISTORY_LIMIT,
      partialize: (s): HistoryState => ({ project: s.project, activeBoardId: s.activeBoardId }),
      // A step only if the project changed (not when the active board changes).
      equality: (past, current) => past.project === current.project,
      // zundo's types describe this function wrongly: it does receive the 4 arguments below.
      handleSet: (handleSet) => (pastState, replace, currentState, deltaState) => {
        const record = handleSet as unknown as (...args: unknown[]) => void
        const key = pendingMergeKey
        const now = Date.now()
        const merge = key !== null && lastMerge?.key === key && now - lastMerge.at < MERGE_WINDOW_MS
        lastMerge = key === null ? null : { key, at: now }
        if (!merge) record(pastState, replace, currentState, deltaState)
      },
    },
  ),
)

// After an undo, the active board or selected frames may no longer exist.
useProjectStore.subscribe((s) => {
  const board = s.project.boards.find((b) => b.id === s.activeBoardId)
  if (!board) {
    useProjectStore.setState({ activeBoardId: s.project.boards[0]!.id, ...noSelection })
    return
  }
  const ids = new Set(board.frames.map((f) => f.id))
  if (s.selectedFrameIds.some((id) => !ids.has(id))) {
    useProjectStore.setState({ selectedFrameIds: s.selectedFrameIds.filter((id) => ids.has(id)) })
  }
  const boardIds = new Set(s.project.boards.map((b) => b.id))
  if (s.selectedBoardIds.some((id) => !boardIds.has(id))) {
    const kept = s.selectedBoardIds.filter((id) => boardIds.has(id))
    useProjectStore.setState({ selectedBoardIds: kept.length > 1 ? kept : [] })
  }
})

/** Selected boards, in list order (at least the active board). */
export function boardSelection(s: Pick<ProjectStore, 'selectedBoardIds' | 'activeBoardId'>): string[] {
  return s.selectedBoardIds.includes(s.activeBoardId) ? s.selectedBoardIds : [s.activeBoardId]
}

export const undo = (): void => useProjectStore.temporal.getState().undo()
export const redo = (): void => useProjectStore.temporal.getState().redo()

export function useActiveBoard(): Board {
  return useProjectStore((s) => s.project.boards.find((b) => b.id === s.activeBoardId)!)
}
