'use client'

import { deskCopy } from '@desk/shared'
import { useMemo } from 'react'
import { type ChartMarker, LineChart } from './LineChart'

/** The desk's value over time, with a mark wherever it acted or chose to wait. */
export function DeskValueChart({
  history,
  markers,
}: {
  history: { at: string; totalUsdg: string }[]
  markers: { at: string; seq: number; outcome: string }[]
}) {
  const points = useMemo(() => {
    const seen = new Set<number>()
    return history.flatMap((h) => {
      const time = Math.floor(new Date(h.at).getTime() / 1000)
      if (seen.has(time)) return []
      seen.add(time)
      return [{ time, value: Number(BigInt(h.totalUsdg)) / 1e6 }]
    })
  }, [history])
  const marks = useMemo<ChartMarker[]>(
    () =>
      markers.map((m) => ({
        time: Math.floor(new Date(m.at).getTime() / 1000),
        kind: m.outcome === 'waited' ? 'waited' : 'acted',
      })),
    [markers],
  )
  if (points.length < 2) return <p className="type-caption text-ink-muted">{deskCopy.chart.empty}</p>
  return <LineChart points={points} markers={marks} height={180} />
}
