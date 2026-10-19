import { beforeEach, describe, expect, it } from 'vitest'
import { boardSelection, createProject, useProjectStore } from './projectStore'

const image = (id: string) => ({ id, fileName: `${id}.jpg`, width: 1920, height: 1080 })

describe('projectStore', () => {
  beforeEach(() => {
    const project = createProject()
    useProjectStore.setState({ project, activeBoardId: project.boards[0]!.id })
  })

  it('a new project has one empty board', () => {
    const { project } = useProjectStore.getState()
    expect(project.boards).toHaveLength(1)
    expect(project.boards[0]!.frames).toHaveLength(0)
  })

  it('addImages adds the metadata and one frame per image, at the end', () => {
    const { activeBoardId, addImages } = useProjectStore.getState()
    addImages(activeBoardId, [image('a'), image('b')])
    addImages(activeBoardId, [image('c')])
    const { project } = useProjectStore.getState()
    expect(project.boards[0]!.frames.map((f) => f.imageId)).toEqual(['a', 'b', 'c'])
    expect(Object.keys(project.images)).toEqual(['a', 'b', 'c'])
  })

  it('setOverride and resetOverride', () => {
    const { activeBoardId, setOverride, resetOverride } = useProjectStore.getState()
    setOverride(activeBoardId, 'columns', 3)
    expect(useProjectStore.getState().project.boards[0]!.overrides).toEqual({ columns: 3 })
    resetOverride(activeBoardId, 'columns')
    expect(useProjectStore.getState().project.boards[0]!.overrides).toEqual({})
  })
})

describe('frames of the active board', () => {
  const frameIds = () => useProjectStore.getState().project.boards[0]!.frames.map((f) => f.imageId)
  const frameId = (imageId: string) =>
    useProjectStore.getState().project.boards[0]!.frames.find((f) => f.imageId === imageId)!.id

  beforeEach(() => {
    const project = createProject()
    useProjectStore.setState({
      project,
      activeBoardId: project.boards[0]!.id,
      selectedFrameIds: [],
      selectionAnchor: null,
    })
    useProjectStore.getState().addImages(project.boards[0]!.id, ['a', 'b', 'c', 'd'].map(image))
  })

  it('single, toggle and range selection', () => {
    const { selectFrame } = useProjectStore.getState()
    selectFrame(frameId('b'), 'single')
    selectFrame(frameId('d'), 'range')
    expect(useProjectStore.getState().selectedFrameIds).toEqual(['b', 'c', 'd'].map(frameId))
    selectFrame(frameId('c'), 'toggle')
    expect(useProjectStore.getState().selectedFrameIds).toEqual(['b', 'd'].map(frameId))
    selectFrame(frameId('a'), 'toggle')
    expect(useProjectStore.getState().selectedFrameIds).toEqual(['a', 'b', 'd'].map(frameId))
  })

  it('moves, swaps, shifts and deletes', () => {
    const s = useProjectStore.getState()
    s.moveFrames([frameId('a')], frameId('c'), 'after')
    expect(frameIds()).toEqual(['b', 'c', 'a', 'd'])
    s.swapFrames(frameId('b'), frameId('d'))
    expect(frameIds()).toEqual(['d', 'c', 'a', 'b'])
    s.shiftFrames([frameId('d')], 2)
    expect(frameIds()).toEqual(['c', 'a', 'd', 'b'])
    s.deleteFrames([frameId('a'), frameId('b')])
    expect(frameIds()).toEqual(['c', 'd'])
  })

  it('inserts an empty frame and selects it', () => {
    useProjectStore.getState().insertEmptyFrame(frameId('b'), 'before')
    expect(frameIds()).toEqual(['a', null, 'b', 'c', 'd'])
    const { selectedFrameIds, project } = useProjectStore.getState()
    expect(selectedFrameIds).toEqual([project.boards[0]!.frames[1]!.id])
  })

  it("replaces a frame's image", () => {
    useProjectStore.getState().setFrameImage(frameId('b'), image('z'))
    expect(frameIds()).toEqual(['a', 'z', 'c', 'd'])
    expect(useProjectStore.getState().project.images.z).toBeDefined()
  })

  it("crops an image, then goes back to the board's fit", () => {
    const id = frameId('b')
    const frame = () => useProjectStore.getState().project.boards[0]!.frames.find((f) => f.id === id)!
    useProjectStore.getState().setFrameCrop(id, { x: 0.2, y: 0.5, scale: 1.5 })
    expect(frame().crop).toEqual({ x: 0.2, y: 0.5, scale: 1.5 })
    useProjectStore.getState().setFrameCrop(id, null)
    expect('crop' in frame()).toBe(false)
  })

  it('a new image drops the crop of the previous one', () => {
    const id = frameId('b')
    useProjectStore.getState().setFrameCrop(id, { x: 0.2, y: 0.5, scale: 1.5 })
    useProjectStore.getState().setFrameImage(id, image('z'))
    const frame = useProjectStore.getState().project.boards[0]!.frames.find((f) => f.id === id)!
    expect(frame.crop).toBeUndefined()
  })
})

