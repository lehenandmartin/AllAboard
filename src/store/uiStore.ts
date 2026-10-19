import { create } from 'zustand'
import type { CompressionOptions } from '../core/compression'
import { DEFAULT_COMPRESSION } from '../core/compression'

// Interface preferences, specific to this browser (not to the project).

const STORAGE_KEY = 'allaboard:ui'

interface UiPrefs {
  /** Spread imports over several boards. */
  splitImport: boolean
  /** Number of images per board when imports are spread. */
  splitSize: number
  /** Image compression at export. */
  compression: CompressionOptions
}

const DEFAULTS: UiPrefs = { splitImport: false, splitSize: 6, compression: DEFAULT_COMPRESSION }

function load(): UiPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const saved = JSON.parse(raw) as Partial<UiPrefs>
    return { ...DEFAULTS, ...saved, compression: { ...DEFAULT_COMPRESSION, ...saved.compression } }
  } catch {
    return DEFAULTS
  }
}

interface UiStore extends UiPrefs {
  setSplitImport: (value: boolean) => void
  setSplitSize: (value: number) => void
  setCompression: (value: Partial<CompressionOptions>) => void
}

export const useUiStore = create<UiStore>()((set) => ({
  ...load(),
  setSplitImport: (splitImport) => set({ splitImport }),
  setSplitSize: (splitSize) => set({ splitSize: Math.max(1, Math.floor(splitSize)) }),
  setCompression: (value) => set((s) => ({ compression: { ...s.compression, ...value } })),
}))

useUiStore.subscribe(({ splitImport, splitSize, compression }) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ splitImport, splitSize, compression }))
  } catch {
    // Storage unavailable (private browsing…): the preference lasts for the session.
  }
})
