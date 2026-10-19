import { useEffect } from 'react'
import type { RefObject } from 'react'

/** Closes an open menu on an outside click or with Esc. */
export function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, close: () => void): void {
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, ref, close])
}
