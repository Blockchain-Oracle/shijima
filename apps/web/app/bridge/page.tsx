import { moneyCopy } from '@desk/shared'
import { formatUnits } from 'viem'
import { BridgeScreen } from '@/features/money/BridgeScreen'
import type { FundChain } from '@/features/money/FundScreen'
import { SignedOutCard } from '@/features/money/SignedOutCard'
import { walletAssets } from '@/lib/money/assets.server'
import { relayChains } from '@/lib/money/relay.server'
import { signedInAddress } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: moneyCopy.bridge.meta }

const OUT_AS = /^(USDC|ETH|BNB)$/

/** Bridge: USDG out to another chain, money in to an agent, and gas for Robinhood Chain. */
export default async function BridgePage({ searchParams }: { searchParams: Promise<{ dir?: string }> }) {
  const address = await signedInAddress().catch(() => undefined)
  if (!address) return <SignedOutCard />
  const [{ dir }, { assets, ethRaw }, chains] = await Promise.all([
    searchParams,
    walletAssets(address),
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
  const usdg = assets.find((a) => a.kind === 'usdg')
  return (
    <BridgeScreen
      owner={address}
      initialDir={dir === 'in' ? 'in' : 'out'}
      usdgRaw={usdg?.balanceRaw ?? '0'}
      eth={formatUnits(ethRaw, 18)}
      outChains={others
        .map((ch) => ({ ...ch, tokens: ch.tokens.filter((t) => OUT_AS.test(t.symbol)) }))
        .filter((ch) => ch.tokens.length > 0)}
      gasChains={others
        .map((ch) => ({
          ...ch,
          tokens: ch.tokens.filter((t) => t.address === '0x0000000000000000000000000000000000000000'),
        }))
        .filter((ch) => ch.tokens.length > 0)}
    />
  )
}
