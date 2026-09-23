import { APPROVED_TOKENS } from '@desk/chain'
import { agentsPerPreset } from '@desk/db'
import { appCopy, PRESETS } from '@desk/shared'
import { StrategyCatalog } from '@/features/catalog/StrategyCatalog'
import { db } from '@/lib/db'
import { presetPerformance } from '@/lib/markets.server'

export const dynamic = 'force-dynamic'
export const metadata = { title: appCopy.catalog.meta }

/** All twenty strategies, open to everyone. Starting one goes to the studio at /agents/new. */
export default async function StrategiesPage() {
  const [performance, usage] = await Promise.all([
    presetPerformance(30).catch(() => []),
    agentsPerPreset(db()).catch(() => ({})),
  ])
  return (
    <StrategyCatalog
      presets={PRESETS}
      tokens={APPROVED_TOKENS.map((t) => ({
        symbol: t.symbol,
        name: t.displayName,
        address: t.address,
        tradability: t.tradability,
      }))}
      performance={Object.fromEntries(performance.map((p) => [p.id, p]))}
      usage={usage}
    />
  )
}