describe('texts', () => {
  beforeEach(() => {
    const project = createProject()
    useProjectStore.setState({ project, activeBoardId: project.boards[0]!.id })
  })

  it("setFrameText changes a frame's text", () => {
    const { activeBoardId, addImages } = useProjectStore.getState()
    addImages(activeBoardId, [image('a')])
    const frame = useProjectStore.getState().project.boards[0]!.frames[0]!
    useProjectStore.getState().setFrameText(frame.id, 'Wide shot')
    expect(useProjectStore.getState().project.boards[0]!.frames[0]!.text).toBe('Wide shot')
  })

  it('setRowText fills the row array', () => {
    useProjectStore.getState().setRowText(2, 'Voice-over')
    expect(useProjectStore.getState().project.boards[0]!.rowTexts).toEqual(['', '', 'Voice-over'])
    useProjectStore.getState().setRowText(0, 'Intro')
    expect(useProjectStore.getState().project.boards[0]!.rowTexts).toEqual(['Intro', '', 'Voice-over'])
  })
})

describe('boards', () => {
  const state = () => useProjectStore.getState()
  const names = () => state().project.boards.map((b) => b.name)
  const imageIds = (i: number) => state().project.boards[i]!.frames.map((f) => f.imageId)

  beforeEach(() => {
    const project = createProject()
    useProjectStore.setState({
      project,
      activeBoardId: project.boards[0]!.id,
      selectedFrameIds: [],
      selectionAnchor: null,
      selectedBoardIds: [],
      boardAnchor: null,
    })
  })

  it('adds, renames, duplicates and reorders', () => {
    const first = state().activeBoardId
    state().addBoard(null)
    expect(names()).toEqual(['Board 1', 'Board 2'])
    expect(state().activeBoardId).toBe(state().project.boards[1]!.id)
    state().renameBoard(first, '  Intro  ')
    state().renameBoard(first, '   ')
    expect(names()[0]).toBe('Intro')
    state().addImages(first, [image('a')])
    state().duplicateBoard(first)
    expect(names()).toEqual(['Intro', 'Intro (copy)', 'Board 2'])
    const [orig, copy] = state().project.boards
    expect(copy!.frames[0]!.imageId).toBe('a')
    expect(copy!.frames[0]!.id).not.toBe(orig!.frames[0]!.id)
    state().moveBoard(state().project.boards[2]!.id, first, 'before')
    expect(names()).toEqual(['Board 2', 'Intro', 'Intro (copy)'])
  })

  it('selects several boards: Shift + click (range), Cmd/Ctrl + click (one by one)', () => {
    state().addBoard(null)
    state().addBoard(null)
    state().addBoard(null)
    const ids = state().project.boards.map((b) => b.id)
    state().selectBoard(ids[1]!, 'single')
    state().selectBoard(ids[3]!, 'range')
    expect(boardSelection(state())).toEqual([ids[1], ids[2], ids[3]])
    expect(state().activeBoardId).toBe(ids[3])
    // The range starts again from the anchor, in both directions.
    state().selectBoard(ids[0]!, 'range')
    expect(boardSelection(state())).toEqual([ids[0], ids[1]])
    state().selectBoard(ids[3]!, 'toggle')
    expect(boardSelection(state())).toEqual([ids[0], ids[1], ids[3]])
    state().selectBoard(ids[3]!, 'toggle')
    expect(boardSelection(state())).toEqual([ids[0], ids[1]])
    expect([ids[0], ids[1]]).toContain(state().activeBoardId)
    // A plain click goes back to a single board; so does selecting a frame.
    state().selectBoard(ids[2]!, 'single')
    expect(boardSelection(state())).toEqual([ids[2]])
  })

  it('deletes or duplicates several boards, but always keeps one', () => {
    state().addBoard(null)
    state().addBoard(null)
    const ids = state().project.boards.map((b) => b.id)
    state().duplicateBoards([ids[0]!, ids[1]!])
    expect(names()).toEqual(['Board 1', 'Board 2', 'Board 1 (copy)', 'Board 2 (copy)', 'Board 3'])
    expect(boardSelection(state())).toHaveLength(2)
    state().deleteBoards(state().project.boards.map((b) => b.id))
    expect(state().project.boards).toHaveLength(5)
    state().selectBoard(ids[0]!, 'single')
    state().deleteBoards([ids[0]!, ids[1]!])
    expect(names()).toEqual(['Board 1 (copy)', 'Board 2 (copy)', 'Board 3'])
    expect(state().activeBoardId).toBe(state().project.boards[0]!.id)
    expect(state().selectedBoardIds).toEqual([])
  })

  it('deletes a board and activates its neighbor, but never the last one', () => {
    const first = state().activeBoardId
    state().addBoard(null)
    const second = state().activeBoardId
    state().deleteBoard(second)
    expect(state().activeBoardId).toBe(first)
    state().deleteBoard(first)
    expect(state().project.boards).toHaveLength(1)
  })

  it('moves frames to another board, at the end', () => {
    const first = state().activeBoardId
    state().addImages(first, ['a', 'b', 'c'].map(image))
    state().addBoard(null)
    const second = state().activeBoardId
    state().addImages(second, [image('z')])
    state().setActiveBoard(first)
    const ids = state()
      .project.boards[0]!.frames.filter((f) => f.imageId !== 'b')
      .map((f) => f.id)
    state().moveFramesToBoard(ids, second)
    expect(imageIds(0)).toEqual(['b'])
    expect(imageIds(1)).toEqual(['z', 'a', 'c'])
  })

  it('creates continuation boards for a fixed grid that is too small', () => {
    const first = state().activeBoardId
    state().setOverride(first, 'columns', 2)
    state().setOverride(first, 'rows', 1)
    state().setBoardTitle(first, 'Sequence')
    state().addImages(first, ['a', 'b', 'c', 'd', 'e'].map(image))
    state().createOverflowBoards(first)
    expect(names()).toEqual(['Board 1', 'Board 1 (cont.)', 'Board 1 (cont. 2)'])
    expect([0, 1, 2].map(imageIds)).toEqual([['a', 'b'], ['c', 'd'], ['e']])
    const continuation = state().project.boards[1]!
    expect(continuation.overrides).toEqual({ columns: 2, rows: 1 })
    expect(continuation.title).toBe('Sequence')
  })

  it('spreads an import over boards of N images', () => {
    const first = state().activeBoardId
    state().addImages(first, [image('x')])
    const used = state().addImagesAcrossBoards(first, ['a', 'b', 'c', 'd', 'e', 'f'].map(image), 3)
    expect(used).toBe(3)
    expect(names()).toEqual(['Board 1', 'Board 2', 'Board 3'])
    expect([0, 1, 2].map(imageIds)).toEqual([['x', 'a', 'b'], ['c', 'd', 'e'], ['f']])
  })
})

