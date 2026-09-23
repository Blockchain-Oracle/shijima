/**
 * The share card's words for one decision, from the record, its grade and its transaction alone. Server side:
 * the browser only draws what this returns (decision-card.ts).
 */
import { APPROVED_TOKENS } from '@desk/chain'
import type { DecisionInFull, PublicDesk } from '@desk/db'
import {
  comparedTo,
  money,
  newYorkTime,
  percent,
  type RecordView,
  shareCopy,
  short,
  webCopy,
} from '@desk/shared'
import type { DecisionCard } from './decision-card'

const GRADABLE = new Set([
  'acted',
  'acted_in_part',
  'acted_by_override',
  'would_have_acted',
  'waited',
  'declined',
])

function heroOf(outcome: string, side: string | undefined): string {
  const h = shareCopy.hero
  if (outcome === 'acted') return side && side in h.acted ? h.acted[side as keyof typeof h.acted] : 'Acted.'
  if (outcome === 'would_have_acted')
    return side === 'buy' || side === 'sell' ? h.would_have_acted[side] : 'Would have acted.'
  const plain = h[outcome as Exclude<keyof typeof h, 'acted' | 'would_have_acted'>]
  return typeof plain === 'string' ? plain : 'Decided.'
}

/** The card's words, from the record alone. Server side. */
export function decisionCard(
  desk: PublicDesk,
  full: DecisionInFull,
  body: RecordView | undefined,
): DecisionCard {
  const { decision, actions, grade } = full
  const c = body?.candidate ?? null
  const vault = c?.side === 'sweep' || c?.side === 'redeem'
  const token =
    c && !vault ? APPROVED_TOKENS.find((t) => t.address.toLowerCase() === c.token.toLowerCase()) : undefined
  const when = newYorkTime(new Date(decision.decidedAt))
  const session = body?.session
    ? webCopy.session.words[body.session.session as keyof typeof webCopy.session.words]
    : null
  const hero = heroOf(decision.outcome, c?.side)

  const counted = body?.gate && body.gate.countedUsdg !== '0' ? money(body.gate.countedUsdg) : null
  const size = counted ?? (c?.side === 'buy' ? money(c.amountIn) : null)
  const sub = vault
    ? c?.side === 'sweep'
      ? shareCopy.intoVault(
          money(c.amountIn),
          body?.vault?.netApyBps == null ? null : percent(body.vault.netApyBps, 2),
        )
      : shareCopy.outOfVault(money(body?.preview?.expectedOut ?? '0'))
    : decision.outcome === 'nothing_to_do'
      ? shareCopy.withinRange
      : [
          size && c ? shareCopy.size(size, c.side) : null,
          body?.price ? shareCopy.gap(comparedTo(body.price.gapBps)) : null,
          decision.confidencePercent === null ? null : shareCopy.sure(decision.confidencePercent),
        ]
          .filter(Boolean)
          .join(' · ')

  const gradePct = grade ? percent(Math.abs(grade.differenceBps ?? 0), 2) : ''
  const kind = vault
    ? shareCopy.graded.never
    : grade
      ? grade.verdict === 'better' || grade.verdict === 'worse'
        ? shareCopy.graded[grade.verdict](gradePct)
        : shareCopy.graded[grade.verdict]
      : GRADABLE.has(decision.outcome)
        ? shareCopy.graded.pending
        : ''
  const tweetGrade =
    grade && grade.verdict !== 'ungradable'
      ? grade.verdict === 'no_real_difference'
        ? shareCopy.tweetGrade.no_real_difference
        : shareCopy.tweetGrade[grade.verdict](gradePct)
      : null

  const tx = actions.find((a) => a.status === 'confirmed' && a.txHash)?.txHash ?? decision.sealedByTx
  const proof = [
    shareCopy.proof.record(short(decision.recordHash, 10, 6)),
    tx ? shareCopy.proof.tx(short(tx, 10, 6)) : shareCopy.proof.sealedLater,
  ].join(' · ')
  const slug = desk.shareSlug ?? 'desk'
  const name = vault ? 'the savings vault' : (token?.displayName ?? null)

  return {
    folio: `${slug.toUpperCase()}-${decision.seq}`,
    path: `/agents/${slug}/decision/${decision.seq}`,
    fileName: `shijima-${slug}-${decision.seq}.png`,
    symbol: token?.symbol ?? null,
    label: [
      vault ? shareCopy.vault : token?.displayName.toUpperCase(),
      session?.toUpperCase(),
      when.toUpperCase(),
    ]
      .filter(Boolean)
      .join(' · '),
    hero,
    sub,
    kind,
    tone: grade?.verdict === 'better' ? 'better' : grade?.verdict === 'worse' ? 'worse' : 'plain',
    proof,
    mode: shareCopy.mode[decision.mode],
    tweetParts: [desk.name ?? 'A Shijima desk', name, hero.replace(/\.$/, ''), when].filter(
      (p): p is string => Boolean(p),
    ),
    tweetGrade,
  }
}
