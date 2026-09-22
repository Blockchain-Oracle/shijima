import { desksOfOwner } from '@desk/db'
import { howCopy } from '@desk/shared'
import { HowItWorksPage } from '@/features/how-it-works/HowItWorksPage'
import { db } from '@/lib/db'
import { loadWeekendFact } from '@/lib/markets.server'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: howCopy.title, description: howCopy.lead }

/**
 * The published rules [8.21] and the escape hatch [8.22]. Public: anyone can read how the desk decides before
 * trusting it with anything. A signed-in owner also gets a link straight to their own desk on the explorer.
 */
export default async function HowItWorks() {
  const address = await signedInAddress().catch(() => undefined)
  const [weekendFact, desks] = await Promise.all([
    loadWeekendFact(),
    address ? desksOfOwner(db(), address).catch(() => []) : Promise.resolve([]),
  ])
  return (
    <HowItWorksPage
      weekendFact={weekendFact}
      desks={desks.map((d) => ({ name: d.name ?? d.address, address: d.address }))}
    />
  )
}
