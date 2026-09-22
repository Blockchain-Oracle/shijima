'use client'

import { roomCopy } from '@desk/shared'
import { useCallback, useEffect, useState } from 'react'
import type { RoomGate, RoomLineView } from '@/features/social/protocol'

/** Agari polls its thread every 9 s, as the reference does. */
const POLL_MS = 9_000

export interface Room {
  gate: RoomGate | null
  lines: RoomLineView[]
  busy: boolean
  error: string | null
  refresh: () => Promise<void>
  post: (body: string, holds: boolean) => Promise<void>
}

/**
 * One Stock Token's Room, from Agari (`features/room/useRoom.ts`). There is no join signature: signing in already
 * proved the wallet, so the server answers where the wallet stands (connect, locked or joined) with every read.
 * A read that fails leaves the last thread on screen rather than dropping it.
 */
export function useRoom(symbol: string, open: boolean): Room {
  const [gate, setGate] = useState<RoomGate | null>(null)
  const [lines, setLines] = useState<RoomLineView[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/room/${encodeURIComponent(symbol)}`, { cache: 'no-store' })
      const body = (await res.json()) as { gate?: RoomGate; lines?: RoomLineView[] }
      if (body.gate) setGate(body.gate)
      if (body.gate === 'joined' && body.lines) setLines(body.lines)
    } catch {
      setGate((prior) => prior ?? 'unavailable')
    }
  }, [symbol])

  useEffect(() => {
    if (!open) return
    void refresh()
    const id = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(id)
  }, [open, refresh])

  const post = useCallback(
    async (body: string, holds: boolean) => {
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(`/api/room/${encodeURIComponent(symbol)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ body, holds }),
        })
        const payload = (await res.json()) as { line?: RoomLineView; error?: string }
        if (!res.ok || !payload.line) {
          setError(payload.error ?? roomCopy.errors.postFailed)
          return
        }
        // The server's own row rather than a local echo, so what is on screen is what was stored.
        const line = payload.line
        setLines((prior) => [...prior, line])
      } catch {
        setError(roomCopy.errors.postFailed)
      } finally {
        setBusy(false)
      }
    },
    [symbol],
  )

  return { gate, lines, busy, error, refresh, post }
}
