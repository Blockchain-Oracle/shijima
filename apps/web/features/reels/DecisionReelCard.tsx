'use client'

import { newYorkTime, reelsCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { memo, useMemo } from 'react'
import { AssetDisc } from '@/features/markets/marks'
import { PriceChart } from '@/features/markets/PriceChart'
import type { DecisionReel } from './types'

/**
 * What a shared desk decided, as a reel card: the desk's own summary is the hero, and the stock's line carries a
 * marker where it happened, as /markets draws it. The marker is shown only when the decision falls inside the
 * line; one snapped onto the first point would put it at a moment it did not happen.
 */
export const DecisionReelCard = memo(function DecisionReelCard({
  reel,
  near,
}: {
  reel: DecisionReel
  near: boolean
}) {
  const { mark, points } = reel
  const marks = useMemo(() => {
    const t = Math.floor(new Date(mark.at).getTime() / 1000)
    const first = points[0]?.time
    if (first === undefined || t < first) return []
    let snapped = first
    for (const p of points) if (p.time <= t) snapped = p.time
    return [{ ...mark, time: snapped }]
  }, [mark, points])
  return (
    <article className="reel-card">
      <div aria-hidden className="reel-grain" />
      <div aria-hidden className="reel-heat" />

      <div className="reel-head">
        <div className="reel-ident">
          <AssetDisc symbol={mark.symbol} className="reel-badge" />
          <div className="min-w-0">
            <div className="reel-meta">{mark.line}</div>
            <div className="reel-submeta">{newYorkTime(new Date(mark.at))}</div>
          </div>
        </div>
        <div className="reel-clock">
          <span className="reel-clock-label">{mark.kind === 'practice' ? 'practice' : 'decided'}</span>
          <span className="reel-clock-value sj-reel-outcome">{mark.outcome}</span>
        </div>
      </div>

      <div className="reel-ask">
        <h2 className="reel-question sj-reel-summary">{mark.summary}</h2>
      </div>

      <div className="reel-chart">
        {near && points.length > 1 ? (
          <PriceChart
            points={points}
            marks={marks}
            referenceLabel="ref"
            ariaLabel={mark.line}
            className="h-full w-full"
          />
        ) : (
          <p className="reel-chart-holding">{mark.line}</p>
        )}
      </div>

      <div className="reel-call">
        <div className="reel-call-pair">
          <Link href={mark.href as Route} className="reel-side up" data-cursor="hover">
            {reelsCopy.readDecision}
          </Link>
          <Link href={`/stock/${mark.symbol}` as Route} className="reel-side down" data-cursor="hover">
            {reelsCopy.seeStock}
          </Link>
        </div>
      </div>
    </article>
  )
})
