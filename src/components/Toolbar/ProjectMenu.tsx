import { useCallback, useRef, useState } from 'react'
import { useDismiss } from '../../hooks/useDismiss'
import type { Messages } from '../../i18n'
import { LOCALES, numberLocale, useLocaleStore, useT } from '../../i18n'
import { PROJECT_FILE_EXTENSION } from '../../storage/projectFile'
import {
  deleteSavedProject,
  newProject,
  openProjectFile,
  openSavedProject,
  saveProjectFile,
} from '../../storage/projectActions'
import type { ProjectSummary } from '../../storage/projectStorage'
import { listProjects } from '../../storage/projectStorage'
import { useProjectStore } from '../../store/projectStore'
import { AboutLine } from '../About/AboutLine'
import { Icon } from '../Icon/Icon'
import { pickFiles } from '../Import/pickFiles'

/** Maximum number of recent projects shown. */
const MAX_RECENT = 8

function describe(p: ProjectSummary, texts: Messages, locale: string): string {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(p.savedAt)
  return texts.fileMenu.describe(p.boardCount, p.imageCount, date)
}

/** "File" menu: new project, recent projects, .zip project file, language. */
export function ProjectMenu() {
  const texts = useT()
  const { fileMenu } = texts
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<ProjectSummary[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const currentId = useProjectStore((s) => s.project.id)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, ref, close)

  const toggle = async () => {
    if (open) return close()
    setRecent(await listProjects().catch(() => []))
    setOpen(true)
  }

  const run = (action: () => unknown) => () => {
    close()
    void action()
  }

  const onDelete = async (p: ProjectSummary) => {
    if (!window.confirm(fileMenu.confirmDelete(p.name))) return
    await deleteSavedProject(p.id)
    setRecent((list) => list.filter((r) => r.id !== p.id))
  }

  const others = recent.filter((p) => p.id !== currentId).slice(0, MAX_RECENT)

  return (
    <div className="project-menu" ref={ref}>
      <button
        type="button"
        className="button button--ghost"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => void toggle()}
      >
        <Icon name="folder-open" />
        {fileMenu.label}
        <Icon name="chevron-down" size={12} className="project-menu__chevron" />
      </button>
      {open && (
        <div className="menu-panel project-menu__panel" role="menu">
          <button type="button" role="menuitem" className="menu-item" onClick={run(newProject)}>
            <Icon name="document-add" />
            <span className="menu-item__label">{fileMenu.newProject}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={run(async () => {
              const [file] = await pickFiles(`${PROJECT_FILE_EXTENSION},application/zip`, false)
              if (file) await openProjectFile(file)
            })}
          >
            <Icon name="folder-open" />
            <span className="menu-item__label">{fileMenu.open}</span>
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={run(saveProjectFile)}>
            <Icon name="save" />
            <span className="menu-item__label">{fileMenu.save}</span>
          </button>
          <div className="menu-separator" role="separator" />
          <div className="menu-label">{fileMenu.recent}</div>
          {others.length === 0 ? (
            <p className="project-menu__empty">{fileMenu.noRecent}</p>
          ) : (
            others.map((p) => (
              <div key={p.id} className="project-menu__recent">
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  onClick={run(() => openSavedProject(p.id))}
                >
                  <span className="menu-item__label">
                    <span className="project-menu__name">{p.name || texts.common.untitled}</span>
                    <small className="project-menu__meta">{describe(p, texts, numberLocale(locale))}</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="button button--ghost button--icon project-menu__delete"
                  aria-label={fileMenu.deleteProject(p.name)}
                  title={fileMenu.deleteThis}
                  onClick={() => void onDelete(p)}
                >
                  <Icon name="delete" size={16} />
                </button>
              </div>
            ))
          )}
          <p className="project-menu__note">{fileMenu.note}</p>
          <div className="menu-separator" role="separator" />
          <div className="menu-label">{fileMenu.language}</div>
          {LOCALES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={locale === id}
              className="menu-item"
              lang={id}
              onClick={() => {
                setLocale(id)
                close()
              }}
            >
              {locale === id ? <Icon name="checkmark" /> : <span className="menu-item__spacer" aria-hidden="true" />}
              <span className="menu-item__label">{label}</span>
            </button>
          ))}
          <div className="menu-separator" role="separator" />
          <AboutLine className="project-menu__about" />
        </div>
      )}
    </div>
  )
}
