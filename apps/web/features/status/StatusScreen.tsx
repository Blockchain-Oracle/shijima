'use client'

import { statusCopy } from '@desk/shared'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SectionHeader } from '@/components/ui/section-header'
import type { StatusDesk, StatusPayload, StatusRow } from './protocol'

/** Agari re-checks every 30 s (`features/status/useStatus.ts`), and only while the tab is visible. */
const POLL_MS = 30_000

/**
 * /status, on Agari's `StatusScreen`: the banner, the table of parts with the lag dot ladder, and when it was read.
 * Ours adds the desks, each with its last check or "has not checked in" [8.16], and the honest counts (L-15).
 * The first reading comes with the page; the browser refreshes it while the tab is open.
 */
export function StatusScreen({ first }: { first: StatusPayload | null }) {
  const [reading, setReading] = useState<StatusPayload | null>(first)
  const [failed, setFailed] = useState(first === null)

  useEffect(() => {
    let stopped = false
    const read = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const response = await fetch('/api/status', { cache: 'no-store' })
        if (!response.ok) throw new Error(String(response.status))
        const next = (await response.json()) as StatusPayload
        if (!stopped) {
          setReading(next)
          setFailed(false)
        }
      } catch {
        if (!stopped) setFailed(true)
      }
    }
    const timer = setInterval(read, POLL_MS)
    document.addEventListener('visibilitychange', read)
    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', read)
    }
  }, [])

  return (
    <div className="container status-page">
      <SectionHeader index={statusCopy.section.index} title={statusCopy.section.title} />

      {failed && !reading && (
        <div className="status-holding" role="alert">
          <AlertTriangle className="status-holding-icon warn" aria-hidden />
          <p className="status-holding-text">{statusCopy.unreachable}</p>
        </div>
      )}

      {reading && (
        <div className="status-report">
          <Banner payload={reading} />
          <Table title={statusCopy.tableTitle(reading.rows.length)} rows={reading.rows} />
          {/* The viewer's own clock: the server's zone and locale may differ, so this line is the browser's. */}
          <p className="status-checked" suppressHydrationWarning>
            {statusCopy.lastChecked(new Date(reading.checkedAtMs).toLocaleTimeString())}
          </p>

          <SectionHeader
            index={statusCopy.desksSection.index}
            title={statusCopy.desksSection.title}
            desc={statusCopy.desksSection.desc}
            className="mt-6"
          />
          {reading.desks.length === 0 ? (
            <p className="type-body text-ink-secondary">{statusCopy.desks.none}</p>
          ) : (
            <Table title={statusCopy.desks.tableTitle(reading.desks.length)} rows={reading.desks} />
          )}

          <SectionHeader
            index={statusCopy.countsSection.index}
            title={statusCopy.countsSection.title}
            desc={statusCopy.countsSection.desc}
            className="mt-6"
          />
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {reading.counts.map((c) => (
              <div key={c.label} className="status-table px-5 py-4">
                <dt className="status-table-title">{c.label}</dt>
                <dd className="status-checkpoint-value mt-1 text-xl">{c.value}</dd>
                <dd className="mt-1 type-caption text-ink-muted">{c.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

/** Agari's banner: one line of verdict, the worst part, and the chain's head block. */
function Banner({ payload }: { payload: StatusPayload }) {
  return (
    <div className="status-banner" data-healthy={payload.healthy}>
      {payload.healthy ? (
        <CheckCircle className="status-banner-icon" aria-hidden />
      ) : (
        <AlertTriangle className="status-banner-icon" aria-hidden />
      )}
      <div className="min-w-0">
        <div className="status-banner-title">
          {payload.healthy ? statusCopy.healthy : statusCopy.degraded}
        </div>
        <div className="status-banner-sub">
          {payload.worst ? statusCopy.worst(payload.worst) : statusCopy.allFresh}
        </div>
      </div>
      <div className="status-checkpoint">
        <div className="status-checkpoint-label">{statusCopy.checkpoint}</div>
        <div className="status-checkpoint-value">{payload.block ?? statusCopy.noBlock}</div>
      </div>
    </div>
  )
}

function Table({ title, rows }: { title: string; rows: readonly (StatusRow | StatusDesk)[] }) {
  return (
    <div className="status-table">
      <div className="status-table-head">
        <h3 className="status-table-title">{title}</h3>
      </div>
      <div className="status-table-body">
        {rows.map((r) => {
          const label = 'label' in r ? r.label : r.name
          const href = 'href' in r ? r.href : null
          return (
            <div key={r.id} className="status-row">
              <span className="status-dot" data-tone={r.tone} aria-hidden />
              <span className="status-row-label">
                {href ? (
                  <Link href={href as Route} className="hover:underline" data-cursor="hover">
                    {label}
                  </Link>
                ) : (
                  label
                )}
              </span>
              <span className="status-row-lag">{r.lag ?? '—'}</span>
              <span className="status-row-detail" title={r.detail}>
                {r.detail}
              </span>
              {r.chip && <span className="status-chip">{r.chip}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
