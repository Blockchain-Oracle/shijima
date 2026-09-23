import 'server-only'
import { readWallet } from '@desk/chain'
import type { Address } from 'viem'
import type { FundAsset } from '@/features/money/FundScreen'
import { pub } from '@/lib/chain-build.server'

/** What the owner's own wallet holds on Robinhood Chain right now, priced, as the money screens list it. */
export async function walletAssets(owner: string): Promise<{ assets: FundAsset[]; ethRaw: bigint }> {
  const wallet = await readWallet(pub(), owner as Address).catch(() => null)
  const holdings = wallet?.holdings ?? []
  return {
    ethRaw: holdings.find((h) => h.kind === 'eth')?.amountRaw ?? 0n,
    assets: holdings
      .filter((h) => h.amountRaw > 0n)
      .map((h) => ({
        symbol: h.symbol,
        name: h.name,
        token: h.token,
        decimals: h.decimals,
        balanceRaw: h.amountRaw.toString(),
        valueUsd: h.valueUsdg === null ? null : Number(h.valueUsdg) / 1e6,
        kind: h.kind,
      })),
  }
}
