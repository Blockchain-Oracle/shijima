'use client'

import { deskCopy } from '@desk/shared'
import { History, PieChart, SlidersHorizontal } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { TabsPanel, UnderlineTabs } from '@/components/ui/desk-kit'

type Section = 'portfolio' | 'activity' | 'settings'

/**
 * The portfolio's detail under its value and chart, as tabs (after Agari's S22 cockpit): what it holds against the
 * plan, what the agent did, and how it is set up. One long column of cards became three short ones. The panels are
 * rendered on the server and passed in, so nothing here fetches.
 */
export function DeskSections({
  portfolio,
  activity,
  settings,
  count,
}: {
  portfolio: ReactNode
  activity: ReactNode
  settings: ReactNode | null
  /** How many decisions the agent has made, shown on the Activity tab. */
  count: number
}) {
  const S = deskCopy.sections
  const [tab, setTab] = useState<Section>('portfolio')
  const items = [
    { value: 'portfolio' as const, label: S.portfolio, icon: <PieChart className="size-4" aria-hidden /> },
    {
      value: 'activity' as const,
      label: S.activity,
      count,
      icon: <History className="size-4" aria-hidden />,
    },
    ...(settings
      ? [
          {
            value: 'settings' as const,
            label: S.settings,
            icon: <SlidersHorizontal className="size-4" aria-hidden />,
          },
        ]
      : []),
  ]
  return (
    <UnderlineTabs value={tab} onChange={setTab} items={items} label={S.aria}>
      <TabsPanel value="portfolio" className="flex flex-col gap-4">
        {portfolio}
      </TabsPanel>
      <TabsPanel value="activity" className="flex flex-col gap-4">
        {activity}
      </TabsPanel>
      {settings ? (
        <TabsPanel value="settings" className="flex flex-col gap-4">
          {settings}
        </TabsPanel>
      ) : null}
    </UnderlineTabs>
  )
}
