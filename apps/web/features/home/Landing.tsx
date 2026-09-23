import { publicAgents } from '@/lib/agents.server'
import { currentDeployment } from '@/lib/chain'
import { currentVaultRateBps, loadDesk } from '@/lib/desk.server'
import { loadWeekendFact, presetPerformance } from '@/lib/markets.server'
import { HomePage } from './HomePage'

/** The shared agent the landing shows at work: "Shijima's own", live on mainnet with real money, shared read-only. */
const SHOWCASE_SLUG = 'showcase'

/** The landing page with its live data, for `/` (visitors) and `/home` (everyone, always). */
export async function Landing() {
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
