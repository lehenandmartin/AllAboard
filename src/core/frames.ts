// Operations on the order of a board's frames. Pure functions: they return a
// new array and never modify the one they receive.

interface WithId {
  id: string
}

export type Side = 'before' | 'after'

/**
 * Moves the `ids` items (in their current order) before or after `targetId`.
 * No effect if the target is one of the moved items.
 */
export function moveItems<T extends WithId>(
  items: readonly T[],
  ids: readonly string[],
  targetId: string,
  side: Side,
): T[] {
  const moving = new Set(ids)
  if (moving.has(targetId)) return [...items]
  const moved = items.filter((item) => moving.has(item.id))
  const rest = items.filter((item) => !moving.has(item.id))
  const targetIndex = rest.findIndex((item) => item.id === targetId)
  if (targetIndex < 0 || moved.length === 0) return [...items]
  const at = targetIndex + (side === 'after' ? 1 : 0)
  return [...rest.slice(0, at), ...moved, ...rest.slice(at)]
}

/** Swaps two items. */
export function swapItems<T extends WithId>(items: readonly T[], a: string, b: string): T[] {
  const i = items.findIndex((item) => item.id === a)
  const j = items.findIndex((item) => item.id === b)
  const result = [...items]
  if (i < 0 || j < 0 || i === j) return result
  result[i] = items[j]!
  result[j] = items[i]!
  return result
}

/**
 * Shifts the `ids` items by `delta` positions, as a block and in their order.
 * The block starts at the position of the first selected item; it stays within bounds.
 */
export function shiftItems<T extends WithId>(items: readonly T[], ids: readonly string[], delta: number): T[] {
  const moving = new Set(ids)
  const first = items.findIndex((item) => moving.has(item.id))
  if (first < 0 || delta === 0) return [...items]
  const moved = items.filter((item) => moving.has(item.id))
  const rest = items.filter((item) => !moving.has(item.id))
  const at = Math.min(rest.length, Math.max(0, first + delta))
  return [...rest.slice(0, at), ...moved, ...rest.slice(at)]
}

/** Inserts an item before or after `refId`, or at the end if `refId` is null or not found. */
export function insertItem<T extends WithId>(
  items: readonly T[],
  item: T,
  refId: string | null,
  side: Side,
): T[] {
  const ref = refId === null ? -1 : items.findIndex((i) => i.id === refId)
  if (ref < 0) return [...items, item]
  const at = ref + (side === 'after' ? 1 : 0)
  return [...items.slice(0, at), item, ...items.slice(at)]
}

export function removeItems<T extends WithId>(items: readonly T[], ids: readonly string[]): T[] {
  const removed = new Set(ids)
  return items.filter((item) => !removed.has(item.id))
}

/** Ids between `anchorId` and `id` inclusive, in item order. */
export function rangeIds(items: readonly WithId[], anchorId: string, id: string): string[] {
  const a = items.findIndex((item) => item.id === anchorId)
  const b = items.findIndex((item) => item.id === id)
  if (a < 0 || b < 0) return b < 0 ? [] : [id]
  const [from, to] = a <= b ? [a, b] : [b, a]
  return items.slice(from, to + 1).map((item) => item.id)
}

/** The frame gets another image: its crop, specific to the previous one, is dropped. */
export function withImage<F extends { imageId: string | null; crop?: unknown }>(frame: F, imageId: string): F {
  const { crop: _crop, ...rest } = frame
  return { ...rest, imageId } as F
}

/**
 * Replaces the frames' images in order: the 1st image goes into the 1st
 * frame, and so on. Empty frames count as slots; the rest of each frame
 * (text…) is kept. With fewer images than frames, the last frames keep their
 * image; with more, the extra images become new frames.
 */
export function assignImagesInOrder<F extends { imageId: string | null; crop?: unknown }>(
  frames: readonly F[],
  imageIds: readonly string[],
  makeFrame: (imageId: string) => F,
): { frames: F[]; replaced: number; kept: number; added: number } {
  const updated = frames.map((frame, i) => (i < imageIds.length ? withImage(frame, imageIds[i]!) : frame))
  const extra = imageIds.slice(frames.length).map(makeFrame)
  return {
    frames: [...updated, ...extra],
    replaced: Math.min(frames.length, imageIds.length),
    kept: Math.max(0, frames.length - imageIds.length),
    added: extra.length,
  }
}

/**
 * Duplicates items: the copies, in the order of the originals, are inserted
 * right after the last duplicated item.
 */
export function duplicateItems<T extends WithId>(
  items: readonly T[],
  ids: readonly string[],
  copy: (item: T) => T,
): { items: T[]; copies: T[] } {
  const selected = new Set(ids)
  const originals = items.filter((item) => selected.has(item.id))
  if (originals.length === 0) return { items: [...items], copies: [] }
  const copies = originals.map(copy)
  const last = items.findLastIndex((item) => selected.has(item.id))
  return { items: [...items.slice(0, last + 1), ...copies, ...items.slice(last + 1)], copies }
}
