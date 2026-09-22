'use client'

import { takesCopy } from '@desk/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { TAKES_FEED_LIMIT, type TakeView } from '@/features/social/protocol'

/** Agari polls its takes every 20 s, as the reference does. */
const POLL_MS = 20_000
const KEY = ['shijima', 'takes'] as const

/**
 * The takes feed, from Agari (`features/takes/useTakes.ts`). It starts from what the server rendered, and a
 * failed refresh keeps the last feed on screen rather than dropping every take at once.
 */
export function useTakes(initial: TakeView[]): TakeView[] {
  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await fetch(`/api/takes?limit=${TAKES_FEED_LIMIT}`)
      if (!res.ok) throw new Error(`takes ${res.status}`)
      return ((await res.json()) as { takes: TakeView[] }).takes
    },
    initialData: initial,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: POLL_MS,
  })
  return query.data
}

/** Posting a take, then putting the server's own row at the top of the feed rather than a local echo. */
export function usePostTake() {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const post = useCallback(
    async (input: { symbol: string; caption: string; holds: boolean }): Promise<TakeView | null> => {
      setBusy(true)
      setError(null)
      try {
        const res = await fetch('/api/takes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        })
        const body = (await res.json()) as { take?: TakeView; error?: string }
        if (!res.ok || !body.take) {
          setError(body.error ?? takesCopy.errors.postFailed)
          return null
        }
        const take = body.take
        queryClient.setQueryData<TakeView[]>(KEY, (prior) => [take, ...(prior ?? [])])
        return take
      } catch {
        setError(takesCopy.errors.postFailed)
        return null
      } finally {
        setBusy(false)
      }
    },
    [queryClient],
  )
  return { post, busy, error }
}
