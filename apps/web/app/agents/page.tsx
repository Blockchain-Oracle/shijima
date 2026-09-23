import { appCopy } from '@desk/shared'
import { AgentsScreen } from '@/features/agents/AgentsScreen'
import { publicAgents } from '@/lib/agents.server'
import { loadOverview } from '@/lib/overview.server'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: appCopy.agents.meta }

/** Everyone's shared agents, open to visitors, with the owner's own on top when signed in. */
export default async function AgentsPage() {
  const address = await signedInAddress().catch(() => undefined)
  const [live, overview] = await Promise.all([
    publicAgents().catch(() => []),
    address ? loadOverview(address) : Promise.resolve(null),
  ])
  return <AgentsScreen mine={overview?.agents ?? []} signedIn={address !== undefined} live={live} />
}
