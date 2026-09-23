import { ogCopy, webCopy } from '@desk/shared'
import type { ReactNode } from 'react'
import { markDataUri } from './mark'
import { OG, OG_PAD } from './theme'

const CROP = 28
const CROP_INSET = 32

/** Masayume's `.crop` corner marks, one L per corner, drawn with per-side borders satori understands. */
function Crop({ at }: { at: 'tl' | 'tr' | 'bl' | 'br' }) {
  const top = at[0] === 't'
  const left = at[1] === 'l'
  const line = `1px solid ${OG.crop}`
  return (
    <div
      style={{
        position: 'absolute',
        width: CROP,
        height: CROP,
        ...(top ? { top: CROP_INSET, borderTop: line } : { bottom: CROP_INSET, borderBottom: line }),
        ...(left ? { left: CROP_INSET, borderLeft: line } : { right: CROP_INSET, borderRight: line }),
      }}
    />
  )
}

/** The Shijima mark at preview size, drawn as an image of `ShijimaMark`'s SVG, as the app icon draws it. */
export function OgMark({ size }: { size: number }) {
  // biome-ignore lint/performance/noImgElement: Satori draws a plain img; next/image does not exist here
  return <img src={markDataUri()} width={size} height={size} alt="" />
}

/** Every preview, as in Agari's `OgFrame`: the dark ground, the crop marks, the wordmark and an eyebrow, the honesty line. */
export function OgFrame({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: OG_PAD,
        background: OG.ground,
        color: OG.ink,
        fontFamily: 'Sora',
      }}
    >
      <Crop at="tl" />
      <Crop at="tr" />
      <Crop at="bl" />
      <Crop at="br" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <OgMark size={40} />
          <div style={{ display: 'flex', fontSize: 30, letterSpacing: '0.22em', color: OG.ink }}>
            {webCopy.brand.name.toUpperCase()}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 18,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: OG.dim,
          }}
        >
          {eyebrow}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>{children}</div>
      <div style={{ display: 'flex', fontSize: 22, letterSpacing: '0.04em', color: OG.dim }}>
        {ogCopy.honesty}
      </div>
    </div>
  )
}
