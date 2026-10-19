import { APP_VERSION, REPOSITORY_URL } from '../../appInfo'
import { useT } from '../../i18n'
import './AboutLine.css'

/** "AllAboard · Version 1.0.0 · Source code on GitHub", for the File menu and the help dialog. */
export function AboutLine({ className }: { className?: string }) {
  const { appName, about } = useT()
  return (
    <p className={className ? `about-line ${className}` : 'about-line'}>
      <span>{appName}</span>
      <span aria-hidden="true">·</span>
      <span>{about.version(APP_VERSION)}</span>
      <span aria-hidden="true">·</span>
      <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
        {about.sourceCode}
      </a>
    </p>
  )
}
