'use client'

import { deskCopy } from '@desk/shared'
import { type ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'

type Tab = 'chat' | 'desk' | 'record'

/**
 * The desk page's frame. On a desktop the agent, and for the owner the chat with it, is the left column and the
 * portfolio sits beside it. On a phone the three become tabs: Agent, Portfolio, Activity. A visitor meets the agent
 * too, without the chat, and lands on the portfolio.
 */
export function DeskTabs({
  agent,
  chat,
  desk,
  record,
}: {
  agent: ReactNode
  chat: ReactNode | null
  desk: ReactNode
  /** Its own tab on a phone; left out when the desk column carries the record in its own tabs. */
  record?: ReactNode
}) {
  const tabs: Tab[] = record ? ['chat', 'desk', 'record'] : ['chat', 'desk']
  const [tab, setTab] = useState<Tab>(chat ? 'chat' : 'desk')
  return (
    <div className={cn('desk-frame', !chat && 'is-visitor')} data-tab={tab}>
      <div className="desk-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={cn('desk-tab', tab === t && 'active')}
            onClick={() => setTab(t)}
          >
            {deskCopy.tabs[t]}
          </button>
        ))}
      </div>
      <div className="desk-grid">
        <div className="desk-col-chat flex flex-col gap-4" data-panel="chat">
          {agent}
          {chat}
        </div>
        <div className="desk-col-side">
          <div data-panel="desk" className="flex flex-col gap-4">
            {desk}
          </div>
          {record ? <div data-panel="record">{record}</div> : null}
        </div>
      </div>
    </div>
  )
}
