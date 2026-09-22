'use client'

import { useSyncExternalStore } from 'react'
import { whenFor } from '@/lib/when'

const subscribe = () => () => {}
const zoneNow = () => Intl.DateTimeFormat().resolvedOptions().timeZone
const noZone = () => null

/** The browser's zone, or null on the server and during hydration so both renders agree. */
export function useViewerZone(): string | null {
  return useSyncExternalStore(subscribe, zoneNow, noZone)
}

/** A moment in the reader's own zone with New York beside it. Server-rendered as New York, then rewritten. */
export function When({ at, clock = false }: { at: string | Date; clock?: boolean }) {
  const zone = useViewerZone()
  return <>{whenFor(zone)(typeof at === 'string' ? new Date(at) : at, { clock })}</>
}
