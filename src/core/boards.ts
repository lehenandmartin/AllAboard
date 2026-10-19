// Board rules: default names and splitting frames into batches.

/** First free "Board N" name (N starting at the number of boards + 1). */
export function nextBoardName(existing: readonly string[], base = 'Board'): string {
  const taken = new Set(existing)
  let n = existing.length + 1
  while (taken.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}

/** Escapes a text for use inside a regular expression. */
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Name of a suffixed variant: "Board 1 (copy)", then "Board 1 (copy 2)"…
 * An existing suffix of the same kind is replaced, not stacked.
 */
function suffixedName(base: string, suffix: string, existing: readonly string[]): string {
  const root = base.replace(new RegExp(` \\(${escapeRegExp(suffix)}(?: \\d+)?\\)$`), '')
  const taken = new Set(existing)
  if (!taken.has(`${root} (${suffix})`)) return `${root} (${suffix})`
  let n = 2
  while (taken.has(`${root} (${suffix} ${n})`)) n++
  return `${root} (${suffix} ${n})`
}

/** Name of a continuation board: "Board 1 (cont.)", then "Board 1 (cont. 2)"… */
export function continuationName(base: string, existing: readonly string[], suffix = 'cont.'): string {
  return suffixedName(base, suffix, existing)
}

/** Name of a copy: "Board 1 (copy)", then "Board 1 (copy 2)"… */
export function copyName(base: string, existing: readonly string[], suffix = 'copy'): string {
  const taken = new Set(existing)
  if (!taken.has(`${base} (${suffix})`)) return `${base} (${suffix})`
  let n = 2
  while (taken.has(`${base} (${suffix} ${n})`)) n++
  return `${base} (${suffix} ${n})`
}

/** Splits into batches of `size` items (the last one may be shorter). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size))
  const out: T[][] = []
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n))
  return out
}
