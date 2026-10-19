import { useCallback, useRef, useState } from 'react'
import { useDismiss } from '../../hooks/useDismiss'
import { useT } from '../../i18n'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { Icon } from '../Icon/Icon'
import { NumberInput, Toggle } from '../SettingsPanel/fields'

/** "Export .pptx" button and its options (image compression). */
export function ExportMenu({ exporting, onExport }: { exporting: boolean; onExport: () => void }) {
  const { exportMenu } = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, ref, close)
  const hasFrames = useProjectStore((s) => s.project.boards.some((b) => b.frames.length > 0))
  const compression = useUiStore((s) => s.compression)
  const setCompression = useUiStore((s) => s.setCompression)

  return (
    <div className="export-menu" ref={ref}>
      <button
        type="button"
        className="button button--primary"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={exporting || !hasFrames}
        title={hasFrames ? exportMenu.title : exportMenu.needImages}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="arrow-download" />
        {exporting ? exportMenu.exporting : exportMenu.button}
        <Icon name="chevron-down" size={12} />
      </button>
      {open && (
        <div
          className="menu-panel menu-panel--right export-menu__panel"
          role="dialog"
          aria-label={exportMenu.options}
        >
          <h2 className="export-menu__title">{exportMenu.heading}</h2>
          <div className="export-menu__row">
            <Toggle
              label={exportMenu.compress}
              checked={compression.enabled}
              onChange={(enabled) => setCompression({ enabled })}
            />
            <span>{exportMenu.compress}</span>
          </div>
          {compression.enabled && (
            <>
              <label className="export-menu__row export-menu__row--field">
                <span>{exportMenu.maxSide}</span>
                <NumberInput
                  value={compression.maxSide}
                  onChange={(v) => v !== null && setCompression({ maxSide: v })}
                  min={320}
                  max={8000}
                  step={160}
                  integer
                  suffix="px"
                />
              </label>
              <label className="export-menu__row export-menu__row--field">
                <span>{exportMenu.quality}</span>
                <NumberInput
                  value={Math.round(compression.quality * 100)}
                  onChange={(v) => v !== null && setCompression({ quality: v / 100 })}
                  min={10}
                  max={100}
                  step={5}
                  integer
                  suffix="%"
                />
              </label>
            </>
          )}
          <p className="export-menu__hint">
            {compression.enabled ? exportMenu.compressHint : exportMenu.fullHint}
          </p>
          <button
            type="button"
            className="button button--primary export-menu__go"
            onClick={() => {
              close()
              onExport()
            }}
          >
            <Icon name="arrow-download" />
            {exportMenu.go}
          </button>
        </div>
      )}
    </div>
  )
}
