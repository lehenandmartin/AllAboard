import { describe, expect, it } from 'vitest'
import { naturalCompare, naturalSortBy } from './sort'

describe('naturalCompare', () => {
  it('sorts numbers in natural order', () => {
    const names = ['plan10.jpg', 'plan2.jpg', 'plan1.jpg', 'plan002b.jpg']
    expect([...names].sort(naturalCompare)).toEqual([
      'plan1.jpg',
      'plan2.jpg',
      'plan002b.jpg',
      'plan10.jpg',
    ])
  })

  it('ignores case and accents, with a stable order', () => {
    expect([...['b.png', 'A.png', 'a.png', 'É.png']].sort(naturalCompare)).toEqual([
      'A.png',
      'a.png',
      'b.png',
      'É.png',
    ])
  })

  it('naturalSortBy sorts by key without modifying the original', () => {
    const items = [{ n: 'img10' }, { n: 'img9' }]
    expect(naturalSortBy(items, (i) => i.n).map((i) => i.n)).toEqual(['img9', 'img10'])
    expect(items[0]!.n).toBe('img10')
  })
})
