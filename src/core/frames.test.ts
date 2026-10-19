import { describe, expect, it } from 'vitest'
import { assignImagesInOrder, duplicateItems, insertItem, moveItems, rangeIds, removeItems, shiftItems, swapItems } from './frames'

const list = (ids: string) => ids.split('').map((id) => ({ id }))
const ids = (items: { id: string }[]) => items.map((i) => i.id).join('')

describe('moveItems', () => {
  it('inserts before or after the target', () => {
    expect(ids(moveItems(list('abcde'), ['a'], 'd', 'before'))).toBe('bcade')
    expect(ids(moveItems(list('abcde'), ['a'], 'd', 'after'))).toBe('bcdae')
    expect(ids(moveItems(list('abcde'), ['e'], 'a', 'before'))).toBe('eabcd')
    expect(ids(moveItems(list('abcde'), ['e'], 'a', 'after'))).toBe('aebcd')
  })

  it('moves several items as a block, in their order', () => {
    expect(ids(moveItems(list('abcdef'), ['e', 'b'], 'a', 'before'))).toBe('beacdf')
    expect(ids(moveItems(list('abcdef'), ['a', 'c'], 'f', 'after'))).toBe('bdefac')
  })

  it('no effect if the target is moved or not found', () => {
    expect(ids(moveItems(list('abc'), ['a', 'b'], 'b', 'after'))).toBe('abc')
    expect(ids(moveItems(list('abc'), ['a'], 'z', 'after'))).toBe('abc')
  })

  it('does not modify the given array', () => {
    const items = list('abc')
    moveItems(items, ['a'], 'c', 'after')
    expect(ids(items)).toBe('abc')
  })
})

describe('swapItems', () => {
  it('swaps two items', () => {
    expect(ids(swapItems(list('abcde'), 'b', 'e'))).toBe('aecdb')
  })

  it('no effect for an unknown or identical item', () => {
    expect(ids(swapItems(list('abc'), 'a', 'z'))).toBe('abc')
    expect(ids(swapItems(list('abc'), 'a', 'a'))).toBe('abc')
  })
})

describe('shiftItems', () => {
  it('shifts an item', () => {
    expect(ids(shiftItems(list('abcde'), ['b'], 1))).toBe('acbde')
    expect(ids(shiftItems(list('abcde'), ['b'], -1))).toBe('bacde')
    expect(ids(shiftItems(list('abcdef'), ['b'], 3))).toBe('acdebf')
  })

  it('stays within bounds', () => {
    expect(ids(shiftItems(list('abc'), ['a'], -1))).toBe('abc')
    expect(ids(shiftItems(list('abc'), ['c'], 5))).toBe('abc')
    expect(ids(shiftItems(list('abc'), ['a'], 10))).toBe('bca')
  })

  it('shifts several items as a block', () => {
    expect(ids(shiftItems(list('abcde'), ['b', 'c'], 1))).toBe('adbce')
    expect(ids(shiftItems(list('abcde'), ['b', 'd'], -1))).toBe('bdace')
  })
})

describe('insertItem', () => {
  it('inserts before, after, or at the end', () => {
    expect(ids(insertItem(list('abc'), { id: 'x' }, 'b', 'before'))).toBe('axbc')
    expect(ids(insertItem(list('abc'), { id: 'x' }, 'b', 'after'))).toBe('abxc')
    expect(ids(insertItem(list('abc'), { id: 'x' }, null, 'after'))).toBe('abcx')
    expect(ids(insertItem(list(''), { id: 'x' }, null, 'after'))).toBe('x')
  })
})

describe('removeItems', () => {
  it('removes the given items', () => {
    expect(ids(removeItems(list('abcde'), ['b', 'd']))).toBe('ace')
  })
})

describe('rangeIds', () => {
  it('returns the range in both directions', () => {
    expect(rangeIds(list('abcde'), 'b', 'd')).toEqual(['b', 'c', 'd'])
    expect(rangeIds(list('abcde'), 'd', 'b')).toEqual(['b', 'c', 'd'])
  })

  it('without a valid anchor, returns the clicked frame alone', () => {
    expect(rangeIds(list('abc'), 'z', 'b')).toEqual(['b'])
  })
})

describe('assignImagesInOrder', () => {
  const frames = [
    { id: 'f1', imageId: 'a', text: 'Plan 1' },
    { id: 'f2', imageId: null, text: 'to draw' },
    { id: 'f3', imageId: 'c', text: 'Plan 3' },
  ]
  const make = (imageId: string) => ({ id: `new-${imageId}`, imageId, text: '' })

  it('replaces in order, empty frames included, keeping the texts', () => {
    const r = assignImagesInOrder(frames, ['x', 'y', 'z'], make)
    expect(r.frames).toEqual([
      { id: 'f1', imageId: 'x', text: 'Plan 1' },
      { id: 'f2', imageId: 'y', text: 'to draw' },
      { id: 'f3', imageId: 'z', text: 'Plan 3' },
    ])
    expect([r.replaced, r.kept, r.added]).toEqual([3, 0, 0])
  })

  it('fewer images than frames: the last frames keep their image', () => {
    const r = assignImagesInOrder(frames, ['x'], make)
    expect(r.frames.map((f) => f.imageId)).toEqual(['x', null, 'c'])
    expect([r.replaced, r.kept, r.added]).toEqual([1, 2, 0])
  })

  it('more images than frames: the extra images create frames at the end', () => {
    const r = assignImagesInOrder(frames, ['x', 'y', 'z', 'w'], make)
    expect(r.frames.map((f) => f.id)).toEqual(['f1', 'f2', 'f3', 'new-w'])
    expect([r.replaced, r.kept, r.added]).toEqual([3, 0, 1])
  })

  it('does not modify the given array', () => {
    assignImagesInOrder(frames, ['x'], make)
    expect(frames[0]!.imageId).toBe('a')
  })
})

describe('duplicateItems', () => {
  const copy = (item: { id: string }) => ({ id: item.id.toUpperCase() })

  it('inserts the copies right after the last duplicated item', () => {
    expect(ids(duplicateItems(list('abcde'), ['b'], copy).items)).toBe('abBcde')
    const r = duplicateItems(list('abcde'), ['d', 'b'], copy)
    expect(ids(r.items)).toBe('abcdBDe')
    expect(ids(r.copies)).toBe('BD')
  })

  it('no effect if nothing is found', () => {
    const r = duplicateItems(list('abc'), ['z'], copy)
    expect(ids(r.items)).toBe('abc')
    expect(r.copies).toEqual([])
  })
})
