'use client'

import { closeMinutes, marketClock, nextRegularOpen, nyWallToUtc, webCopy } from '@desk/shared'
import { useEffect, useState } from 'react'
import { useViewerZone } from '@/components/when'
import { cn } from '@/lib/utils'
import { whenFor } from '@/lib/when'

const TICK_MS = 30_000

type When = ReturnType<typeof whenFor>

/**
 * "Open · closes 16:00 ET", "Weekend · reopens Mon 14:30 (09:30 ET)". Our calendar, in Agari's chip, with the
 * boundary written in the reader's own zone and the New York fact beside it (Agari D-120).
 */
export function sessionLine(now: Date, when: When): { state: string; word: string; tail: string } {
  const clock = marketClock(now)
  const word = webCopy.session.words[clock.session]
  if (clock.session === 'regular') {
    const closeAt = nyWallToUtc(clock.nyDate, closeMinutes(clock.nyDate))
    return { state: clock.session, word, tail: webCopy.session.closes(when(closeAt, { clock: true })) }
  }
  return { state: clock.session, word, tail: webCopy.session.reopens(when(nextRegularOpen(now))) }
}

/**
 * The US market's session. Drawn only after mount: the phrase depends on the viewer's moment, and a server
 * render a minute older would disagree with it.
 */
export function MarketSessionChip({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null)
  const zone = useViewerZone()
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(id)
  }, [])
  if (!now) return null
  const line = sessionLine(now, whenFor(zone))
  return (
    <span
      className={cn('mks-chip', className)}
      data-state={line.state}
      role="status"
      aria-label={webCopy.session.aria(line.word, line.tail)}
    >
      <span className="mks-chip-dot" aria-hidden />
      <span className="mks-chip-state" aria-hidden>
        {line.word}
      </span>
      <span className="mks-chip-sep" aria-hidden>
        ·
      </span>
      <span aria-hidden>{line.tail}</span>
    </span>
  )
}
