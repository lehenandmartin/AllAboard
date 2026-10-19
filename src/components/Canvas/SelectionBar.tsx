import { useT } from '../../i18n'
import { useActiveBoard, useProjectStore } from '../../store/projectStore'
import { Icon } from '../Icon/Icon'
import { frameActions } from './frameActions'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = IS_MAC ? '⌘' : 'Ctrl'
const ALT = IS_MAC ? '⌥' : 'Alt'

/** Actions on the selected frames, or a gestures hint when nothing is selected. */
export function SelectionBar() {
  const { selection } = useT()
  const board = useActiveBoard()
  const selected = useProjectStore((s) => s.selectedFrameIds)
  const clearSelection = useProjectStore((s) => s.clearSelection)

  if (board.frames.length === 0) return <div className="selection-bar" />

  if (selected.length === 0) {
    return (
      <div className="selection-bar selection-bar--hint">
        <Icon name="info" size={16} />
        <span>{selection.hint(MOD, ALT)}</span>
      </div>
    )
  }

  return (
    <div className="selection-bar" role="toolbar" aria-label={selection.label}>
      <span className="selection-bar__count">{selection.count(selected.length)}</span>
      <span className="selection-bar__sep" aria-hidden="true" />
      {frameActions(selected).map((action, i) =>
        action === 'separator' ? (
          <span key={`sep-${i}`} className="selection-bar__sep" aria-hidden="true" />
        ) : (
          <button
            key={action.label}
            type="button"
            className={action.danger ? 'button button--ghost button--danger' : 'button button--ghost'}
            onClick={action.onSelect}
            disabled={action.disabled}
            title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
          >
            <Icon name={action.icon} />
            <span className="button__label">{action.label}</span>
          </button>
        ),
      )}
      <span className="selection-bar__grow" />
      <button
        type="button"
        className="button button--ghost button--icon selection-bar__close"
        onClick={clearSelection}
        aria-label={selection.clear}
        title={selection.clearTitle}
      >
        <Icon name="dismiss" />
      </button>
    </div>
  )
}
