import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'

/** Runs the .pptx export with the chosen compression options. */
export async function runExport(): Promise<void> {
  // Loaded on demand: PptxGenJS is large.
  const { exportProjectToPptx } = await import('../../export/exportProject')
  await exportProjectToPptx(useProjectStore.getState().project, useUiStore.getState().compression)
}
