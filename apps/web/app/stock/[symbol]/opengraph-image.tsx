import { APPROVED_TOKENS } from '@desk/chain'
import { IN_LINE_BPS } from '@desk/core'
import { ago, ogCopy } from '@desk/shared'
import { factImage, siteImage } from '@/features/og/images'
import { OG_CONTENT_TYPE, OG_SIZE } from '@/features/og/theme'
import { tokensNow } from '@/lib/markets.server'

export const runtime = 'nodejs'
export const alt = ogCopy.stock.alt
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

/** One Stock Token's preview: its pool price against its reference, and how old that reading is. */
export default async function Image({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params
  const token = APPROVED_TOKENS.find((t) => t.symbol === symbol.toUpperCase())
  if (!token) return siteImage()
  const now = (await tokensNow().catch(() => [])).find((t) => t.symbol === token.symbol)
  const s = ogCopy.stock
  const gap = now?.gapBps ?? null
  return factImage({
    eyebrow: s.eyebrow,
    title: token.symbol,
    subtitle: token.displayName,
    ...(gap === null
      ? {}
      : {
          fact:
            Math.abs(gap) < IN_LINE_BPS
              ? { text: s.inLine }
              : {
                  text: s.gap(`${(Math.abs(gap) / 100).toFixed(1)}%`, gap > 0 ? 'above' : 'below'),
                  tone: gap > 0 ? ('up' as const) : ('down' as const),
                },
        }),
    note: now ? s.priced(ago(now.at)) : s.noPrice,
  })
}
