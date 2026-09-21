'use client'

import { until } from '@desk/shared'
import { useState, useTransition } from 'react'
import { type ActionResult, answerApprovalAction } from '@/app/actions'

/** Approve or reject one request. Answering records an answer. It does not send anything. */
export function Answer({
  deskId,
  approvalId,
  expiresAt,
}: {
  deskId: string
  approvalId: string
  expiresAt: string
}) {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<ActionResult>()

  const answer = (choice: 'approve' | 'reject') => {
    const data = new FormData()
    data.set('deskId', deskId)
    data.set('approvalId', approvalId)
    data.set('answer', choice)
    start(async () => setResult(await answerApprovalAction(data)))
  }

  if (result) {
    return <p className={`text-sm ${result.ok ? 'text-acted' : 'text-blocked'}`}>{result.message}</p>
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => answer('approve')}
        className="rounded-md border border-acted px-3 py-1.5 font-medium text-acted text-sm hover:bg-acted hover:text-surface disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => answer('reject')}
        className="rounded-md border border-line px-3 py-1.5 text-ink-soft text-sm hover:border-ink-soft disabled:opacity-50"
      >
        Reject
      </button>
      <span className="text-ink-faint text-xs">expires {until(new Date(expiresAt))}</span>
    </div>
  )
}
