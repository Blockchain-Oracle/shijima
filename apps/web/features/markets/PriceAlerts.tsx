'use client'

import { alertsCopy } from '@desk/shared'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { cancelAlertAction, setAlertAction } from '@/app/alert-actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface AlertItem {
  id: string
  status: 'active' | 'fired' | 'cancelled'
  direction: 'above' | 'below' | 'either'
  thresholdBps: number
  firedAt: string | null
  firedGapBps: number | null
}

const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`
const DIRECTIONS = ['above', 'below', 'either'] as const

/**
 * "Tell me when Nvidia is 2% above its reference." One sentence with two blanks, then the owner's alerts on this
 * stock. The server action runs the chat card's own checks, and the price logger fires it once.
 */
export function PriceAlerts({
  symbol,
  name,
  gapBps,
  can,
  alerts,
}: {
  symbol: string
  name: string
  gapBps: number | null
  can: 'ok' | 'signedOut' | 'noDesk'
  alerts: AlertItem[]
}) {
  const router = useRouter()
  const [direction, setDirection] = useState<(typeof DIRECTIONS)[number]>('either')
  const [percent, setPercent] = useState('2')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const f = alertsCopy.form

  const save = () =>
    start(async () => {
      const result = await setAlertAction({ symbol, direction, percent })
      if (!result.ok) return setMessage({ ok: false, text: result.why })
      const threshold = Number(percent) * 100
      const there =
        gapBps !== null &&
        (direction === 'above'
          ? gapBps >= threshold
          : direction === 'below'
            ? gapBps <= -threshold
            : Math.abs(gapBps) >= threshold)
      setMessage({
        ok: true,
        text: there
          ? `${alertsCopy.saved} ${alertsCopy.alreadyThere(pct(Math.abs(gapBps ?? 0)))}`
          : alertsCopy.saved,
      })
      router.refresh()
    })

  const cancel = (id: string) =>
    start(async () => {
      const result = await cancelAlertAction({ id, symbol })
      if (!result.ok) setMessage({ ok: false, text: result.why })
      router.refresh()
    })

  return (
    <div className="flex flex-col gap-4">
      {can === 'ok' ? (
        <form
          className="sj-alert-form"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <span className="type-body text-ink">{f.lead(name)}</span>
          <span className="desk-input sj-alert-percent">
            <input
              inputMode="decimal"
              aria-label={f.percentLabel}
              value={percent}
              onChange={(e) => setPercent(e.target.value.replace(/[^0-9.]/g, ''))}
            />
            <span aria-hidden>%</span>
          </span>
          <fieldset className="desk-choice sj-fieldset" aria-label={f.directionLabel}>
            {DIRECTIONS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={direction === d}
                className={cn('desk-choice-option', direction === d && 'active')}
                onClick={() => setDirection(d)}
              >
                {alertsCopy.directions[d]}
              </button>
            ))}
          </fieldset>
          <span className="type-body text-ink">{f.tail}</span>
          <Button type="submit" size="sm" disabled={pending || percent === ''}>
            {pending ? f.saving : f.submit}
          </Button>
        </form>
      ) : (
        <p className="type-body text-ink-secondary">
          {can === 'signedOut' ? alertsCopy.signedOut : alertsCopy.noDesk}
        </p>
      )}
      {message && (
        <p className={cn('type-caption', message.ok ? 'text-ink-secondary' : 'text-loss')} role="status">
          {message.text}
        </p>
      )}
      {can === 'ok' &&
        (alerts.length === 0 ? (
          <p className="type-caption text-ink-muted">{alertsCopy.none}</p>
        ) : (
          <ul className="sj-alert-list">
            {alerts.map((a) => (
              <li key={a.id} data-status={a.status}>
                <span>
                  {a.status === 'active'
                    ? alertsCopy.waiting(pct(a.thresholdBps), alertsCopy.directions[a.direction])
                    : a.status === 'fired' && a.firedAt
                      ? alertsCopy.fired(
                          new Date(a.firedAt).toLocaleString(undefined, {
                            weekday: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          }),
                          `${pct(Math.abs(a.firedGapBps ?? 0))} ${(a.firedGapBps ?? 0) >= 0 ? 'above' : 'below'}`,
                        )
                      : alertsCopy.cancelled}
                </span>
                {a.status === 'active' && (
                  <Button variant="ghost" size="xs" disabled={pending} onClick={() => cancel(a.id)}>
                    {alertsCopy.cancel}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}
