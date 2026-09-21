'use client'

import { webCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { sessionLine } from './MarketSessionChip'

export interface TickerCell {
  symbol: string
  /** The pool's price in dollars, already formatted. */
  price: string
  /** Distance from the reference in basis points, or null when there is no reference. */
  gapBps: number | null
}

const POLL_MS = 60_000

/**
 * The strip across the top, from Yosuku via Agari: each Stock Token's price with its distance from the reference,
 * and the US market's session. Every figure is a row from the price log; with none yet, it says so.
 */
export default function Marquee({ initial }: { initial: TickerCell[] }) {
  const [cells, setCells] = useState(initial)
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(async () => {
      setNow(new Date())
      try {
        const res = await fetch('/api/ticker', { cache: 'no-store' })
        if (res.ok) setCells(((await res.json()) as { cells: TickerCell[] }).cells)
      } catch {
        // The last good prices stay up; the next poll tries again.
      }
    }, POLL_MS)
    return () => clearInterval(id)
  }, [])

  const items = cells.map((c) => {
    const gap =
      c.gapBps === null
        ? null
        : Math.abs(c.gapBps) < 50
          ? { text: webCopy.marquee.inLine, dir: '' }
          : {
              text: `${c.gapBps > 0 ? '+' : '−'}${(Math.abs(c.gapBps) / 100).toFixed(1)}%`,
              dir: c.gapBps > 0 ? 'up' : 'down',
            }
    return { key: c.symbol, label: c.symbol, value: c.price, gap }
  })
  const session = now ? sessionLine(now) : null

  const render = (prefix: string) => (
    <>
      {items.length === 0 ? (
        <span key={`${prefix}-empty`} className="marquee-cell">
          <span className="lbl">{webCopy.brand.name.toUpperCase()}</span>
          <span className="val">{webCopy.marquee.noPrices}</span>
        </span>
      ) : (
        items.map((item) => (
          <Link
            key={`${prefix}-${item.key}`}
            href={`/stock/${item.key}` as Route}
            className="marquee-cell"
            // The strip is hidden from screen readers and moves, so its cells are a shortcut for a pointer only.
            tabIndex={-1}
          >
            <span className="lbl">{item.label}</span>
            <span className="val">{item.value}</span>
            {item.gap && <span className={item.gap.dir}>{item.gap.text}</span>}
          </Link>
        ))
      )}
      {session && (
        <span key={`${prefix}-session`} className="marquee-cell">
          <span className="lbl">{webCopy.marquee.market}</span>
          <span className="val">{`${session.word} · ${session.tail}`.toUpperCase()}</span>
        </span>
      )}
    </>
  )

  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {render('a')}
        {render('b')}
        {render('c')}
      </div>
    </div>
  )
}
