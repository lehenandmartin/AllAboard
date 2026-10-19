import { useEffect, useState } from 'react'
import { getCachedImageUrl, loadImageUrl } from '../storage/imageStore'

/** Displayable URL of a stored image; undefined while loading, null if not found. */
export function useImageUrl(imageId: string | null): string | null | undefined {
  const [loaded, setLoaded] = useState<{ id: string; url: string | null } | null>(null)
  const cached = imageId ? getCachedImageUrl(imageId) : undefined

  useEffect(() => {
    if (!imageId || cached) return
    let cancelled = false
    void loadImageUrl(imageId).then((url) => {
      if (!cancelled) setLoaded({ id: imageId, url })
    })
    return () => {
      cancelled = true
    }
  }, [imageId, cached])

  if (!imageId) return null
  if (cached) return cached
  return loaded?.id === imageId ? loaded.url : undefined
}
