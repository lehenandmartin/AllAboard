import { Icon } from '../Icon/Icon'
import type { MenuEntry } from './menuTypes'

/** Menu items; `onDone` closes the menu before running the chosen action. */
export function MenuItems({ entries, onDone }: { entries: readonly MenuEntry[]; onDone: () => void }) {
  return (
    <>
      {entries.map((entry, i) =>
        entry === 'separator' ? (
          <div key={`sep-${i}`} className="menu-separator" role="separator" />
        ) : (
          <button
            key={entry.label}
            type="button"
            role="menuitem"
            className={entry.danger ? 'menu-item menu-item--danger' : 'menu-item'}
            disabled={entry.disabled}
            title={entry.title}
            onClick={() => {
              onDone()
              entry.onSelect()
            }}
          >
            <Icon name={entry.icon} />
            <span className="menu-item__label">{entry.label}</span>
            {entry.shortcut && <span className="menu-item__shortcut">{entry.shortcut}</span>}
          </button>
        ),
      )}
    </>
  )
}
