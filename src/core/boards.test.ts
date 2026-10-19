import { describe, expect, it } from 'vitest'
import { chunk, continuationName, copyName, nextBoardName } from './boards'

describe('nextBoardName', () => {
  it('numbers in sequence, skipping taken names', () => {
    expect(nextBoardName([])).toBe('Board 1')
    expect(nextBoardName(['Board 1'])).toBe('Board 2')
    expect(nextBoardName(['Board 1', 'Board 3'])).toBe('Board 4')
    expect(nextBoardName(['Intro', 'Board 3'])).toBe('Board 4')
  })
})

describe('continuationName', () => {
  it('adds "(cont.)", then a number', () => {
    expect(continuationName('Board 1', ['Board 1'])).toBe('Board 1 (cont.)')
    expect(continuationName('Board 1', ['Board 1', 'Board 1 (cont.)'])).toBe('Board 1 (cont. 2)')
  })

  it('a continuation of a continuation starts from the original name', () => {
    expect(continuationName('Board 1 (cont.)', ['Board 1', 'Board 1 (cont.)'])).toBe('Board 1 (cont. 2)')
    expect(continuationName('Board 1 (cont. 2)', ['Board 1 (cont.)', 'Board 1 (cont. 2)'])).toBe(
      'Board 1 (cont. 3)',
    )
  })

  it('uses the suffix of the interface language', () => {
    expect(continuationName('Board 1 (suite)', ['Board 1 (suite)'], 'suite')).toBe('Board 1 (suite 2)')
  })
})

describe('copyName', () => {
  it('adds "(copy)", then a number', () => {
    expect(copyName('Intro', ['Intro'])).toBe('Intro (copy)')
    expect(copyName('Intro', ['Intro', 'Intro (copy)'])).toBe('Intro (copy 2)')
    expect(copyName('Intro', ['Intro'], 'copie')).toBe('Intro (copie)')
  })
})

describe('chunk', () => {
  it('splits into batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 3)).toEqual([])
    expect(chunk([1, 2], 0)).toEqual([[1], [2]])
  })
})
