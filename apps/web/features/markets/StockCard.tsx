import { marketsCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import type { Point, TokenNow } from '@/lib/markets.server'
import { cn } from '@/lib/utils'
import { AssetDisc } from './marks'

/** "9h ago", "5m ago": the card's head has room for a short age only. */
function shortAge(at: Date): string {
  const minutes = Math.max(0, Math.round((Date.now() - at.getTime()) / 60_000))
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)}h ago`
  return `${Math.round(minutes / 1440)}d ago`
}

const VIEW_W = 100
const VIEW_H = 40

/**
 * Agari's `CardSpark`: the line fitted to the box, with the dashed rule at the level the card is about. There it
 * was a Window's opening print; here it is the reference. The band is widened to include it, so the rule is read
 * against the line instead of being clamped to an edge.
 */
function Spark({ points, reference }: { points: Point[]; reference: number | null }) {
  if (points.length < 2) return null
  const values = points.map((p) => p.value)
  let low = Math.min(...values)
  let high = Math.max(...values)
  if (reference !== null) {
    low = Math.min(low, reference)
    high = Math.max(high, reference)
  }
  const band = high - low
  const y = (v: number) => (band === 0 ? VIEW_H / 2 : VIEW_H - ((v - low) / band) * VIEW_H)
  const x = (i: number) => (i / (points.length - 1)) * VIEW_W
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`)
    .join(' ')
  const latest = points.at(-1)?.value ?? 0
  const above = reference === null ? latest >= (points[0]?.value ?? 0) : latest >= reference
  const top = reference === null ? null : (y(reference) / VIEW_H) * 100
  return (
    <>
      <svg
        className="mc-spark-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <path className={above ? 'mc-spark-line up' : 'mc-spark-line down'} d={path} />
      </svg>
      {top !== null && (
        <>
          <div className="strike-line" style={{ top: `${top}%` }} aria-hidden />
          <div className="strike-tick" style={{ top: `${top}%` }} aria-hidden>
            {marketsCopy.card.refTick}
          </div>
        </>
      )}
    </>
  )
}

/**
 * One Stock Token in Masayume's rail-card anatomy (`MarketCardView`), with nothing to bet: the pool's price
 * against its reference, a spark line since the reference was set, and what $1,000 costs to trade now. The
 * whole card opens the stock's page.
 */
export function StockCard({ token, points }: { token: TokenNow; points: Point[] }) {
  const gap = token.gapBps
  const move =
    token.price !== null && token.reference !== null
      ? { up: token.price >= token.reference, dollars: Math.abs(token.price - token.reference) }
      : null
  return (
    <Link
      href={`/stock/${token.symbol}` as Route}
      className="market-card sj-stock-card"
      aria-label={marketsCopy.card.open(token.name)}
      data-cursor="hover"
    >
      <div className="mc-head">
        <span className="mc-asset">
          <AssetDisc symbol={token.symbol} className="glyph" />
          <span className="mc-ticker">{token.symbol}</span>
          <span className="mc-cadence">{token.name}</span>
        </span>
        <span className="mc-countdown">
          <span className="clock-dot" aria-hidden />
          <span>{shortAge(token.at)}</span>
        </span>
      </div>
      <div className="mc-body">
        <div className="mc-question">
          {token.reference === null ? token.name : marketsCopy.card.against(`$${token.reference.toFixed(2)}`)}
          {token.halted && <span className="sj-halted"> · {marketsCopy.halted}</span>}
        </div>
        <div className="mc-pricebar">
          <div className="px">
            <span className="big">{token.price === null ? '—' : `$${token.price.toFixed(2)}`}</span>
            {move && (
              <span className={cn('chg', move.up ? 'up' : 'down')}>
                {move.up ? '+' : '−'}${move.dollars.toFixed(2)}
              </span>
            )}
          </div>
        </div>
        <div className="mc-spark">
          <Spark points={points} reference={token.reference} />
        </div>
        <div className="mc-strip">
          <span
            className={cn(gap !== null && Math.abs(gap) >= 50 && (gap > 0 ? 'text-profit' : 'text-loss'))}
          >
            {gap === null ? '—' : marketsCopy.fromReference(gap)}
          </span>
          <span>
            {token.costBps1000 === null
              ? ''
              : marketsCopy.card.cost(`${(token.costBps1000 / 100).toFixed(2)}%`)}
          </span>
        </div>
      </div>
    </Link>
  )
}
