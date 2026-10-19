// Import rules: accepted formats and image order.

import { naturalCompare } from './sort'

export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
const ACCEPTED_EXTENSION = /\.(jpe?g|png|webp|gif)$/i

/** File to import, with its relative path (dragged folder) or its name. */
export interface ImportCandidate<F extends { name: string; type: string } = File> {
  file: F
  path: string
}

export function isAcceptedImage(file: { name: string; type: string }): boolean {
  return (ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type) || ACCEPTED_EXTENSION.test(file.name)
}

/** System files (.DS_Store, ._image.jpg…): ignored without being reported. */
const isHiddenFile = (name: string): boolean => name.startsWith('.')

/**
 * Separates the accepted images from the other files, and sorts the images in
 * natural order (shot2 before shot10). Sorting uses the path, which amounts
 * to the file name within a folder.
 */
export function prepareImport<F extends { name: string; type: string }>(
  candidates: readonly ImportCandidate<F>[],
): { accepted: ImportCandidate<F>[]; rejected: string[] } {
  const accepted: ImportCandidate<F>[] = []
  const rejected: string[] = []
  for (const candidate of candidates) {
    if (isHiddenFile(candidate.file.name)) continue
    if (isAcceptedImage(candidate.file)) accepted.push(candidate)
    else rejected.push(candidate.path)
  }
  accepted.sort((a, b) => naturalCompare(a.path, b.path))
  return { accepted, rejected }
}
