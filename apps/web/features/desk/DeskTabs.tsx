'use client'

import { deskCopy } from '@desk/shared'
import { type ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'

type Tab = 'chat' | 'desk' | 'record'

/**
 * The desk page's frame. On a desktop the chat is the main left column and the desk sits beside it. On a phone
 * the three become tabs, the chat first. A visitor has no chat, so the desk comes first for them.
 */
export function DeskTabs({
  chat,
  desk,
  record,
}: {
  chat: ReactNode | null
  desk: ReactNode
  record: ReactNode
}) {
  const tabs: Tab[] = chat ? ['chat', 'desk', 'record'] : ['desk', 'record']
  const [tab, setTab] = useState<Tab>(tabs[0] ?? 'desk')
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
        {chat && (
          <div className="desk-col-chat" data-panel="chat">
            {chat}
          </div>
        )}
        <div className="desk-col-side">
          <div data-panel="desk" className="flex flex-col gap-4">
            {desk}
          </div>
          <div data-panel="record">{record}</div>
        </div>
      </div>
    </div>
  )
}