describe('replacing all the images of a board', () => {
  const state = () => useProjectStore.getState()

  beforeEach(() => {
    state().openProject(createProject())
  })

  it('keeps the texts, the title, the row texts and the settings', () => {
    const boardId = state().activeBoardId
    state().addImages(boardId, ['a', 'b'].map(image))
    state().insertEmptyFrame(null, 'after')
    const [f1, , f3] = state().project.boards[0]!.frames
    state().setFrameText(f1!.id, 'Wide shot')
    state().setFrameText(f3!.id, 'À dessiner')
    state().setBoardTitle(boardId, 'Sequence 1')
    state().setRowText(0, 'Voice-over')
    state().setOverride(boardId, 'columns', 3)

    const summary = state().replaceBoardImages(boardId, ['x', 'y', 'z', 'w'].map(image))
    expect(summary).toEqual({ replaced: 3, kept: 0, added: 1 })

    const board = state().project.boards[0]!
    expect(board.frames.map((f) => f.imageId)).toEqual(['x', 'y', 'z', 'w'])
    expect(board.frames.map((f) => f.text)).toEqual(['Wide shot', '', 'À dessiner', ''])
    expect(board.frames[0]!.id).toBe(f1!.id)
    expect(board.title).toBe('Sequence 1')
    expect(board.rowTexts).toEqual(['Voice-over'])
    expect(board.overrides).toEqual({ columns: 3 })
    expect(Object.keys(state().project.images)).toEqual(expect.arrayContaining(['x', 'y', 'z', 'w']))
  })

  it('acts on the given board, even if it is not active, and undoes in one step', () => {
    const first = state().activeBoardId
    state().addImages(first, ['a', 'b', 'c'].map(image))
    state().addBoard(null)
    const summary = state().replaceBoardImages(first, [image('x')])
    expect(summary).toEqual({ replaced: 1, kept: 2, added: 0 })
    expect(state().project.boards[0]!.frames.map((f) => f.imageId)).toEqual(['x', 'b', 'c'])
    useProjectStore.temporal.getState().undo()
    expect(state().project.boards[0]!.frames.map((f) => f.imageId)).toEqual(['a', 'b', 'c'])
  })
})

