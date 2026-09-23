import { APPROVED_TOKENS } from '@desk/chain'
import {
  desksOfOwner,
  disclosureAccepted,
  draftDeskOf,
  GO_LIVE_CHECKS,
  ownerIdOf,
  sharedMixes,
} from '@desk/db'
import { DISCLOSURE_VERSION, deskCopy, PRESETS, studioCopy } from '@desk/shared'
import { type OwnDesk, type SharedMix, StrategiesScreen } from '@/features/strategies/StrategiesScreen'
import { currentDeployment } from '@/lib/chain'
import { db } from '@/lib/db'
import { presetPerformance } from '@/lib/markets.server'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: studioCopy.tabs.create }

const symbolOf = new Map(APPROVED_TOKENS.map((t) => [t.address.toLowerCase(), t.symbol]))

/**
 * The strategies studio (FIDELITY 4.3, plan step 10). Drafting needs nothing; the test read needs a sign-in, and
 * creating the desk needs the wallet. `?preset=` arrives from "Start a desk with this" on the markets page.
 */
export default async function Strategies({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; view?: string }>
}) {
  const { preset, view } = await searchParams
  const address = (await signedInAddress().catch(() => undefined)) ?? null
  const deployment = currentDeployment()

  const [mixes, desks, draft, ownerId, performance] = await Promise.all([
    sharedMixes(db()),
    address ? desksOfOwner(db(), address) : Promise.resolve([]),
    address ? draftDeskOf(db(), address, deployment.factory) : Promise.resolve(undefined),
    address ? ownerIdOf(db(), address) : Promise.resolve(undefined),
    presetPerformance(30).catch(() => []),
  ])
  const accepted = ownerId ? await disclosureAccepted(db(), ownerId, DISCLOSURE_VERSION) : null

  const shared: SharedMix[] = mixes.flatMap((m) =>
    m.shareSlug
      ? [
          {
            name: m.name ?? studioCopy.side.unnamed,
            slug: m.shareSlug,
            mode: deskCopy.modes[m.mode],
            cashBps: m.targets.cashBps,
            weights: Object.fromEntries(
              m.targets.tokens.flatMap((t) => {
                const symbol = symbolOf.get(t.token.toLowerCase())
                return symbol ? [[symbol, t.weightBps]] : []
              }),
            ),
          },
        ]
      : [],
  )
  const own: OwnDesk[] = desks.map((d) => ({
    id: d.id,
    slug: d.shareSlug ?? d.id,
    name: d.name ?? studioCopy.side.unnamed,
    lifecycle: d.lifecycle,
    mode: deskCopy.modes[d.mode],
    checks: d.shadowChecks,
  }))

  return (
    <StrategiesScreen
      presets={PRESETS}
      tokens={APPROVED_TOKENS.map((t) => ({
        symbol: t.symbol,
        name: t.displayName,
        address: t.address,
        tradability: t.tradability,
      }))}
      shared={shared}
      own={own}
      draftDesk={draft ? { address: draft.address, name: draft.name } : null}
      signedIn={address}
      disclosureOn={accepted ? accepted.toLocaleDateString('en-GB', { dateStyle: 'medium' }) : null}
      contractVersion={deployment.version}
      requestedPreset={preset}
      requestedView={view}
      goLiveChecks={GO_LIVE_CHECKS}
      performance={Object.fromEntries(performance.map((p) => [p.id, p]))}
    />
  )
}
