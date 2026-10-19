import type { ImportCandidate } from '../../core/imageFiles'

const readFile = (entry: FileSystemFileEntry): Promise<File> =>
  new Promise((resolve, reject) => entry.file(resolve, reject))

const readEntries = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> =>
  new Promise((resolve, reject) => reader.readEntries(resolve, reject))

async function walk(entry: FileSystemEntry, out: ImportCandidate[]): Promise<void> {
  if (entry.isFile) {
    try {
      const file = await readFile(entry as FileSystemFileEntry)
      out.push({ file, path: entry.fullPath.replace(/^\//, '') })
    } catch {
      // Unreadable file: ignored.
    }
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    // readEntries returns files in batches: read until an empty batch.
    for (let batch = await readEntries(reader); batch.length > 0; batch = await readEntries(reader)) {
      for (const child of batch) await walk(child, out)
    }
  }
}

/**
 * Files of a drag and drop, folders included (walked recursively).
 * Call it during the drop event: the entries are only readable at that time.
 */
export async function candidatesFromDataTransfer(dataTransfer: DataTransfer): Promise<ImportCandidate[]> {
  const entries = [...dataTransfer.items]
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry())
  const files = [...dataTransfer.files]

  if (entries.length === 0 || entries.some((e) => e === null)) {
    return files.map((file) => ({ file, path: file.name }))
  }
  const out: ImportCandidate[] = []
  for (const entry of entries) await walk(entry!, out)
  return out
}
