'use client'

import { useEffect, useState } from 'react'
import { sessionLine } from '@/components/shell/MarketSessionChip'
import { useViewerZone } from '@/components/when'
import { whenFor } from '@/lib/when'

/** "US market closed. Reopens Mon 14:30 (09:30 ET)" on the desk [8.9], drawn after mount like the chip. */
export function SessionLine({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null)
  const zone = useViewerZone()
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  if (!now) return null
  const line = sessionLine(now, whenFor(zone))
  return (
    <p className={className}>
      US market: {line.word.toLowerCase()} · {line.tail}
    </p>
  )
}
