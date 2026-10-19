import { useId, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { formatDecimal, parseDecimal } from '../../core/format'
import { cmToIn, inToCm } from '../../core/units'
import { Icon } from '../Icon/Icon'
import type { IconName } from '../Icon/icons'

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))

interface NumberInputProps {
  value: number | null
  onChange: (value: number | null) => void
  min?: number
  max?: number
  step?: number
  decimals?: number
  suffix?: string
  placeholder?: string
  /** Allows an empty field (onChange then receives null). */
  allowEmpty?: boolean
  integer?: boolean
  ariaLabel?: string
  id?: string
}

/**
 * Forgiving number field: type freely (comma or dot), the value is committed
 * when leaving the field or with Enter. Up/down arrows: ± step.
 */
export function NumberInput({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  decimals = 2,
  suffix,
  placeholder,
  allowEmpty = false,
  integer = false,
  ariaLabel,
  id,
}: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (value === null ? '' : formatDecimal(value, decimals))

  const normalize = (v: number): number => {
    const rounded = integer ? Math.round(v) : Number(v.toFixed(decimals))
    return clamp(rounded, min, max)
  }

  const commit = () => {
    if (draft === null) return
    const parsed = parseDecimal(draft)
    if (parsed === null) {
      if (allowEmpty && draft.trim() === '') onChange(null)
    } else {
      onChange(normalize(parsed))
    }
    setDraft(null)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setDraft(null)
      e.currentTarget.blur()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const base = parseDecimal(shown) ?? value ?? (min > -Infinity ? min : 0)
      const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)
      onChange(normalize(base + delta))
      setDraft(null)
    }
  }

  return (
    <span className="number-input">
      <input
        id={id}
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        value={shown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
      {suffix && <span className="number-input__suffix">{suffix}</span>}
    </span>
  )
}

interface CmInputProps {
  /** Value in inches. */
  value: number
  onChange: (inches: number) => void
  min?: number
  max?: number
  ariaLabel?: string
  id?: string
}

/** Input in cm of a length stored in inches. */
export function CmInput({ value, onChange, min = 0, max = 200, ariaLabel, id }: CmInputProps) {
  return (
    <NumberInput
      id={id}
      value={inToCm(value)}
      onChange={(cm) => cm !== null && onChange(cmToIn(cm))}
      min={min}
      max={max}
      step={0.1}
      suffix="cm"
      ariaLabel={ariaLabel}
    />
  )
}

interface SegmentedProps<T extends string> {
  value: T
  options: readonly { value: T; label: ReactNode; title?: string }[]
  onChange: (value: T) => void
  ariaLabel: string
}

export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: SegmentedProps<T>) {
  const name = useId()
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <label key={o.value} className="segmented__option" title={o.title}>
          <input
            aria-label={o.title}
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  )
}

interface SelectProps<T extends string> {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  id?: string
}

export function Select<T extends string>({ value, options, onChange, id }: SelectProps<T>) {
  return (
    <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </label>
  )
}

export function ColorInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}) {
  return (
    <label className="color-input">
      <input type="color" value={value} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value)} />
      <span>{value.toUpperCase()}</span>
    </label>
  )
}

const COLLAPSED_KEY = 'allaboard:collapsed-sections'

function loadCollapsed(): string[] {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function saveCollapsed(ids: string[]) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(ids))
  } catch {
    // Storage unavailable: the collapsed state lasts for the session.
  }
}

/**
 * Collapsible section of the format pane; the collapsed state is remembered in
 * this browser, under `id` (stable whatever the interface language).
 */
export function Section({
  id,
  title,
  icon,
  children,
}: {
  id: string
  title: string
  icon: IconName
  children: ReactNode
}) {
  const [open, setOpen] = useState(() => !loadCollapsed().includes(id))
  const bodyId = useId()
  const toggle = () => {
    const next = !open
    setOpen(next)
    const others = loadCollapsed().filter((other) => other !== id)
    saveCollapsed(next ? others : [...others, id])
  }
  return (
    <section className={open ? 'settings-section' : 'settings-section settings-section--collapsed'}>
      <h3>
        <button
          type="button"
          className="settings-section__header"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={toggle}
        >
          <Icon name="chevron-right" size={16} className="settings-section__chevron" />
          <Icon name={icon} size={16} className="settings-section__icon" />
          {title}
        </button>
      </h3>
      {open && (
        <div className="settings-section__body" id={bodyId}>
          {children}
        </div>
      )}
    </section>
  )
}
