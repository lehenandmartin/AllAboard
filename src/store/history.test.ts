import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProject, redo, undo, useProjectStore } from './projectStore'

const image = (id: string) => ({ id, fileName: `${id}.jpg`, width: 1920, height: 1080 })
const state = () => useProjectStore.getState()
const past = () => useProjectStore.temporal.getState().pastStates.length
const board = () => state().project.boards.find((b) => b.id === state().activeBoardId)!

describe('undo / redo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    state().openProject(createProject())
  })
  afterEach(() => vi.useRealTimers())

  it('undoes and redoes an action', () => {
    state().addImages(state().activeBoardId, [image('a'), image('b')])
    const [a] = board().frames
    state().deleteFrames([a!.id])
    expect(board().frames.map((f) => f.imageId)).toEqual(['b'])
    undo()
    expect(board().frames.map((f) => f.imageId)).toEqual(['a', 'b'])
    undo()
    expect(board().frames).toHaveLength(0)
    redo()
    redo()
    expect(board().frames.map((f) => f.imageId)).toEqual(['b'])
  })

  it('selection and board changes create no step', () => {
    state().addImages(state().activeBoardId, [image('a')])
    const before = past()
    state().selectFrame(board().frames[0]!.id, 'single')
    state().clearSelection()
    state().addBoard(null)
    const afterAdd = past()
    expect(afterAdd).toBe(before + 1)
    state().setActiveBoard(state().project.boards[0]!.id)
    expect(past()).toBe(afterAdd)
  })

  it('groups typing in the same text, but not two different texts', () => {
    state().addImages(state().activeBoardId, [image('a'), image('b')])
    const [a, b] = board().frames
    const before = past()
    for (const text of ['P', 'Pl', 'Pla', 'Plan']) {
      state().setFrameText(a!.id, text)
      vi.advanceTimersByTime(200)
    }
    expect(past()).toBe(before + 1)
    state().setFrameText(b!.id, 'X')
    expect(past()).toBe(before + 2)
    undo()
    undo()
    expect(board().frames[0]!.text).toBe('')
  })

  it('a pause in typing creates a new step', () => {
    state().addImages(state().activeBoardId, [image('a')])
    const id = board().frames[0]!.id
    state().setFrameText(id, 'Plan')
    vi.advanceTimersByTime(1500)
    state().setFrameText(id, 'Wide shot')
    undo()
    expect(board().frames[0]!.text).toBe('Plan')
  })

  it('undoing a board creation goes back to an existing board', () => {
    const first = state().activeBoardId
    state().addBoard(null)
    expect(state().activeBoardId).not.toBe(first)
    undo()
    expect(state().project.boards).toHaveLength(1)
    expect(state().activeBoardId).toBe(first)
  })

  it('undo removes frames that no longer exist from the selection', () => {
    state().addImages(state().activeBoardId, [image('a')])
    state().selectFrame(board().frames[0]!.id, 'single')
    undo()
    expect(state().selectedFrameIds).toEqual([])
  })

  it('opening a project clears the history', () => {
    state().addImages(state().activeBoardId, [image('a')])
    expect(past()).toBeGreaterThan(0)
    state().openProject(createProject())
    expect(past()).toBe(0)
  })
})
