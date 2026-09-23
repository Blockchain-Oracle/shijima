'use client'

import { appCopy } from '@desk/shared'
import { Repeat } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { copyControlAction } from '@/app/copy-actions'

const c = appCopy.copy.header

/** On a follower's own agent: whom it copies, and pause, resume or stop, one tap each. */
export function CopyingBar({
  deskId,
  leader,
  owner,
}: {
  deskId: string
  leader: { name: string; slug: string; status: string }
  owner: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const act = (what: 'pause' | 'resume' | 'stop') =>
    start(async () => {
      await copyControlAction(deskId, what)
      router.refresh()
    })
  const paused = leader.status === 'paused'
  return (
    <div className="copying-bar">
      <Repeat aria-hidden="true" className="size-4" />
      <span>
        {paused ? c.paused(leader.name) : c.copying(leader.name)}{' '}
        <Link href={`/agents/${leader.slug}` as Route} className="copying-link">
          →
        </Link>
      </span>
      {owner && (
        <span className="copying-actions">
          <button type="button" disabled={pending} onClick={() => act(paused ? 'resume' : 'pause')}>
            {paused ? c.resume : c.pause}
          </button>
          <button type="button" disabled={pending} onClick={() => act('stop')}>
            {c.stop}
          </button>
        </span>
      )}
    </div>
  )
}
