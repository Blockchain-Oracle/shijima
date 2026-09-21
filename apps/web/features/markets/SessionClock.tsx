'use client'

import { closeMinutes, marketClock, marketsCopy, nextRegularOpen, nyWallToUtc } from '@desk/shared'
import { useEffect, useState } from 'react'

const TICK_MS = 30_000

/** "2d 4h", "11h 40m", "25m": how long until the US market next opens or closes. */
function span(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000))
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  const m = minutes % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/**
 * The hero's clock, in the slot where Masayume counts down to a settlement: when the US market next reopens,
 * or closes while it is open. Drawn after mount, because it depends on the viewer's moment.
 */
export function SessionClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(id)
  }, [])
  const h = marketsCopy.hero
  if (!now) {
    return (
      <div className="mh-settles">
        <span className="mh-settles-label">{h.opensIn}</span>
        <span className="mh-settles-value">{h.noClock}</span>
      </div>
    )
  }
  const clock = marketClock(now)
  const open = clock.session === 'regular'
  const target = open ? nyWallToUtc(clock.nyDate, closeMinutes(clock.nyDate)) : nextRegularOpen(now)
  return (
    <div className="mh-settles">
      <span className="mh-settles-label">{open ? h.closesIn : h.opensIn}</span>
      <span className="mh-settles-value">{span(target.getTime() - now.getTime())}</span>
    </div>
  )
}
