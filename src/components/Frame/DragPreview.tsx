import type { ImageMeta } from '../../core/types'
import { useImageUrl } from '../../hooks/useImageUrl'

/** Preview under the pointer during a drag and drop. */
export function DragPreview({
  image,
  count,
  width,
  height,
}: {
  image: ImageMeta | null
  count: number
  width: number
  height: number
}) {
  const url = useImageUrl(image?.id ?? null)
  return (
    <div className="drag-preview" style={{ width, height }}>
      {url && <img src={url} alt="" draggable={false} />}
      {count > 1 && <span className="drag-preview__count">{count}</span>}
    </div>
  )
}
