import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { t } from '../i18n'
import { saveProjectFile } from '../storage/projectActions'

interface State {
  error: Error | null
}

/**
 * Safety net: if the interface crashes, explain it and offer to reload. The
 * project is saved automatically; a copy can also be downloaded before
 * reloading. (A class component, outside the hooks: texts are read with t().)
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    const { crash } = t()
    return (
      <div className="crash" role="alert">
        <div className="crash__panel">
          <h1>{crash.title}</h1>
          <p>{crash.text}</p>
          <div className="crash__actions">
            <button type="button" className="button" onClick={() => void saveProjectFile()}>
              {crash.downloadCopy}
            </button>
            <button type="button" className="button button--primary" onClick={() => window.location.reload()}>
              {crash.reload}
            </button>
          </div>
          <details>
            <summary>{crash.details}</summary>
            <pre>{this.state.error.message}</pre>
          </details>
        </div>
      </div>
    )
  }
}