describe('duplicating frames', () => {
  const state = () => useProjectStore.getState()

  it('copies image and text after the last frame, and selects the copies', () => {
    state().openProject(createProject())
    state().addImages(state().activeBoardId, ['a', 'b', 'c'].map(image))
    const [a, , c] = state().project.boards[0]!.frames
    state().setFrameText(a!.id, 'Plan 1')
    state().duplicateFrames([a!.id, c!.id])
    const frames = state().project.boards[0]!.frames
    expect(frames.map((f) => f.imageId)).toEqual(['a', 'b', 'c', 'a', 'c'])
    expect(frames[3]!.text).toBe('Plan 1')
    expect(frames[3]!.id).not.toBe(a!.id)
    expect(state().selectedFrameIds).toEqual([frames[3]!.id, frames[4]!.id])
  })
})

describe('overriding a single field', () => {
  const state = () => useProjectStore.getState()
  const overrides = () => state().project.boards[0]!.overrides

  beforeEach(() => {
    state().openProject(createProject())
  })

  it('changing then resetting a field leaves the others alone', () => {
    const id = state().activeBoardId
    state().setOverrideField(id, 'mention', 'enabled', true)
    state().setOverrideField(id, 'mention', 'fontSize', 12)
    expect(overrides()).toEqual({ mention: { enabled: true, fontSize: 12 } })
    state().resetOverride(id, 'mention', 'fontSize')
    // The notice stays shown: only the size goes back to the default.
    expect(overrides()).toEqual({ mention: { enabled: true } })
    state().resetOverride(id, 'mention', 'enabled')
    expect(overrides()).toEqual({})
  })

  it('resetting a composite setting without a field removes all its fields', () => {
    const id = state().activeBoardId
    state().setOverrideField(id, 'margins', 'top', 1)
    state().setOverrideField(id, 'margins', 'left', 2)
    state().resetOverride(id, 'margins')
    expect(overrides()).toEqual({})
  })

  it('project defaults: a single field changes', () => {
    const before = state().project.defaults.mention
    state().setDefaultField('mention', 'bandOpacity', 70)
    expect(state().project.defaults.mention).toEqual({ ...before, bandOpacity: 70 })
  })
})
