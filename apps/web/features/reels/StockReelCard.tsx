'use client'

import { ago, comparedTo, reelsCopy, signedPercent } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { memo } from 'react'
import { AssetDisc } from '@/features/markets/marks'
import { PriceChart } from '@/features/markets/PriceChart'
import type { StockReel } from './types'

/**
 * One Stock Token as a framed portrait card, on Agari's reel card (`ReelCard`, `ReelHead`, `ReelQuestion`): the
 * fact, the price, the line, and two ways out. Agari asks "will it be above the line?" and offers UP and DOWN;
 * there is nothing to bet on here, so the head states where the pool sits against its reference, and the call
 * row opens the stock or a take about it. Every number is the price log's, as on /markets.
 *
 * The chart mounts only for the card on screen and its neighbours (`near`), as in Agari.
 */
export const StockReelCard = memo(function StockReelCard({
  reel,
  near,
  onTake,
}: {
  reel: StockReel
  near: boolean
  onTake: (symbol: string) => void
}) {
  const { token, points } = reel
  const compared = token.gapBps === null ? null : comparedTo(token.gapBps)
  const [lead, tail] =
    compared === null || compared === 'in line'
      ? [reelsCopy.gapHead(token.name, compared ?? 'in line'), null]
      : [`${token.name} is`, compared]
  return (
    <article className="reel-card">
      <div aria-hidden className="reel-grain" />
      <div aria-hidden className="reel-heat" />

      <div className="reel-head">
        <div className="reel-ident">
          <AssetDisc symbol={token.symbol} className="reel-badge" />
          <div>
            <div className="reel-meta">{reelsCopy.stockMeta(token.name)}</div>
            <div className="reel-submeta">{reelsCopy.priced(ago(new Date(token.at)))}</div>
          </div>
        </div>
        <div className="reel-clock">
          <span className="reel-clock-label">{reelsCopy.versusReference}</span>
          <span className="reel-clock-value">
            {token.gapBps === null ? '—' : signedPercent(token.gapBps)}
          </span>
        </div>
      </div>

      <div className="reel-ask">
        <h2 className="reel-question">
          {tail === null ? (
            lead
          ) : (
            <>
              {lead} <span className="reel-question-line">{tail}</span> its reference
            </>
          )}
        </h2>
        <div className="reel-spot">
          <span>{token.price === null ? reelsCopy.noPrice : `$${token.price.toFixed(2)}`}</span>
          <span className="reel-spot-label">{reelsCopy.poolPrice}</span>
        </div>
      </div>

      <div className="reel-chart">
        {near && points.length > 1 ? (
          <PriceChart
            points={points}
            referenceLabel="ref"
            ariaLabel={`${token.name}: ${lead}${tail ? ` ${tail} its reference` : ''}`}
            className="h-full w-full"
          />
        ) : (
          <p className="reel-chart-holding">{reelsCopy.referenceRule}</p>
        )}
      </div>

      <div className="reel-call">
        <div className="reel-call-pair">
          <Link href={`/stock/${token.symbol}` as Route} className="reel-side up" data-cursor="hover">
            {reelsCopy.seeStock}
          </Link>
          <button
            type="button"
            className="reel-side down"
            onClick={() => onTake(token.symbol)}
            data-cursor="hover"
          >
            {reelsCopy.postTake}
          </button>
        </div>
      </div>
    </article>
  )
})
