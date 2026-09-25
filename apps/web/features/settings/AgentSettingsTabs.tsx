'use client'

import { Gauge, Plug, ScrollText, Share2, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { TabbedCard } from '@/components/ui/tabbed-card'

type Tab = 'trading' | 'plan' | 'connections' | 'sharing' | 'agreement'

/** One agent's settings in one tabbed card: Trading, Plan, Connections, Sharing, Agreement. */
export function AgentSettingsTabs({
  labels,
  panels,
}: {
  labels: Record<Tab, string>
  panels: Record<Tab, ReactNode>
}) {
  return (
    <TabbedCard
      tabs={[
        { id: 'trading', label: labels.trading, icon: <Gauge aria-hidden="true" /> },
        { id: 'plan', label: labels.plan, icon: <SlidersHorizontal aria-hidden="true" /> },
        { id: 'connections', label: labels.connections, icon: <Plug aria-hidden="true" /> },
        { id: 'sharing', label: labels.sharing, icon: <Share2 aria-hidden="true" /> },
        { id: 'agreement', label: labels.agreement, icon: <ScrollText aria-hidden="true" /> },
      ]}
      panels={panels}
    />
  )
}
