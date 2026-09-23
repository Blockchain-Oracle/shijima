import { ImageResponse } from 'next/og'
import { MARK_MOON } from '@/components/shell/ShijimaMark'
import { OG } from './theme'

/** The mark as one SVG: the moon and the still line in ink, the one point in Robin Neon, on the night ground. */
function markSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="${MARK_MOON}" fill="${OG.ink}"/><rect x="4.5" y="27" width="23" height="2.2" rx="1.1" fill="${OG.ink}" opacity="0.9"/><circle cx="23.2" cy="9.2" r="2.6" fill="${OG.vermilion}"/></svg>`
}

/** The mark as a data URI, for Satori's plain img: the icon and every link preview draw the same picture. */
export function markDataUri(): string {
  return `data:image/svg+xml;base64,${Buffer.from(markSvg()).toString('base64')}`
}

/**
 * The Shijima mark as a square app icon, the same drawing as `ShijimaMark`. It sits inside the middle 60%, so a
 * phone that crops the icon to a circle or a squircle (a "maskable" icon) never cuts it.
 */
export function markIcon(size: number) {
  const inner = Math.round(size * 0.6)
  const src = markDataUri()
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: OG.ground,
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: Satori draws a plain img; next/image does not exist here */}
      <img src={src} width={inner} height={inner} alt="" />
    </div>,
    { width: size, height: size },
  )
}
