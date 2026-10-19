import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { Rect } from '../../core/layout'
import { LINE_HEIGHT, TEXT_INSET } from '../../core/text'
import type { TextStyle } from '../../core/types'
import { ptToIn } from '../../core/units'
import { useT } from '../../i18n'
import { place } from './place'

interface EditableTextProps {
  rect: Rect
  scale: number
  style: Pick<TextStyle, 'fontSize' | 'align' | 'color'>
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel: string
  /** Fixed bold label on the first line (numbering). */
  label?: string | null
  /** A single line, vertically centered (title). */
  singleLine?: boolean
  bold?: boolean
}

/**
 * Text block edited right in the preview. Same inner margins, size and line
 * height as in the export; text overflowing the block is flagged.
 */
export function EditableText({
  rect,
  scale,
  style,
  value,
  onChange,
  placeholder,
  ariaLabel,
  label,
  singleLine = false,
  bold = false,
}: EditableTextProps) {
  const fieldRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  const { canvas } = useT()
  const fontSize = ptToIn(style.fontSize) * scale

  // Does the text overflow the block? (in the export, it would overflow the box)
  useLayoutEffect(() => {
    const el = fieldRef.current
    if (!el) return
    setOverflowing(singleLine ? el.scrollWidth > el.clientWidth + 1 : el.scrollHeight > el.clientHeight + 1)
  }, [value, scale, fontSize, rect.w, rect.h, label, singleLine])

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' || (e.key === 'Enter' && (singleLine || e.metaKey || e.ctrlKey))) {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  const className = [
    'slide__text',
    singleLine && 'slide__text--single',
    !value && !label && 'slide__text--empty',
    overflowing && 'slide__text--overflow',
  ]
    .filter(Boolean)
    .join(' ')

  const fieldProps = {
    ref: fieldRef,
    value,
    placeholder,
    'aria-label': ariaLabel,
    spellCheck: true,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    onKeyDown,
    // As in the export, show the start of the text, not the end.
    onBlur: (e: { currentTarget: HTMLElement }) => {
      e.currentTarget.scrollTop = 0
      e.currentTarget.scrollLeft = 0
    },
    onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  }

  return (
    <div
      className={className}
      style={{
        ...place(rect, scale),
        padding: TEXT_INSET * scale,
        fontSize,
        lineHeight: LINE_HEIGHT,
        textAlign: style.align,
        color: style.color,
        fontWeight: bold ? 700 : 400,
      }}
      title={overflowing ? canvas.textOverflow : undefined}
    >
      {label && <strong className="slide__text-label">{label}</strong>}
      {singleLine ? (
        <input type="text" {...fieldProps} style={{ height: fontSize * LINE_HEIGHT }} />
      ) : (
        <textarea {...fieldProps} rows={1} />
      )}
    </div>
  )
}
