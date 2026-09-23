'use client'

import { deskCopy, usd } from '@desk/shared'
import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

/**
 * A money figure that rolls up to its value once, on load, after 21st's Count Up (20068). It starts a little
 * below the real value rather than at zero, so it never shows a misleading number for more than a blink, and the
 * final text is exactly the server's formatting.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  // Dollars in, formatted as every other figure on the page. A server page can pass only data to this.
  const format = (n: number) => usd(BigInt(Math.round(n * 1e6)))
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(value)
  const ran = useRef(false)
  useEffect(() => {
    if (reduced || ran.current) return
    ran.current = true
    const controls = animate(value * 0.94, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setShown,
    })
    return () => controls.stop()
  }, [value, reduced])
  return <span className={className}>{format(shown)}</span>
}

/** "next check in 23 min", counting down to a moment, refreshed every 20 seconds. */
export function Countdown({ to }: { to: string }) {
  const label = deskCopy.plate.nextCheckIn
  const target = new Date(to).getTime()
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 20_000)
    return () => clearInterval(t)
  }, [])
  // Rendered on the client only, so the server and the browser never disagree about the minute.
  if (now === null) return null
  const mins = Math.max(0, Math.round((target - now) / 60_000))
  return (
    <>
      {label(mins <= 0 ? 'now' : mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`)}
    </>
  )
}
