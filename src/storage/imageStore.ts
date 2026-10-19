// Images: Blobs in IndexedDB, and object URLs in memory for display.
// The React state only holds the metadata (ImageMeta), never the data.

import { createStore, del, get, keys, set } from 'idb-keyval'
import type { ImageMeta } from '../core/types'

const store = createStore('allaboard-images', 'images')

export const putImageBlob = (id: string, blob: Blob): Promise<void> => set(id, blob, store)
export const getImageBlob = (id: string): Promise<Blob | undefined> => get<Blob>(id, store)
export const deleteImageBlob = (id: string): Promise<void> => del(id, store)
export const listImageIds = async (): Promise<string[]> => (await keys(store)).map(String)

const urls = new Map<string, string>()
const pending = new Map<string, Promise<string | null>>()

export const getCachedImageUrl = (id: string): string | undefined => urls.get(id)

/** Object URL of an image, read from IndexedDB if it is not cached. */
export function loadImageUrl(id: string): Promise<string | null> {
  const cached = urls.get(id)
  if (cached) return Promise.resolve(cached)
  let promise = pending.get(id)
  if (!promise) {
    promise = getImageBlob(id)
      .then((blob) => {
        if (!blob) return null
        const url = URL.createObjectURL(blob)
        urls.set(id, url)
        return url
      })
      .catch(() => null)
      .finally(() => pending.delete(id))
    pending.set(id, promise)
  }
  return promise
}

/** The image could not be read (damaged file or unexpected format). */
export class ImageDecodeError extends Error {}

/** The browser could not store the image (storage full or unavailable). */
export class ImageStorageError extends Error {}

/** Original dimensions, as the browser displays the image (EXIF orientation included). */
function readImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () =>
      img.naturalWidth > 0 && img.naturalHeight > 0
        ? resolve({ width: img.naturalWidth, height: img.naturalHeight })
        : reject(new ImageDecodeError('Empty image'))
    img.onerror = () => reject(new ImageDecodeError('Unreadable image'))
    img.src = url
  })
}

/** Measures the image, stores it in IndexedDB and returns its metadata. */
export async function storeImage(file: File): Promise<ImageMeta> {
  const url = URL.createObjectURL(file)
  try {
    const { width, height } = await readImageSize(url)
    const id = crypto.randomUUID()
    await putImageBlob(id, file).catch((error: unknown) => {
      throw new ImageStorageError(error instanceof Error ? error.message : String(error))
    })
    urls.set(id, url)
    return { id, fileName: file.name, width, height }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}
