import { APPROVED_TOKENS } from '@desk/chain'
import { disclosureAccepted, GO_LIVE_CHECKS, ownerIdOf } from '@desk/db'
import { DISCLOSURE_VERSION, PRESETS, studioCopy } from '@desk/shared'
import { copyQuoteAction } from '@/app/copy-actions'
import { StrategiesScreen } from '@/features/strategies/StrategiesScreen'
import { currentDeployment } from '@/lib/chain'
import { db } from '@/lib/db'
import { presetPerformance } from '@/lib/markets.server'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: studioCopy.newTitle }

/**
 * Create an agent: strategy, amount, limits, review. Drafting needs nothing; creating needs a signed-in wallet.
 * `?preset=` arrives from "Start with this" on a strategy, `?copy=` from "Copy this agent".
 */
export default async function NewAgent({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; copy?: string }>
}) {
  const { preset, copy } = await searchParams
  const address = (await signedInAddress().catch(() => undefined)) ?? null
  const deployment = currentDeployment()

  const [ownerId, performance] = await Promise.all([
    address ? ownerIdOf(db(), address) : Promise.resolve(undefined),
    presetPerformance(30).catch(() => []),
  ])
  const accepted = ownerId ? await disclosureAccepted(db(), ownerId, DISCLOSURE_VERSION) : null
  const quote = copy ? await copyQuoteAction(copy).catch(() => null) : null
  const copyOf = quote?.ok && !quote.mine ? quote : null

  return (
    <StrategiesScreen
      presets={PRESETS}
      tokens={APPROVED_TOKENS.map((t) => ({
        symbol: t.symbol,
        name: t.displayName,
        address: t.address,
        tradability: t.tradability,
      }))}
      signedIn={address}
      disclosureOn={accepted ? accepted.toLocaleDateString('en-GB', { dateStyle: 'medium' }) : null}
      contractVersion={deployment.version}
      requestedPreset={preset}
      copyOf={copyOf}
      goLiveChecks={GO_LIVE_CHECKS}
      performance={Object.fromEntries(performance.map((p) => [p.id, p]))}
    />
  )
}
