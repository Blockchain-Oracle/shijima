'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export interface TabSpec {
  id: string
  label: string
  icon?: ReactNode
}

/**
 * One card, tabs across the top, one part at a time (21st's Settings Tabbed Sections, 28358). The open tab follows
 * the address's #hash, so a link can open a given tab. Used by the account's and each agent's settings.
 */
export function TabbedCard({ tabs, panels }: { tabs: TabSpec[]; panels: Record<string, ReactNode> }) {
  const ids = tabs.map((t) => t.id)
  const [tab, setTab] = useState(ids[0] ?? '')
  // biome-ignore lint/correctness/useExhaustiveDependencies: the tab ids are fixed for the page's life
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1)
      if (ids.includes(h)) setTab(h)
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [])
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        setTab(String(v))
        history.replaceState(null, '', `#${v}`)
      }}
      className="st-tabs flex-col"
    >
      <div className="st-tablist-wrap">
        <TabsList variant="line" className="st-tablist">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="st-tab">
              {t.icon}
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.id} value={t.id} className="st-panel">
          {panels[t.id]}
        </TabsContent>
      ))}
    </Tabs>
  )
}
