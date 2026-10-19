import type { IconName } from './icons'
import { ICONS } from './icons'

/** Fluent icon (20 × 20, text color). Decorative by default: the label is carried by the button. */
export function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
