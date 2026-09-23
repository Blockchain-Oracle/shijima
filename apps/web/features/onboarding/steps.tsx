'use client'

import { firstRunCopy as C, short } from '@desk/shared'
import { ArrowDownToLine, Bot, Check, Gift, LockKeyhole, Wallet } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { type GiftState, giftStateAction } from '@/app/gift-actions'
import { Callout } from '@/components/kit'
import { ShijimaMark } from '@/components/shell/ShijimaMark'
import { SignInButton } from '@/components/shell/SignInButton'
import { GiftCard } from '@/features/gift/GiftCard'

/** The words every step leads with: a title and one line under it, rising in as the reference's slides do. */
function Words({ title, sub, tag }: { title: string; sub: string; tag?: string }) {
  return (
    <div className="first-run-words">
      <h2 className="first-run-title">{title}</h2>
      <p className="first-run-sub">{sub}</p>
      {tag ? <p className="first-run-tag">{tag}</p> : null}
    </div>
  )
}

/** The same stage for the later steps: one icon on the tile, no rings. */
function Tile({ children }: { children: ReactNode }) {
  return (
    <span className="first-run-hero first-run-hero--small" aria-hidden="true">
      <span className="first-run-coin">{children}</span>
    </span>
  )
}

/** The reference's BrandHero: the mark pops in with two halo rings behind it. */
export function WelcomeStep() {
  return (
    <div className="first-run-step">
      <span className="first-run-hero" aria-hidden="true">
        <span className="first-run-ring" style={{ animationDelay: '0.15s' }} />
        <span className="first-run-ring" style={{ animationDelay: '1s' }} />
        <span className="first-run-coin">
          <ShijimaMark />
        </span>
      </span>
      <Words title={C.welcome.title} sub={C.welcome.sub} tag={C.welcome.tag} />
    </div>
  )
}

const BEAT_ICONS = [ArrowDownToLine, Bot, LockKeyhole]

/** Money in, the agent trades, only you take it out: the reference's balance rows, one per beat. */
export function HowStep() {
  return (
    <div className="first-run-step">
      <Words title={C.how.title} sub={C.how.sub} />
      <ol className="first-run-beats">
        {C.how.beats.map((beat, i) => {
          const Icon = BEAT_ICONS[i] ?? Bot
          return (
            <li key={beat.label} className="first-run-beat" style={{ animationDelay: `${0.18 + i * 0.1}s` }}>
              <span className="first-run-beat-icon" aria-hidden="true">
                <Icon />
              </span>
              <span className="first-run-beat-words">
                <span className="first-run-beat-top">
                  <strong>{beat.label}</strong>
                  <em>{beat.tag}</em>
                </span>
                <span className="first-run-beat-note">{beat.note}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Connected({ address }: { address: string }) {
  return (
    <span className="first-run-connected">
      <Check aria-hidden="true" className="size-4" />
      {C.connect.connected}
      <code>{short(address, 6, 4)}</code>
    </span>
  )
}

/** The header's own sign-in button; once the session exists the step shows the wallet instead. */
export function ConnectStep({ signedInAs }: { signedInAs: string | undefined }) {
  return (
    <div className="first-run-step">
      <Tile>
        <Wallet />
      </Tile>
      <Words title={C.connect.title} sub={C.connect.sub} />
      <div className="first-run-panel">
        {signedInAs ? <Connected address={signedInAs} /> : <SignInButton className="first-run-signin" />}
        <p className="first-run-fine">{C.connect.region}</p>
      </div>
    </div>
  )
}

const GIFT_EVENT = 'shijima:gift'
const DONE: ReadonlyArray<GiftState['state']> = ['queued', 'sending', 'sent']

/**
 * The free $1: the wallet page's own gift card does the claiming. This step reads the same state to say how many
 * are left before sign-in, and to offer funding from any token once the gift is claimed or gone.
 */
export function GiftStep({ signedInAs, onFund }: { signedInAs: string | undefined; onFund: () => void }) {
  const [gift, setGift] = useState<GiftState | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new session changes what the gift state says.
  useEffect(() => {
    let stopped = false
    const read = () =>
      giftStateAction()
        .then((g) => !stopped && setGift(g))
        .catch(() => undefined)
    read()
    window.addEventListener(GIFT_EVENT, read)
    return () => {
      stopped = true
      window.removeEventListener(GIFT_EVENT, read)
    }
  }, [signedInAs])

  const fund = (
    <Link href={'/fund' as Route} className="first-run-signin" onClick={onFund}>
      {C.gift.fund}
    </Link>
  )
  const gone = gift?.state === 'all_gone' || (gift?.state === 'signed_out' && gift.left === 0)
  const claimed = gift ? DONE.includes(gift.state) : false

  return (
    <div className="first-run-step">
      {signedInAs ? null : (
        <Tile>
          <Gift />
        </Tile>
      )}
      <Words title={C.gift.title} sub={C.gift.sub} />
      <div className="first-run-panel">
        {gift && !gone && gift.state === 'signed_out' ? (
          <>
            <p className="first-run-left">{C.gift.left(gift.left)}</p>
            <p className="first-run-fine">{C.gift.connectFirst}</p>
            <SignInButton className="first-run-signin" />
          </>
        ) : null}
        {signedInAs && !gone ? <GiftCard /> : null}
        {gone ? (
          <>
            <Callout tone="warn">{C.gift.allGone}</Callout>
            {fund}
          </>
        ) : null}
        {claimed ? (
          <>
            <p className="first-run-fine">{C.gift.claimed}</p>
            {fund}
          </>
        ) : null}
      </div>
    </div>
  )
}

/** The last step: make the agent now, or look around first. The buttons are in the footer, as the fork is. */
export function CreateStep() {
  return (
    <div className="first-run-step">
      <Tile>
        <Bot />
      </Tile>
      <Words title={C.create.title} sub={C.create.sub} />
    </div>
  )
}
