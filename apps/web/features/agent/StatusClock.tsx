'use client'

import { ago, appCopy } from '@desk/shared'
import { useEffect, useState } from 'react'

const s = appCopy.agentPage.status
/** The agent looks every five minutes, on the price logger's slots (lib/desk.server's LOOK_MS). */
const LOOK_MS = 5 * 60 * 1000

/**
 * The two times in the status card, ticking: how long since the last look, and a mm:ss count to the next. Drawn
 * on the client only, so the server and the browser never disagree about the second.
 */
export function StatusClock({ lastCheckAt, running }: { lastCheckAt: string | null; running: boolean }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const left = now === null ? null : LOOK_MS - (now % LOOK_MS)
  const mmss =
    left === null
      ? '—'
      : left < 5_000
        ? s.now
        : s.inTime(
            `${Math.floor(left / 60_000)}:${String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')}`,
          )
  return (
    <>
      <div>
        <dt>{s.lastLook}</dt>
        <dd>{lastCheckAt ? (now === null ? '—' : ago(new Date(lastCheckAt), new Date(now))) : s.notYet}</dd>
      </div>
      <div>
        <dt>{s.nextLook}</dt>
        <dd className="ap-now-next">
          {running ? (
            <>
              <span className="ap-now-ring" aria-hidden="true">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <title>{s.nextLook}</title>
                  <circle cx="8" cy="8" r="6.5" />
                  <circle
                    cx="8"
                    cy="8"
                    r="6.5"
                    className="ap-now-ring-fill"
                    style={{ strokeDashoffset: left === null ? 40.8 : (left / LOOK_MS) * 40.8 }}
                  />
                </svg>
              </span>
              <span className="tabular-nums">{mmss}</span>
            </>
          ) : (
            '—'
          )}
        </dd>
      </div>
    </>
  )
}
