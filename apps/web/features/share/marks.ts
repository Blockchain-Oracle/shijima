/**
 * The Stock Token's disc on the share card, ported from Agari (`features/share/marks.ts`): the brand circle, the
 * white glyph as a `Path2D` placed by the same `glyphBox()` numbers the page's SVG uses, or the typed monogram
 * for a fund. The brand colour is read from the page's own token, so the card and the page never disagree.
 */
import { glyphBox, MARK_GLYPHS, MONOGRAM_UNITS } from '@/features/markets/mark-paths'
import { BRANDS } from '@/features/markets/marks'
import { type CardFonts, cssVar, font } from './canvas'

export const CARD_MARK = 56
/** Between the mark and the eyebrow beside it. */
export const CARD_MARK_GAP = 16

const INK = 'rgb(255 255 255)'
const RING = 'rgba(255,255,255,0.22)'
const NEUTRAL_DISC = 'rgba(255,255,255,0.1)'

export function drawAssetMark(
  ctx: CanvasRenderingContext2D,
  symbol: string,
  x: number,
  y: number,
  size: number,
  fonts: CardFonts,
): void {
  const brand = BRANDS[symbol]
  const glyph = brand ? MARK_GLYPHS[brand.slug] : undefined
  const u = size / 32
  const cx = x + size / 2
  const cy = y + size / 2

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
  ctx.fillStyle = brand ? cssVar(`--brand-${brand.slug}`, NEUTRAL_DISC) : NEUTRAL_DISC
  ctx.fill()
  if (glyph?.ring) {
    ctx.beginPath()
    ctx.arc(cx, cy, size / 2 - u / 2, 0, Math.PI * 2)
    ctx.strokeStyle = RING
    ctx.lineWidth = u
    ctx.stroke()
  }

  ctx.fillStyle = INK
  if (glyph) {
    const { k, x0, y0 } = glyphBox(glyph)
    ctx.translate(x + x0 * u, y + y0 * u)
    ctx.scale(k * u, k * u)
    ctx.fill(new Path2D(glyph.d))
  } else {
    ctx.font = font(800, MONOGRAM_UNITS * u, fonts.display)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(brand?.monogram ?? symbol.slice(0, 1).toUpperCase(), cx, cy + u * 0.5)
  }
  ctx.restore()
}
