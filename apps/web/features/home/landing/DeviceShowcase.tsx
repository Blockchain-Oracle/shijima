'use client'

import { homeCopy as H } from '@desk/shared'
import { ArrowRight } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { type ReactNode, useState } from 'react'
import { Logo } from './Logo'
import { SHOWCASE_ROUTE } from './links'
import { MockScreen } from './MockScreen'
import { type ChatLatest, TelegramChat } from './TelegramChat'

type Variant = 'web' | 'phone' | 'telegram'

/**
 * One screen that rises on hover and flips (3D) on click or tap to show what it is for (the reference's
 * DeviceFlipCard). Mouse users click anywhere; keyboard users get a real toggle button, and the hidden face is
 * `inert`, so its controls never become phantom tab stops.
 */
function DeviceFlipCard({
  variant,
  title,
  meta,
  backLine,
  cta,
  front,
  flipped,
  onFlip,
}: {
  variant: Variant
  title: string
  meta: string
  backLine: string
  cta: { label: string; href: string; external?: boolean }
  front: ReactNode
  flipped: boolean
  onFlip: () => void
}) {
  const stop = (event: React.MouseEvent) => event.stopPropagation()
  return (
    // The reference's click-anywhere affordance for mice; the toggle button inside is the keyboard path.
    // biome-ignore lint/a11y/useKeyWithClickEvents: see above
    <article className={`flip-card flip-${variant}${flipped ? ' is-flipped' : ''}`} onClick={onFlip}>
      <span className="flip-inner">
        <span className="flip-face flip-front" inert={flipped || undefined}>
          {front}
          <span className="flip-caption">
            <button
              type="button"
              className="flip-toggle"
              aria-pressed={flipped}
              aria-label={H.showcase.show(title)}
              onClick={(event) => {
                event.stopPropagation()
                onFlip()
              }}
            >
              <strong>{title}</strong>
              <span>{meta}</span>
            </button>
          </span>
        </span>
        <span className="flip-face flip-back" inert={!flipped || undefined}>
          <Logo size={40} glow />
          <strong>{title}</strong>
          <span className="flip-back-line">{backLine}</span>
          {cta.external ? (
            <a className="flip-cta" href={cta.href} target="_blank" rel="noreferrer" onClick={stop}>
              {cta.label} <ArrowRight size={16} aria-hidden />
            </a>
          ) : (
            <Link className="flip-cta" href={cta.href as Route} onClick={stop}>
              {cta.label} <ArrowRight size={16} aria-hidden />
            </Link>
          )}
          <button
            type="button"
            className="flip-hint"
            onClick={(event) => {
              event.stopPropagation()
              onFlip()
            }}
          >
            {H.showcase.back}
          </button>
        </span>
      </span>
    </article>
  )
}

/** Web, phone and Telegram under the hero. One card is flipped at a time. */
export function DeviceShowcase({
  appHref,
  bot,
  botLink,
  latest,
}: {
  appHref: string
  bot: string
  botLink: string
  latest: ChatLatest | null
}) {
  const [flipped, setFlipped] = useState<Variant | null>(null)
  const flip = (v: Variant) => () => setFlipped((current) => (current === v ? null : v))
  const c = H.showcase
  return (
    <section className="device-showcase" aria-label={c.aria}>
      <DeviceFlipCard
        variant="web"
        title={c.web.title}
        meta={c.web.meta}
        backLine={c.web.back}
        cta={{ label: c.web.cta, href: appHref }}
        front={<MockScreen src={SHOWCASE_ROUTE} width={1260} height={880} maxHeight={340} />}
        flipped={flipped === 'web'}
        onFlip={flip('web')}
      />
      <DeviceFlipCard
        variant="phone"
        title={c.phone.title}
        meta={c.phone.meta}
        backLine={c.phone.back}
        cta={{ label: c.phone.cta, href: SHOWCASE_ROUTE }}
        front={
          <span className="phone-frame">
            <MockScreen src={SHOWCASE_ROUTE} width={390} height={844} radius={0} maxHeight={414} />
          </span>
        }
        flipped={flipped === 'phone'}
        onFlip={flip('phone')}
      />
      <DeviceFlipCard
        variant="telegram"
        title={c.telegram.title}
        meta={c.telegram.meta}
        backLine={c.telegram.back}
        cta={{ label: c.telegram.cta(bot), href: botLink, external: true }}
        front={<TelegramChat bot={bot} link={botLink} latest={latest} />}
        flipped={flipped === 'telegram'}
        onFlip={flip('telegram')}
      />
    </section>
  )
}
