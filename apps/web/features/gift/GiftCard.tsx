'use client'

import { giftCopy } from '@desk/shared'
import { ChevronRight, ExternalLink, Gift } from 'lucide-react'
import {
  AnimatePresence,
  motion,
  type PanInfo,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { claimGiftAction, type GiftState, giftStateAction } from '@/app/gift-actions'
import { ChainLogo } from '@/components/ui/chain-logo'
import { TokenLogo } from '@/components/ui/token-logo'
import { SESSION_CHANGED_EVENT } from '@/lib/session-events'
import { cn } from '@/lib/utils'

const POLL_MS = 4000
const GIFT_EVENT = 'shijima:gift'

/**
 * The free $1 to try, on 21st's Reward Card (5247): a gift tile and "slide to claim". The handle is also a
 * button, so a keyboard claims with Enter. Once claimed, the card follows the worker's send until the two
 * transfers land, with each one linked on the explorer. Every state has its own line: signed out, all gone, this
 * wallet already claimed, someone on this connection claimed today.
 */
export function GiftCard({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [gift, setGift] = useState<GiftState | null>(null)
  const [why, setWhy] = useState<string | null>(null)
  const [pending, start] = useTransition()

  // Read once, then follow only a claim that is on its way: an idle card has nothing to wait for.
  const moving = gift?.state === 'queued' || gift?.state === 'sending'
  useEffect(() => {
    let stopped = false
    let latest = 0
    const read = () => {
      const request = ++latest
      return giftStateAction()
        .then((g) => !stopped && request === latest && setGift(g))
        .catch(() => undefined)
    }
    read()
    const timer = moving ? setInterval(read, POLL_MS) : undefined
    window.addEventListener(GIFT_EVENT, read)
    window.addEventListener(SESSION_CHANGED_EVENT, read)
    return () => {
      stopped = true
      if (timer) clearInterval(timer)
      window.removeEventListener(GIFT_EVENT, read)
      window.removeEventListener(SESSION_CHANGED_EVENT, read)
    }
  }, [moving])

  // When this card's claim moves, the other gift cards on the page (the sidebar's) read it again.
  const state = gift?.state
  useEffect(() => {
    if (state) window.dispatchEvent(new Event(GIFT_EVENT))
  }, [state])

  const claim = () =>
    start(async () => {
      const r = await claimGiftAction()
      setGift(r.gift)
      setWhy(r.ok ? null : r.why)
    })

  if (!gift) return null
  // Once it has arrived, or when none are left, the sidebar has better things to show.
  if (compact && (gift.state === 'sent' || gift.state === 'all_gone')) return null

  if (compact) {
    return (
      <Link href="/wallet#gift" className={cn('gift-compact', className)}>
        <Gift aria-hidden="true" className="size-4" />
        <span>
          <strong>{giftCopy.title}</strong>
          <small>{gift.state === 'eligible' ? giftCopy.left(gift.left) : gift.line}</small>
        </span>
      </Link>
    )
  }

  const claimable = gift.state === 'eligible' || gift.state === 'failed'
  return (
    <section id="gift" className={cn('gift-card', className)} aria-label={giftCopy.title}>
      <div className="gift-icon" aria-hidden="true">
        <Gift className="size-6" />
      </div>
      <h3 className="gift-title">{giftCopy.title}</h3>
      <p className="gift-pitch">{giftCopy.pitch}</p>
      <div className="mn-gift-inside">
        <span className="mn-gift-chip">
          <TokenLogo symbol="USDG" size={20} />
          {giftCopy.inside.usdg}
        </span>
        <span className="mn-gift-chip">
          <TokenLogo symbol="ETH" size={20} />
          {giftCopy.inside.eth}
        </span>
        <span className="mn-gift-chip">
          <ChainLogo chainId={4663} size={20} />
          {giftCopy.inside.chain}
        </span>
      </div>
      {gift.state === 'eligible' && <p className="gift-left">{giftCopy.left(gift.left)}</p>}

      <AnimatePresence mode="wait" initial={false}>
        {claimable ? (
          <motion.div
            key="slider"
            className="gift-slider-wrap"
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
          >
            <SlideToClaim onClaim={claim} disabled={pending} />
          </motion.div>
        ) : (
          <motion.div key="state" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <p className={cn('gift-state', gift.state === 'sent' && 'is-done')}>{gift.line}</p>
            {'note' in gift && gift.note ? <p className="gift-note">{gift.note}</p> : null}
            {'usdgTx' in gift && (gift.usdgTx || gift.ethTx) ? (
              <p className="gift-txs">
                {gift.usdgTx && (
                  <a href={gift.usdgTx} target="_blank" rel="noreferrer noopener">
                    <ExternalLink aria-hidden="true" className="size-3" /> {giftCopy.usdgTx}
                  </a>
                )}
                {gift.ethTx && (
                  <a href={gift.ethTx} target="_blank" rel="noreferrer noopener">
                    <ExternalLink aria-hidden="true" className="size-3" /> {giftCopy.ethTx}
                  </a>
                )}
              </p>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
      {why && <p className="gift-why">{why}</p>}
    </section>
  )
}

function SlideToClaim({ onClaim, disabled }: { onClaim: () => void; disabled: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const handle = useRef<HTMLButtonElement>(null)
  const [room, setRoom] = useState(0)
  const x = useMotionValue(0)
  const reduce = useReducedMotion()
  const fade = useTransform(x, [0, 60], [1, 0])

  useEffect(() => {
    const measure = () => setRoom((track.current?.offsetWidth ?? 0) - (handle.current?.offsetWidth ?? 0))
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const end = (_: unknown, info: PanInfo) => {
    if (info.offset.x > room * 0.8) onClaim()
    else x.set(0)
  }

  return (
    <div ref={track} className="gift-slider">
      <motion.button
        ref={handle}
        type="button"
        className="gift-handle"
        aria-label={giftCopy.cta}
        disabled={disabled}
        drag={disabled || reduce ? false : 'x'}
        dragConstraints={{ left: 0, right: room }}
        dragElastic={0.08}
        style={{ x }}
        onDragEnd={end}
        onClick={onClaim}
      >
        <ChevronRight aria-hidden="true" className="size-5" />
      </motion.button>
      <motion.span className="gift-slider-text" style={{ opacity: fade }} aria-hidden="true">
        {giftCopy.slide}
      </motion.span>
    </div>
  )
}
