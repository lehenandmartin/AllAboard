import { useEffect, useState } from 'react'
import type { Size } from '../core/units'

/** Size of an element's content, updated on every resize. */
export function useElementSize<T extends HTMLElement>(): [(el: T | null) => void, Size | null] {
  const [element, setElement] = useState<T | null>(null)
  const [size, setSize] = useState<Size | null>(null)

  useEffect(() => {
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return [setElement, size]
}
