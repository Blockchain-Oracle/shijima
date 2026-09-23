'use client'

import { appCopy } from '@desk/shared'
import { ArrowLeft, ArrowRight, Copy } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkline } from '@/components/ui/sparkline'
import { TokenStack } from '@/components/ui/token-logo'
import { When } from '@/components/when'
import type { PublicAgent } from '@/lib/agents.server'
import { cn } from '@/lib/utils'

const usd = (raw: string | null) =>
  raw === null
    ? '—'
    : `$${(Number(raw) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * The live agents, as 21st's Apple Card Carousel (28160): tall cards in a strip that scrolls by touch, trackpad
 * or the arrows, never on its own. Each card is one agent: its name and mode as the label, its latest decision in
 * its own words as the headline, and its value, record and the way to copy it at the foot. Native scroll-snap
 * instead of the original's Embla, so it adds nothing to the bundle and keyboard scrolling just works.
 */
export function LiveAgentsCarousel({ agents }: { agents: PublicAgent[] }) {
  const c = appCopy.carousel
  const track = useRef<HTMLElement>(null)
  const [edges, setEdges] = useState({ start: true, end: false })

  const measure = useCallback(() => {
    const el = track.current
    if (!el) return
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 })
  }, [])

  useEffect(() => {
    measure()
    const el = track.current
    el?.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      el?.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  const step = (dir: 1 | -1) => {
    const el = track.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('.lac-card')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? 320) + 20), behavior: reduce ? 'auto' : 'smooth' })
  }

  if (agents.length === 0) return null

  return (
    <div className="lac">
      <div className="lac-controls">
        <Link href="/agents" className="lac-all">
          {c.all} →
        </Link>
        <span className="lac-arrows">
          <button type="button" onClick={() => step(-1)} disabled={edges.start} aria-label={c.prev}>
            <ArrowLeft aria-hidden="true" className="size-4" />
          </button>
          <button type="button" onClick={() => step(1)} disabled={edges.end} aria-label={c.next}>
            <ArrowRight aria-hidden="true" className="size-4" />
          </button>
        </span>
      </div>
      <section ref={track} className="lac-track" tabIndex={0} aria-label={c.aria}>
        {agents.map((a) => (
          <article key={a.id} className={cn('lac-card', a.mode !== 'shadow' && 'is-live')}>
            <Link href={`/agents/${a.slug}` as Route} className="lac-card-link" aria-label={a.name} />
            <header className="lac-card-head">
              <TokenStack symbols={a.symbols.length ? a.symbols : ['CASH']} size={26} max={4} />
              <span className="lac-card-label">
                <strong>{a.name}</strong>
                <span className={cn('lac-mode', a.mode !== 'shadow' && 'is-live')}>
                  {a.mode === 'shadow' ? c.practice : c.live}
                </span>
              </span>
            </header>
            <p className="lac-headline">{a.latest?.summary ?? c.noDecision}</p>
            {a.latest && (
              <p className="lac-when">
                <When at={a.latest.at} />
              </p>
            )}
            <footer className="lac-foot">
              <Sparkline values={a.spark} width={120} height={36} />
              <div className="lac-foot-row">
                <span className="lac-value">{usd(a.valueUsdg)}</span>
                <span className="lac-record">{appCopy.agents.record(a.better, a.graded)}</span>
              </div>
              <Link href={`/agents/${a.slug}?copy=1` as Route} className="btn-primary lac-copy">
                <Copy aria-hidden="true" className="size-3.5" /> {c.copy}
              </Link>
            </footer>
          </article>
        ))}
        {/* Two cards that are always true: how to start your own, and what copying means. */}
        <article className="lac-card lac-card--quiet">
          <p className="lac-mode">{c.create.label}</p>
          <p className="lac-headline">{c.create.title}</p>
          <p className="lac-body">{c.create.body}</p>
          <footer className="lac-foot">
            <Link href="/agents/new" className="btn-primary lac-copy">
              {c.create.cta} →
            </Link>
          </footer>
        </article>
        <article className="lac-card lac-card--quiet">
          <p className="lac-mode">{c.how.label}</p>
          <p className="lac-headline">{c.how.title}</p>
          <p className="lac-body">{c.how.body}</p>
          <footer className="lac-foot">
            <Link href="/how-it-works" className="btn-secondary lac-copy">
              {c.how.cta} →
            </Link>
          </footer>
        </article>
      </section>
    </div>
  )
}
