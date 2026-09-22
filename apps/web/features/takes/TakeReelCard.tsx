'use client'

import { takesCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { type CSSProperties, memo } from 'react'
import { AssetDisc } from '@/features/markets/marks'
import {
  captionParts,
  shortAddress,
  type TakeView,
  TOKEN_BY_SYMBOL,
  timeAgo,
} from '@/features/social/protocol'
import { addressHue } from '@/lib/address-hue'

const stockHref = (symbol: string) => `/stock/${symbol}` as Route

/** The caption with each approved `$TICKER` as a link to its stock; any other `$` word stays text. */
function Caption({ caption }: { caption: string }) {
  return (
    <p className="take-caption">
      {captionParts(caption).map((part, index) =>
        'symbol' in part ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts of one caption never reorder
          <Link key={index} href={stockHref(part.symbol)} className="take-cashtag" data-cursor="hover">
            {part.text}
          </Link>
        ) : (
          part.text
        ),
      )}
    </p>
  )
}

/**
 * A take as a full-screen reel card, from Agari (`features/takes/TakeReelCard.tsx`): the caption, the human
 * voice, is the hero; the stock frames it; who wrote it grounds it. There is no call and no other side to take:
 * the chip names the stock, and the badge says only what the server checked, that the author's desk held it.
 */
export const TakeReelCard = memo(function TakeReelCard({ take, nowMs }: { take: TakeView; nowMs: number }) {
  const token = TOKEN_BY_SYMBOL.get(take.symbol)
  const name = token?.displayName ?? take.symbol
  return (
    <article className="reel-card take-card">
      <div aria-hidden className="reel-grain" />
      <div aria-hidden className="reel-heat" />

      <div className="take-author">
        <div className="take-ident">
          <span
            aria-hidden
            className="take-avatar"
            style={{ '--take-hue': addressHue(take.author) } as CSSProperties}
          />
          <div className="min-w-0">
            <span className="take-name" title={take.author}>
              {shortAddress(take.author)}
            </span>
            <div className="take-meta">{nowMs > 0 ? timeAgo(take.createdAtMs, nowMs) : ''}</div>
          </div>
        </div>
        <span className="take-badge" data-backed={take.holds}>
          {take.holds ? takesCopy.holdsBadge : takesCopy.noBadge}
        </span>
      </div>

      <div className="take-chip-row">
        <span className="take-chip">
          <AssetDisc symbol={take.symbol} className="take-chip-mark" />
          <span className="take-chip-band">
            <Link href={stockHref(take.symbol)} className="take-cashtag take-chip-tag" data-cursor="hover">
              ${take.symbol}
            </Link>{' '}
            {name}
          </span>
        </span>
      </div>

      <div className="take-voice">
        <Caption caption={take.caption} />
      </div>

      <div className="take-foot">
        <div className="take-prov">
          <Link
            href={`${stockHref(take.symbol)}#room` as Route}
            className="take-prov-room"
            data-cursor="hover"
          >
            {takesCopy.room}
          </Link>
        </div>
        <Link href={stockHref(take.symbol)} className="take-cta" data-cursor="hover">
          {takesCopy.seeStock(name)}
        </Link>
      </div>
    </article>
  )
})
