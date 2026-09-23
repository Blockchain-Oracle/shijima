import { homeCopy } from '@desk/shared'
import { HomePage } from '@/features/home/HomePage'
import { currentDeployment } from '@/lib/chain'
import { publicAgents } from '@/lib/agents.server'
import { currentVaultRateBps, loadDesk } from '@/lib/desk.server'
import { loadWeekendFact, presetPerformance } from '@/lib/markets.server'

export const dynamic = 'force-dynamic'
export const metadata = { title: { absolute: homeCopy.meta.title }, description: homeCopy.meta.description }

/** The shared desk the home page shows at work. It is Abu's live dev desk, shared read-only. */
const SHOWCASE_SLUG = 'showcase'

/**
 * The landing page, for everyone, signed in or not: what Shijima is, live agents at work, and how to start. A
 * signed-in owner reaches their app from the header's "Open app"; this page never sends anyone away.
 */
export default async function Home() {
  const [showcase, agents, weekendFact, performance, vaultRateBps] = await Promise.all([
    loadDesk(SHOWCASE_SLUG).catch(() => undefined),
    publicAgents().catch(() => []),
    loadWeekendFact().catch(() => null),
    presetPerformance(30).catch(() => []),
    currentVaultRateBps().catch(() => null),
  ])
  return (
    <HomePage
      showcase={showcase}
      agents={agents}
      weekendFact={weekendFact}
      performance={performance}
      vaultRateBps={vaultRateBps}
      factory={currentDeployment().factory}
    />
  )
}
