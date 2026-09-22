'use client'

import { reelsCopy } from '@desk/shared'
import { ChevronUpIcon, FeatherIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { TakeView } from '@/features/social/protocol'
import { type SocialViewer, TakeComposer } from '@/features/takes/TakeComposer'
import { TakeReelCard } from '@/features/takes/TakeReelCard'
import { useTakes } from '@/features/takes/useTakes'
import { DecisionReelCard } from './DecisionReelCard'
import { ReelHolding } from './ReelHolding'
import { StockReelCard } from './StockReelCard'
import type { DecisionReel, StockReel } from './types'
import { useActiveReel } from './useActiveReel'

/** A real move, not the first stray pixel of momentum: Agari's own correction. */
const SCROLLED_PX = 60
const MINUTE_MS = 60_000

type ReelItem =
  | { kind: 'stock'; reel: StockReel }
  | { kind: 'take'; take: TakeView }
  | { kind: 'decision'; reel: DecisionReel }

/**
 * Agari's `weaveReel`: one stream, starting on a stock so the first card is something to read, then a take, then a
 * decision, round and round, then whichever list has a tail.
 */
function weave(stocks: StockReel[], takes: TakeView[], decisions: DecisionReel[]): ReelItem[] {
  const out: ReelItem[] = []
  const max = Math.max(stocks.length, takes.length, decisions.length)
  for (let i = 0; i < max; i += 1) {
    const stock = stocks[i]
    const take = takes[i]
    const decision = decisions[i]
    if (stock) out.push({ kind: 'stock', reel: stock })
    if (take) out.push({ kind: 'take', take })
    if (decision) out.push({ kind: 'decision', reel: decision })
  }
  return out
}

/**
 * The reel, from Agari (`features/markets/reels/ReelsScreen.tsx`): a full-screen vertical snap feed. Agari's is
 * live Windows to bet on and the takes people posted about them. Ours is the ten Stock Tokens, what shared desks
 * decided, and takes, with nothing to bet on: every card leads to the page its numbers come from.
 */
export function ReelsScreen({
  stocks,
  decisions,
  initialTakes,
  viewer,
}: {
  stocks: StockReel[]
  decisions: DecisionReel[]
  initialTakes: TakeView[]
  viewer: SocialViewer
}) {
  const takes = useTakes(initialTakes)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [composer, setComposer] = useState<string | null>(null)
  const [minuteMs, setMinuteMs] = useState(0)
  const reel = useMemo(() => weave(stocks, takes, decisions), [stocks, takes, decisions])
  const { register, isNear, activeIndex } = useActiveReel(scrollRef, reel.length)

  // A take's age prints at a minute's grain, so the cards get the clock at that grain and re-render once a minute.
  useEffect(() => {
    const tick = () => setMinuteMs(Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS)
    tick()
    const id = setInterval(tick, MINUTE_MS)
    return () => clearInterval(id)
  }, [])

  // ↑/↓ and PageUp/PageDown move one card, as a thumb would (Agari's `useReelPosition`), and stay out of text fields.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const root = scrollRef.current
      if (!root || event.altKey || event.metaKey || event.ctrlKey || composer !== null) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable))
        return
      const step =
        event.key === 'ArrowDown' || event.key === 'PageDown'
          ? 1
          : event.key === 'ArrowUp' || event.key === 'PageUp'
            ? -1
            : 0
      if (step === 0) return
      event.preventDefault()
      root.scrollBy({ top: step * root.clientHeight, behavior: 'smooth' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [composer])

  const active = reel[activeIndex]
  const activeSymbol =
    active?.kind === 'stock'
      ? active.reel.token.symbol
      : active?.kind === 'take'
        ? active.take.symbol
        : (active?.reel.mark.symbol ?? 'NVDA')

  return (
    <>
      <div
        ref={scrollRef}
        className="reel-page feed-snap"
        onScroll={(event) => {
          if (event.currentTarget.scrollTop > SCROLLED_PX) setScrolled(true)
        }}
      >
        {reel.length === 0 ? (
          <ReelHolding>{reelsCopy.nothing}</ReelHolding>
        ) : (
          reel.map((item, index) => (
            <section
              key={
                item.kind === 'stock'
                  ? `stock-${item.reel.token.symbol}`
                  : item.kind === 'take'
                    ? `take-${item.take.id}`
                    : `decision-${item.reel.mark.id}`
              }
              ref={register(index)}
              className="feed-card reel-slot"
            >
              {item.kind === 'stock' ? (
                <StockReelCard reel={item.reel} near={isNear(index)} onTake={setComposer} />
              ) : item.kind === 'take' ? (
                <TakeReelCard take={item.take} nowMs={minuteMs} />
              ) : (
                <DecisionReelCard reel={item.reel} near={isNear(index)} />
              )}
            </section>
          ))
        )}
      </div>

      {reel.length > 0 && (
        <>
          {/* The social entry point, on the right rail mid-card so it never covers a card's action row. */}
          <button
            type="button"
            className="reel-take"
            onClick={() => setComposer(activeSymbol)}
            aria-label={reelsCopy.postTake}
            data-cursor="hover"
          >
            <FeatherIcon size={24} aria-hidden />
            <span>{reelsCopy.take}</span>
          </button>

          {/* Nothing else on screen says this is a snap scroll, so a viewer who does not swipe sees one card. */}
          <div aria-hidden className="reel-hint" data-scrolled={scrolled}>
            <ChevronUpIcon size={20} strokeWidth={3} className="reel-hint-arrow" />
            <span className="reel-hint-pill">{reelsCopy.swipeHint}</span>
          </div>
        </>
      )}

      {composer !== null && (
        <TakeComposer viewer={viewer} initialSymbol={composer} onClose={() => setComposer(null)} />
      )}
    </>
  )
}
