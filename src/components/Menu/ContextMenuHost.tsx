import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useContextMenuStore } from '../../store/contextMenuStore'
import { MenuItems } from './MenuItems'

/** Minimum margin between the menu and the window edges, in px. */
const EDGE = 8

/** Shows the open context menu at the pointer, never leaving the window. */
export function ContextMenuHost() {
  const menu = useContextMenuStore((s) => s.menu)
  const close = useContextMenuStore((s) => s.close)
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  // Position: at the pointer, shifted if the menu overflows on the right or at the bottom.
  useLayoutEffect(() => {
    const panel = ref.current
    if (!menu || !panel) {
      setPosition(null)
      return
    }
    const { width, height } = panel.getBoundingClientRect()
    const left = Math.max(EDGE, Math.min(menu.x, window.innerWidth - width - EDGE))
    const top = menu.y + height + EDGE > window.innerHeight ? Math.max(EDGE, menu.y - height) : menu.y
    setPosition({ left, top })
  }, [menu])

  // Focus the first item once the menu is placed (a hidden element cannot receive it).
  useEffect(() => {
    if (position) ref.current?.querySelector<HTMLButtonElement>('.menu-item:not(:disabled)')?.focus()
  }, [position])

  // Closing: outside click, Esc, scroll, resize, window switch.
  useEffect(() => {
    if (!menu) return
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    window.addEventListener('blur', close)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
      window.removeEventListener('blur', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [menu, close])

  if (!menu) return null

  // Up / down arrows, Home / End: moving between items.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('.menu-item:not(:disabled)') ?? [])]
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    const go = (i: number) => {
      e.preventDefault()
      items[(i + items.length) % items.length]?.focus()
    }
    if (e.key === 'ArrowDown') go(index + 1)
    else if (e.key === 'ArrowUp') go(index - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(items.length - 1)
    else if (e.key === 'Tab') close()
  }

  return (
    <div
      ref={ref}
      className="menu-panel context-menu"
      role="menu"
      aria-label={menu.label}
      style={position ?? { left: menu.x, top: menu.y, visibility: 'hidden' }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuItems entries={menu.entries} onDone={close} />
    </div>
  )
}
