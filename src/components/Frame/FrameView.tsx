import { placeImage } from '../../core/crop'
import type { Rect } from '../../core/layout'
import { EMPTY_FRAME_BORDER } from '../../core/settings'
import { hexToRgba } from '../../core/format'
import { LETTERBOX_COLOR, letterboxRects } from '../../core/letterbox'
import { mentionBox } from '../../core/mention'
import { LINE_HEIGHT, TEXT_INSET } from '../../core/text'
import type { Border, ImageCrop, ImageFit, ImageMeta, Letterbox, Mention } from '../../core/types'
import { ptToIn } from '../../core/units'
import { useImageUrl } from '../../hooks/useImageUrl'
import { useT } from '../../i18n'
import { place } from '../Canvas/place'
import './Frame.css'

interface FrameViewProps {
  rect: Rect
  scale: number
  image: ImageMeta | null
  fit: ImageFit
  /** Crop specific to the frame. */
  crop?: ImageCrop
  border: Border
  letterbox: Letterbox
  mention: Mention
}

/** Common notice on the image (letterbox bar or band). */
function MentionView({
  image,
  scale,
  mention,
  letterbox,
  borderWidth,
}: {
  image: Rect
  scale: number
  mention: Mention
  letterbox: Letterbox
  borderWidth: number
}) {
  const box = mentionBox(image, mention, letterbox, borderWidth)
  if (!box) return null
  return (
    <div
      className="frame__mention"
      style={{
        ...place(box.rect, scale),
        padding: `0 ${TEXT_INSET * scale}px`,
        background: box.background ? hexToRgba(box.background.color, box.background.opacity) : undefined,
        color: box.color,
        fontFamily: `${mention.fontFamily}, sans-serif`,
        fontSize: ptToIn(box.fontSize) * scale,
        lineHeight: LINE_HEIGHT,
        textAlign: mention.align,
        justifyContent:
          mention.align === 'left' ? 'flex-start' : mention.align === 'right' ? 'flex-end' : 'center',
      }}
    >
      <span>{mention.text}</span>
    </div>
  )
}

/** A frame: the image placed according to the fit mode, or an empty frame. */
export function FrameView({ rect, scale, image, fit, crop, border, letterbox, mention }: FrameViewProps) {
  const { canvas } = useT()
  const url = useImageUrl(image?.id ?? null)

  if (!image) {
    return (
      <div
        className="frame frame--empty"
        style={{
          ...place(rect, scale),
          borderWidth: ptToIn(EMPTY_FRAME_BORDER.width) * scale,
          borderColor: EMPTY_FRAME_BORDER.color,
        }}
      />
    )
  }

  const { image: placed, visible } = placeImage(rect, image, fit, crop)
  return (
    <>
      {url ? (
        // The visible part cuts the whole image, placed where it belongs.
        <div className="frame__clip" style={place(visible, scale)}>
          <img
            className="frame__image"
            src={url}
            alt={image.fileName}
            title={image.fileName}
            draggable={false}
            decoding="async"
            style={place(
              { x: placed.x - visible.x, y: placed.y - visible.y, w: placed.w, h: placed.h },
              scale,
            )}
          />
        </div>
      ) : (
        <div
          className={url === null ? 'frame frame--missing' : 'frame frame--loading'}
          style={place(visible, scale)}
          title={url === null ? canvas.missingImage(image.fileName) : undefined}
        />
      )}
      {letterbox.enabled &&
        letterboxRects(visible, letterbox.percent, border.enabled ? border.width : 0).map((band, i) => (
          <div
            key={i}
            className="frame__letterbox"
            style={{ ...place(band, scale), background: LETTERBOX_COLOR }}
          />
        ))}
      <MentionView
        image={visible}
        scale={scale}
        mention={mention}
        letterbox={letterbox}
        borderWidth={border.enabled ? border.width : 0}
      />
      {border.enabled && (
        <div
          className="frame__border"
          style={{
            ...place(visible, scale),
            borderWidth: ptToIn(border.width) * scale,
            borderColor: border.color,
          }}
        />
      )}
    </>
  )
}
