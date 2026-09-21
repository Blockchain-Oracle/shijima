'use client'

import { useEffect, useState } from 'react'
import { type ChartPoint, LineChart } from './LineChart'

/** A small price chart beside a reply, when the desk's answer was about one Stock Token. */
export function ChatChart({ symbol, days }: { symbol: string; days: number }) {
  const [data, setData] = useState<{ name: string; points: ChartPoint[]; reference: number | null } | null>(
    null,
  )
  useEffect(() => {
    let alive = true
    fetch(`/api/prices/${symbol}?days=${days}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setData(d))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [symbol, days])
  if (!data || data.points.length < 2) return null
  return (
    <div className="desk-card">
      <span className="type-label-micro text-ink-muted">
        {data.name} · {days}d
      </span>
      <LineChart points={data.points} reference={data.reference} height={140} />
    </div>
  )
}
