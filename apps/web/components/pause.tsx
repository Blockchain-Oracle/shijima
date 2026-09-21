'use client'

import { useState, useTransition } from 'react'
import { type ActionResult, pauseAction } from '@/app/actions'

/** Pause is instant, free and reversible. Nothing is sold. The on-chain stop is kept for the loss limit. */
export function Pause({ deskId, paused }: { deskId: string; paused: boolean }) {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<ActionResult>()

  const toggle = () => {
    const data = new FormData()
    data.set('deskId', deskId)
    data.set('resume', String(paused))
    start(async () => setResult(await pauseAction(data)))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={toggle}
        className="rounded-md border border-line px-3 py-1.5 text-ink-soft text-sm hover:border-ink-soft disabled:opacity-50"
      >
        {paused ? 'Resume' : 'Pause'}
      </button>
      {result ? (
        <span className={`text-xs ${result.ok ? 'text-acted' : 'text-blocked'}`}>{result.message}</span>
      ) : (
        <span className="text-ink-faint text-xs">
          {paused ? 'Nothing will happen until you resume.' : 'Stops it acting. Nothing is sold.'}
        </span>
      )}
    </div>
  )
}
