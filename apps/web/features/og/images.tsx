import { ogCopy } from '@desk/shared'
import { ImageResponse } from 'next/og'
import { ogFonts } from './fonts'
import { OgFrame } from './OgFrame'
import { OG, OG_SIZE } from './theme'

const HEADLINE = { display: 'flex', fontSize: 84, lineHeight: 1, letterSpacing: '-0.035em' } as const

/** The site preview: the promise in two lines. The wordmark above carries the mark. */
export async function siteImage(): Promise<ImageResponse> {
  const s = ogCopy.site
  return new ImageResponse(
    <OgFrame eyebrow={s.eyebrow}>
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ ...HEADLINE, fontSize: 76, color: OG.ink }}>{s.lead}</div>
        <div style={{ ...HEADLINE, fontSize: 76, color: OG.vermilion, marginTop: 8 }}>{s.em}</div>
        <div style={{ display: 'flex', marginTop: 32, fontSize: 30, color: OG.soft, maxWidth: 820 }}>
          {s.line}
        </div>
      </div>
    </OgFrame>,
    { ...OG_SIZE, fonts: await ogFonts() },
  )
}

/** A card with a title and up to two facts under it: a shared desk, or one Stock Token. */
export async function factImage(input: {
  eyebrow: string
  title: string
  subtitle?: string
  fact?: { text: string; tone?: 'up' | 'down' }
  note?: string
}): Promise<ImageResponse> {
  return new ImageResponse(
    <OgFrame eyebrow={input.eyebrow}>
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ ...HEADLINE, color: OG.ink }}>{input.title}</div>
        {input.subtitle && (
          <div style={{ display: 'flex', marginTop: 16, fontSize: 34, color: OG.soft }}>{input.subtitle}</div>
        )}
        {input.fact && (
          <div
            style={{
              display: 'flex',
              marginTop: 36,
              fontSize: 44,
              color: input.fact.tone === 'up' ? OG.up : input.fact.tone === 'down' ? OG.down : OG.ink,
            }}
          >
            {input.fact.text}
          </div>
        )}
        {input.note && (
          <div style={{ display: 'flex', marginTop: 12, fontSize: 26, color: OG.dim }}>{input.note}</div>
        )}
      </div>
    </OgFrame>,
    { ...OG_SIZE, fonts: await ogFonts() },
  )
}
