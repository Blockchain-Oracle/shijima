'use client'

import { closeMinutes, marketClock, nextRegularOpen, webCopy } from '@desk/shared'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const TICK_MS = 30_000

const nyClock = (at: Date, withDay: boolean) =>
  at.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    ...(withDay ? { weekday: 'short' as const } : {}),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

/** "Open · closes 16:00 ET", "Weekend · reopens Mon 09:30 ET". Our calendar, in Agari's chip. */
export function sessionLine(now: Date): { state: string; word: string; tail: string } {
  const clock = marketClock(now)
  const word = webCopy.session.words[clock.session]
  if (clock.session === 'regular') {
    const minutes = closeMinutes(clock.nyDate)
    const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
    return { state: clock.session, word, tail: webCopy.session.closes(time) }
  }
  return { state: clock.session, word, tail: webCopy.session.reopens(nyClock(nextRegularOpen(now), true)) }
}

/**
 * The US market's session. Drawn only after mount: the phrase depends on the viewer's moment, and a server
 * render a minute older would disagree with it.
 */
export function MarketSessionChip({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(id)
  }, [])
  if (!now) return null
  const line = sessionLine(now)
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
