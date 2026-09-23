import { desksOfOwner } from '@desk/db'
import { moneyCopy } from '@desk/shared'
import { SignedOutCard } from '@/features/money/SignedOutCard'
import { WithdrawScreen } from '@/features/money/WithdrawScreen'
import { db } from '@/lib/db'
import { signedInAddress } from '@/lib/session'
import { loadWallet } from '@/lib/wallet.server'

export const dynamic = 'force-dynamic'
export const metadata = { title: moneyCopy.withdraw.meta }

/** Withdraw: each open agent with what it holds now, read from the chain. `?agent=slug` opens on that agent. */
export default async function WithdrawPage({ searchParams }: { searchParams: Promise<{ agent?: string }> }) {
  const address = await signedInAddress().catch(() => undefined)
  if (!address) return <SignedOutCard />
  const [{ agent }, w, desks] = await Promise.all([
    searchParams,
    loadWallet(address),
    desksOfOwner(db(), address),
  ])
  const version = new Map(desks.map((d) => [d.id, d.contractVersion]))
  return (
    <WithdrawScreen
      initialAgent={agent ?? null}
      agents={w.agents.map((a) => ({
        id: a.id,
        slug: a.slug,
        name: a.name,
        address: a.address,
        owner: address,
        contractVersion: version.get(a.id) ?? 'v1',
        cashUsd: Number(a.cashUsdg) / 1e6,
        savingsUsd: Number(a.savingsUsdg) / 1e6,
        stocks: a.stocks.map((s) => ({
          symbol: s.symbol,
          name: s.name,
          valueUsd: s.valueUsdg === null ? null : Number(s.valueUsdg) / 1e6,
        })),
      }))}
    />
  )
}
