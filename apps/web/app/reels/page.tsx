import { latestTakes } from '@desk/db'
import { reelsCopy } from '@desk/shared'
import type { Metadata } from 'next'
import { ErrorState } from '@/components/states'
import { ReelsScreen } from '@/features/reels/ReelsScreen'
import type { DecisionReel, StockReel } from '@/features/reels/types'
import { currentMember } from '@/features/social/member.server'
import { TAKES_FEED_LIMIT, type TakeView } from '@/features/social/protocol'
import { db } from '@/lib/db'
import { loadMarkets } from '@/lib/markets.server'

export const metadata: Metadata = { title: reelsCopy.title }
export const dynamic = 'force-dynamic'

/** How many shared decisions the reel weaves in, newest first. */
const DECISIONS = 12

/**
 * Reels (FIDELITY L-42 to L-45): the markets page's own reads, the ten Stock Tokens and what shared desks decided,
 * woven with takes. The takes then refresh in the browser.
 */
export default async function ReelsPage() {
  let view: Awaited<ReturnType<typeof loadMarkets>>
  let takes: TakeView[]
  let member: Awaited<ReturnType<typeof currentMember>>
  try {
    ;[view, takes, member] = await Promise.all([
      loadMarkets(undefined, '1W'),
      latestTakes(db(), { limit: TAKES_FEED_LIMIT }).then((rows) =>
        rows.map((r) => ({
          id: r.id,
          author: r.author,
          symbol: r.symbol,
          caption: r.caption,
          tags: r.tags,
          holds: r.holds,
          createdAtMs: r.createdAt.getTime(),
        })),
      ),
      currentMember(),
    ])
  } catch (e) {
    return (
      <div className="container py-12">
        <ErrorState
          diagnosis={{ kind: 'desk-unreachable', technical: e instanceof Error ? e.message : String(e) }}
        />
      </div>
    )
  }
  // The furthest from its reference first, so the reel opens on the stock with the most to say.
  const byGap = [...view.tokens].sort((a, b) => Math.abs(b.gapBps ?? 0) - Math.abs(a.gapBps ?? 0))
  const stocks: StockReel[] = byGap.map((t) => ({
    token: {
      symbol: t.symbol,
      name: t.name,
      price: t.price,
      reference: t.reference,
      referenceKind: t.referenceKind,
      gapBps: t.gapBps,
      costBps100: t.costBps100,
      costBps1000: t.costBps1000,
      halted: t.halted,
      at: t.at.toISOString(),
    },
    points: view.sparks[t.symbol] ?? [],
  }))
  const decisions: DecisionReel[] = view.marks
    .slice(-DECISIONS)
    .reverse()
    .map((mark) => ({ mark, points: view.sparks[mark.symbol] ?? [] }))
  return (
    <ReelsScreen
      stocks={stocks}
      decisions={decisions}
      initialTakes={takes}
      viewer={member.kind === 'member' ? 'member' : member.kind === 'signed_out' ? 'signed_out' : 'no_desk'}
    />
  )
}
