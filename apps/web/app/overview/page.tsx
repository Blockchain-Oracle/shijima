import { appCopy } from '@desk/shared'
import { redirect } from 'next/navigation'
import { OverviewScreen } from '@/features/overview/OverviewScreen'
import { loadOverview } from '@/lib/overview.server'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: appCopy.overview.meta }

/** The signed-in home: every agent at once. A visitor has no agents to add up, so they meet the live ones. */
export default async function OverviewPage() {
  const address = await signedInAddress().catch(() => undefined)
  if (!address) redirect('/agents')
  return <OverviewScreen overview={await loadOverview(address)} />
}
