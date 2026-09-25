'use client'

import { KeyRound, Plug, ScrollText, Wallet } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const TABS = ['account', 'connections', 'agents', 'agreement'] as const
type Tab = (typeof TABS)[number]

const ICON: Record<Tab, ReactNode> = {
  account: <Wallet aria-hidden="true" />,
  connections: <Plug aria-hidden="true" />,
  agents: <KeyRound aria-hidden="true" />,
  agreement: <ScrollText aria-hidden="true" />,
}

/**
 * Settings as one card with tabs, after 21st's Settings Tabbed Sections (28358): one part at a time instead of
 * every group stacked down the page. The open tab follows the address's #hash, so a link can open Connections.
 */
export function SettingsTabs({
  labels,
  panels,
}: {
  labels: Record<Tab, string>
  panels: Record<Tab, ReactNode>
}) {
  const [tab, setTab] = useState<Tab>('account')
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1) as Tab
      if (TABS.includes(h)) setTab(h)
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [])

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        setTab(v as Tab)
        history.replaceState(null, '', `#${v}`)
      }}
      className="st-tabs flex-col"
    >
      <div className="st-tablist-wrap">
        <TabsList variant="line" className="st-tablist">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="st-tab">
              {ICON[t]}
              {labels[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {TABS.map((t) => (
        <TabsContent key={t} value={t} className="st-panel">
          {panels[t]}
        </TabsContent>
      ))}
    </Tabs>
  )
}
