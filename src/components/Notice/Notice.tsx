import { useT } from '../../i18n'
import type { NoticeKind } from '../../store/noticeStore'
import { useNoticeStore } from '../../store/noticeStore'
import { Icon } from '../Icon/Icon'
import type { IconName } from '../Icon/icons'
import './Notice.css'

const ICONS: Record<NoticeKind, IconName> = {
  progress: 'arrow-sync',
  info: 'checkmark-circle',
  warning: 'warning',
  error: 'error-circle',
}

/** Notification (toast) at the bottom of the screen. */
export function Notice() {
  const { notices } = useT()
  const notice = useNoticeStore((s) => s.notice)
  const dismiss = useNoticeStore((s) => s.dismiss)
  if (!notice) return null
  return (
    <div className={`notice notice--${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      <Icon name={ICONS[notice.kind]} className="notice__icon" />
      <p className="notice__text">{notice.text}</p>
      {notice.kind !== 'progress' && (
        <button type="button" className="notice__close" onClick={dismiss} aria-label={notices.close}>
          <Icon name="dismiss" size={16} />
        </button>
      )}
    </div>
  )
}
