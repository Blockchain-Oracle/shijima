'use client'

import { KeyRound, Plug, ScrollText, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { TabbedCard } from '@/components/ui/tabbed-card'

type Tab = 'account' | 'connections' | 'agents' | 'agreement'

/** The account's settings in one tabbed card: Account, Connections, Agents & access, What you agreed to. */
export function SettingsTabs({
  labels,
  panels,
}: {
  labels: Record<Tab, string>
  panels: Record<Tab, ReactNode>
}) {
  return (
    <TabbedCard
      tabs={[
        { id: 'account', label: labels.account, icon: <Wallet aria-hidden="true" /> },
        { id: 'connections', label: labels.connections, icon: <Plug aria-hidden="true" /> },
        { id: 'agents', label: labels.agents, icon: <KeyRound aria-hidden="true" /> },
        { id: 'agreement', label: labels.agreement, icon: <ScrollText aria-hidden="true" /> },
      ]}
      panels={panels}
    />
  )
}
