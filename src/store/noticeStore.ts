import { create } from 'zustand'

export type NoticeKind = 'progress' | 'info' | 'warning' | 'error'

export interface Notice {
  kind: NoticeKind
  text: string
}

interface NoticeStore {
  notice: Notice | null
  /** Shows a message; it goes away by itself, unless it shows progress. */
  show: (kind: NoticeKind, text: string) => void
  dismiss: () => void
}

const DURATION: Record<Exclude<NoticeKind, 'progress'>, number> = {
  info: 4000,
  warning: 7000,
  error: 7000,
}

let timer: ReturnType<typeof setTimeout> | undefined

export const useNoticeStore = create<NoticeStore>()((set) => ({
  notice: null,
  show: (kind, text) => {
    clearTimeout(timer)
    set({ notice: { kind, text } })
    if (kind !== 'progress') timer = setTimeout(() => set({ notice: null }), DURATION[kind])
  },
  dismiss: () => {
    clearTimeout(timer)
    set({ notice: null })
  },
}))
