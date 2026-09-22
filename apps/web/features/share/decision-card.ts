/**
 * The share card for one decision, drawn on Agari's ticket (`trade-card.ts`, laid out as the 16:9 banner).
 *
 * `decisionCard` (card-data.ts) runs on the server and turns a record into the card's words; `renderDecisionCard`
 * runs in the browser and only draws them. The outcome in words is the focal line.
 *
 * HONESTY (hard rules, do not relax):
 *  · Every word comes from the record, its grade and its transaction. Nothing is estimated for the card.
 *  · No headline text, ever: the news licence forbids passing it on. Only the facts the record holds.
 *  · ONE SPARK: vermilion appears only when the grade after the reopen came out better than acting at once, and
 *    only on the focal line. A worse grade is drained ash, never red. An ungraded decision is plain.
 *  · The QR and the post link to the decision's own public page, where anyone can check the fingerprint.
 */
import { shareCopy } from '@desk/shared'
import {
  CARD_H,
  CARD_MARGIN,
  CARD_W,
  closeCard,
  drawFooter,
  drawMasthead,
  drawPerforation,
  drawTracked,
  ensureFont,
  fitFontPx,
  font,
  openCard,
  RECORD_RIGHT,
  RECORD_W,
  resolveFonts,
  resolvePalette,
} from './canvas'
import { CARD_MARK, CARD_MARK_GAP, drawAssetMark } from './marks'
import { drawStub, encodeQr } from './stub'

export interface DecisionCard {
  folio: string
  /** The decision's public page, joined to the site's own origin in the browser. */
  path: string
  fileName: string
  /** A Stock Token's symbol, for its disc. null for a vault move, which gets no disc. */
  symbol: string | null
  label: string
  hero: string
  sub: string
  kind: string
  tone: 'better' | 'worse' | 'plain'
  proof: string
  mode: string
  tweetParts: string[]
  tweetGrade: string | null
}

/** Baselines down the record panel, and where the heat sits behind the focal line. */
const LABEL_Y = 330
const HERO_Y = 500
const SUB_Y = 596
const KIND_Y = 648
const HEAT_CX = (CARD_MARGIN + RECORD_RIGHT) / 2
const HEAT_CY = 460

export function decisionTweet(card: DecisionCard, url: string): string {
  return shareCopy.tweet(card.tweetParts, card.tweetGrade, url)
}

/** Draws the card. Browser only. */
export async function renderDecisionCard(card: DecisionCard, url: string): Promise<Blob> {
  const fonts = resolveFonts()
  const palette = resolvePalette()
  const { vermilion, verm, ground, ash } = palette
  const site = new URL(url).host
  const qr = encodeQr(url)

  await Promise.all([
    ensureFont(font(800, 160, fonts.display), card.hero),
    ensureFont(font(800, 30, fonts.display), `${shareCopy.brand}${site}`),
    ensureFont(font(600, 17, fonts.mono)),
    ensureFont(font(500, 24, fonts.mono), card.sub),
    ensureFont(font(400, 19, fonts.mono)),
  ])

  const { canvas, ctx } = openCard(ground, 0.3, 0.42)

  // Heat behind the focal line only when the grade came out better; a faint lamp otherwise.
  const heat = ctx.createRadialGradient(HEAT_CX, HEAT_CY, 60, HEAT_CX, HEAT_CY, 620)
  if (card.tone === 'better') {
    heat.addColorStop(0, verm(0.14))
    heat.addColorStop(0.55, verm(0.05))
    heat.addColorStop(1, 'rgba(0,0,0,0)')
  } else {
    heat.addColorStop(0, 'rgba(255,250,240,0.045)')
    heat.addColorStop(1, 'rgba(0,0,0,0)')
  }
  ctx.fillStyle = heat
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  drawMasthead(ctx, fonts, shareCopy.brand, card.folio, shareCopy.recordType)

  // The Stock Token's disc with the label beside it, centred on the label's caps. A vault move has no disc.
  let labelX = CARD_MARGIN
  if (card.symbol) {
    drawAssetMark(ctx, card.symbol, CARD_MARGIN, LABEL_Y - 6 - CARD_MARK / 2, CARD_MARK, fonts)
    labelX = CARD_MARGIN + CARD_MARK + CARD_MARK_GAP
  }
  ctx.font = font(600, 17, fonts.mono)
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  drawTracked(ctx, card.label, labelX, LABEL_Y, 5, 'left')

  const heroPx = fitFontPx(ctx, card.hero, fonts.display, 800, 160, RECORD_W, 60)
  ctx.font = font(800, heroPx, fonts.display)
  ctx.textAlign = 'left'
  if (card.tone === 'better') {
    ctx.save()
    ctx.shadowColor = verm(0.55)
    ctx.shadowBlur = 150
    ctx.fillStyle = verm(0.9)
    ctx.fillText(card.hero, CARD_MARGIN, HERO_Y)
    ctx.shadowBlur = 48
    ctx.fillText(card.hero, CARD_MARGIN, HERO_Y)
    ctx.restore()
    ctx.fillStyle = vermilion
  } else {
    ctx.fillStyle = card.tone === 'worse' ? ash : 'rgba(255,255,255,0.94)'
  }
  ctx.fillText(card.hero, CARD_MARGIN, HERO_Y)

  if (card.sub) {
    ctx.font = font(500, fitFontPx(ctx, card.sub, fonts.mono, 500, 24, RECORD_W, 14), fonts.mono)
    ctx.fillStyle = 'rgba(255,255,255,0.82)'
    ctx.fillText(card.sub, CARD_MARGIN, SUB_Y)
  }
  if (card.kind) {
    ctx.font = font(400, fitFontPx(ctx, card.kind, fonts.mono, 400, 19, RECORD_W, 12), fonts.mono)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillText(card.kind, CARD_MARGIN, KIND_Y)
  }

  drawPerforation(ctx)
  drawStub(ctx, fonts, palette, qr, site)
  drawFooter(ctx, fonts, card.proof, shareCopy.verifyOn, card.mode)
  return closeCard(canvas, ctx)
}
