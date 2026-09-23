'use client'

import { appCopy } from '@desk/shared'
import { type ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * The agent's record, and for its owner the chat beside it: two tabs in one card, so asking the agent sits next
 * to what it did instead of taking a column of its own.
 */
export function AgentActivity({ record, chat }: { record: ReactNode; chat: ReactNode | null }) {
  const c = appCopy.agentPage.activity
  const [tab, setTab] = useState<'record' | 'ask'>('record')
  if (!chat) return <div className="ap-activity">{record}</div>
  return (
    <section className="ap-card ap-activity ap-activity--tabs">
      <div className="act-tabs" role="tablist" aria-label={c.title}>
        {(
          [
            ['record', c.title],
            ['ask', c.ask],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={cn('act-tab', tab === key && 'is-active')}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div hidden={tab !== 'record'}>{record}</div>
      <div hidden={tab !== 'ask'}>{chat}</div>
    </section>
  )
}
