import { readWallet } from '@desk/chain'
import { desksOfOwner } from '@desk/db'
import { moneyCopy } from '@desk/shared'
import type { Address } from 'viem'
import { type FundChain, FundScreen } from '@/features/money/FundScreen'
import { SignedOutCard } from '@/features/money/SignedOutCard'
import { pub } from '@/lib/chain-build.server'
import { db } from '@/lib/db'
import { relayChains } from '@/lib/money/relay.server'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: moneyCopy.fund.meta }

/** Fund an agent: your agents, what your wallet holds now, and what Relay can bring from other chains. */
export default async function FundPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string; from?: string }>
}) {
  const address = await signedInAddress().catch(() => undefined)
  if (!address) return <SignedOutCard />
  const [{ agent, from }, desks, wallet, chains] = await Promise.all([
    searchParams,
    desksOfOwner(db(), address),
    readWallet(pub(), address as Address).catch(() => null),
    relayChains().catch(() => []),
  ])
  const others: FundChain[] = chains
    .filter((ch) => ch.id !== 4663)
    .map((ch) => ({
      id: ch.id,
      name: ch.name,
      tokens: ch.tokens.map((t) => ({
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
      })),
    }))
  return (
    <FundScreen
      owner={address}
      agents={desks
        .filter((d) => d.lifecycle !== 'closed')
        .map((d) => ({ id: d.id, slug: d.shareSlug ?? d.id, name: d.name ?? 'Agent', address: d.address }))}
      assets={(wallet?.holdings ?? [])
        .filter((h) => h.amountRaw > 0n)
        .map((h) => ({
          symbol: h.symbol,
          name: h.name,
          token: h.token,
          decimals: h.decimals,
          balanceRaw: h.amountRaw.toString(),
          valueUsd: h.valueUsdg === null ? null : Number(h.valueUsdg) / 1e6,
          kind: h.kind,
        }))}
      chains={others}
      initialAgent={agent ?? null}
      initialSource={from === 'chain' || from === 'anywhere' ? from : 'wallet'}
    />
  )
}
