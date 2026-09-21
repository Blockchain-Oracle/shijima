'use client'

import { deskCopy, until } from '@desk/shared'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { type ActionResult, answerApprovalAction } from '@/app/actions'
import { Button } from '@/components/ui/button'

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
  const router = useRouter()
  const [pending, start] = useTransition()
  const [result, setResult] = useState<ActionResult>()

  const answer = (choice: 'approve' | 'reject') => {
    const data = new FormData()
    data.set('deskId', deskId)
    data.set('approvalId', approvalId)
    data.set('answer', choice)
    start(async () => {
      setResult(await answerApprovalAction(data))
      router.refresh()
    })
  }

  if (result) {
    return <p className={`type-caption ${result.ok ? 'text-profit' : 'text-loss'}`}>{result.message}</p>
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" disabled={pending} onClick={() => answer('approve')}>
        {deskCopy.needsYou.approve}
      </Button>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => answer('reject')}>
        {deskCopy.needsYou.reject}
      </Button>
      <span className="type-caption text-ink-muted">
        {deskCopy.needsYou.expires(until(new Date(expiresAt)))}
      </span>
    </div>
  )
}
