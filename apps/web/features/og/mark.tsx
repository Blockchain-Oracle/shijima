import { ImageResponse } from 'next/og'
import { OG } from './theme'

/**
 * The Shijima mark as a square app icon: the still ring and its one vermilion point on the night ground, the same
 * drawing as `ShijimaMark`. The ring sits inside the middle 60%, so a phone that crops the icon to a circle or a
 * squircle (a "maskable" icon) never cuts it.
 */
export function markIcon(size: number) {
  const ring = Math.round(size * 0.56)
  const stroke = Math.max(2, Math.round(size * 0.042))
  const dot = Math.round(size * 0.2)
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
      <div
        style={{
          width: ring,
          height: ring,
          borderRadius: ring,
          border: `${stroke}px solid ${OG.ink}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: dot, height: dot, borderRadius: dot, background: OG.vermilion }} />
      </div>
    </div>,
    { width: size, height: size },
  )
}
