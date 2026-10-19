import { create } from 'zustand'
import { useProjectStore } from './projectStore'

interface CropStore {
  /** Frame whose image is being cropped (in the active board), or null. */
  frameId: string | null
}

/** Crop mode: one frame at a time, opened by double-click or from its menu. */
export const useCropStore = create<CropStore>()(() => ({ frameId: null }))

export function startCrop(frameId: string) {
  useProjectStore.getState().selectFrame(frameId, 'single')
  useCropStore.setState({ frameId })
}

export function stopCrop() {
  useCropStore.setState({ frameId: null })
}
