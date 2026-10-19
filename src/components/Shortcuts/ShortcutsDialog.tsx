import { useEffect, useRef } from 'react'
import type { Messages } from '../../i18n'
import { useT } from '../../i18n'
import { AboutLine } from '../About/AboutLine'
import { Icon } from '../Icon/Icon'
import './ShortcutsDialog.css'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = IS_MAC ? '⌘' : 'Ctrl'
const ALT = IS_MAC ? '⌥' : 'Alt'

type Group = { title: string; items: [string[], string][] }

/** Shortcuts and gestures, by group, in the interface language. */
function groups({ shortcuts }: Messages): Group[] {
  const { keys: k, actions: a, groups: g } = shortcuts
  const SHIFT = IS_MAC ? '⇧' : k.shift
  return [
    {
      title: g.project,
      items: [
        [[MOD, 'Z'], a.undo],
        [IS_MAC ? [SHIFT, MOD, 'Z'] : ['Ctrl', 'Y'], a.redo],
        [[MOD, 'S'], a.saveReminder],
        [[MOD, 'E'], a.export],
        [[ALT, 'N'], a.newBoard],
        [[MOD, 'D'], a.duplicateBoards],
        [[SHIFT, k.clickBoard], a.selectBoardRange],
        [[MOD, k.clickBoard], a.toggleBoard],
        [[k.del], a.deleteBoards],
        [[k.rightClickBoard], a.boardActions],
      ],
    },
    {
      title: g.frames,
      items: [
        [[k.click], a.select],
        [[SHIFT, k.click], a.selectRange],
        [[MOD, k.click], a.toggle],
        [[MOD, 'A'], a.selectAll],
        [[MOD, 'D'], a.duplicate],
        [[k.esc], a.deselect],
        [['←', '→'], a.moveOne],
        [['↑', '↓'], a.moveRow],
        [[k.del], a.delete],
        [[k.doubleClick], a.crop],
        [[k.rightClick], a.frameActions],
      ],
    },
    {
      title: g.crop,
      items: [
        [[k.drag], a.moveImage],
        [[k.dragCorner], a.resize],
        [[k.wheel], a.zoom],
        [['+', '−'], a.zoomKeys],
        [['←', '→', '↑', '↓'], a.nudge],
        [[k.enter], a.finishCrop],
      ],
    },
    {
      title: g.dnd,
      items: [
        [[k.drag], a.insert],
        [[ALT, k.drag], a.swap],
        [[k.dragOnBoard], a.sendToBoard],
        [[k.filesOrFolder], a.importImages],
        [[k.imageOnFrame], a.replaceImage],
        [[k.projectFile], a.openProject],
      ],
    },
    {
      title: g.texts,
      items: [
        [[k.esc], a.finishTyping],
        [[MOD, k.enter], a.finishTyping],
      ],
    },
  ]
}

/** Help: the list of shortcuts and gestures. */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const texts = useT()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="shortcuts"
      aria-labelledby="shortcuts-title"
      onClose={onClose}
      onClick={(e) => {
        // Click on the backdrop (outside the content): close.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="shortcuts__content">
        <header className="shortcuts__header">
          <h2 id="shortcuts-title">{texts.shortcuts.title}</h2>
          <button type="button" className="shortcuts__close" onClick={onClose} aria-label={texts.common.close}>
            <Icon name="dismiss" />
          </button>
        </header>
        <div className="shortcuts__groups">
          {groups(texts).map((group) => (
            <section key={group.title}>
              <h3>{group.title}</h3>
              <dl>
                {group.items.map(([keys, label]) => (
                  <div key={label + keys.join()} className="shortcuts__item">
                    <dt>
                      {keys.map((k) => (
                        <kbd key={k}>{k}</kbd>
                      ))}
                    </dt>
                    <dd>{label}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <p className="shortcuts__footer">
          {texts.shortcuts.footerBefore} <kbd>?</kbd> {texts.shortcuts.footerAfter}
        </p>
        <AboutLine className="shortcuts__about" />
      </div>
    </dialog>
  )
}
