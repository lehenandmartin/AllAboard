const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

/** Natural order: "shot2" before "shot10". Stable tie-break when equal. */
export function naturalCompare(a: string, b: string): number {
  return collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0)
}

export function naturalSortBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => naturalCompare(key(a), key(b)))
}
