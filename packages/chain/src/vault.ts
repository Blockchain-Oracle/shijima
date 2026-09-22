/**
 * The savings vault: Steakhouse USDG, a Morpho Vault V2, the vault Robinhood Earn deposits into.
 *
 * Two facts come from outside the chain, and both are read live, never written down:
 *   - the rate it pays, from Morpho's own API (`netApy`, after the vault's fees);
 *   - how much can be taken out right now (`liquidity`). Most of the vault is lent out, so only part of it is
 *     instantly withdrawable. A redeem larger than that simply reverts.
 * `maxDeposit` and `maxWithdraw` are never read: in Vault V2 they return 0 by design.
 */
import type { PublicClient } from 'viem'
import { aggregatorV3Abi, vaultAbi } from './abis'
import { ETH_USD_FEED, VAULT } from './addresses'

const MORPHO_API = 'https://api.morpho.org/graphql'
const CHAIN_ID = 4663

/**
 * Gas for one deposit and one later redeem, measured on this chain: real deposits used 509,206 and 509,254 gas,
 * and a redeem that pulls from the lending market costs several times the 27,000 of one that finds idle cash.
 * Units are fixed; the price per unit is read live, so the dollar figure moves with the network.
 */
export const SWEEP_GAS = 520_000n
export const REDEEM_GAS = 300_000n

export interface VaultRate {
  /** What the vault pays a year after its fees, in basis points. */
  netApyBps: number
  /** USDG that can be taken out right now, 6 decimals. */
  liquidityUsdg: bigint
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** undefined when Morpho's API cannot be reached. The caller must not move money on a rate it could not read. */
export async function fetchVaultRate(attempts = 3): Promise<VaultRate | undefined> {
  const query = `query { vaultV2ByAddress(address: "${VAULT}", chainId: ${CHAIN_ID}) { netApy liquidity } }`
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(MORPHO_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) throw new Error(`status ${res.status}`)
      const body = (await res.json()) as {
        data?: { vaultV2ByAddress?: { netApy?: unknown; liquidity?: unknown } | null }
      }
      const v = body.data?.vaultV2ByAddress
      if (!v || typeof v.netApy !== 'number' || !Number.isFinite(v.netApy))
        throw new Error('unexpected shape')
      const liquidity =
        typeof v.liquidity === 'number' || typeof v.liquidity === 'string' ? v.liquidity : null
      if (liquidity === null) throw new Error('no liquidity figure')
      return {
        netApyBps: Math.max(0, Math.round(v.netApy * 10_000)),
        liquidityUsdg: BigInt(Math.floor(Number(liquidity))),
      }
    } catch {
      await sleep(1000 * (i + 1))
    }
  }
  return undefined
}

/** What these shares are worth in USDG now. */
export async function vaultAssetsOf(client: PublicClient, shares: bigint): Promise<bigint> {
  if (shares === 0n) return 0n
  return client.readContract({
    address: VAULT,
    abi: vaultAbi,
    functionName: 'convertToAssets',
    args: [shares],
  })
}

/** The shares a deposit of `usdg` would mint. */
export async function previewSweep(client: PublicClient, usdg: bigint): Promise<bigint> {
  return client.readContract({ address: VAULT, abi: vaultAbi, functionName: 'previewDeposit', args: [usdg] })
}

/** The shares to redeem to get at least `usdg` back. Rounds up, as ERC-4626 requires. */
export async function sharesFor(client: PublicClient, usdg: bigint): Promise<bigint> {
  return client.readContract({ address: VAULT, abi: vaultAbi, functionName: 'previewWithdraw', args: [usdg] })
}

/** USDG `shares` would redeem for. */
export async function previewRedeem(client: PublicClient, shares: bigint): Promise<bigint> {
  return client.readContract({ address: VAULT, abi: vaultAbi, functionName: 'previewRedeem', args: [shares] })
}

/**
 * What one sweep and its later redeem cost in network fees, in USDG (6 decimals), at today's gas price and the
 * Chainlink ETH price. The operator pays it, so it is the bar a sweep's interest has to clear.
 */
export async function vaultRoundTripFeeUsdg(client: PublicClient): Promise<bigint> {
  const [block, [, ethUsd]] = await Promise.all([
    client.getBlock(),
    client.readContract({ address: ETH_USD_FEED, abi: aggregatorV3Abi, functionName: 'latestRoundData' }),
  ])
  if (ethUsd <= 0n) throw new Error('the ETH price feed returned nothing')
  // An Arbitrum-stack chain ignores tips: what a transaction pays per unit is the block's base fee.
  const gasPrice = block.baseFeePerGas ?? (await client.getGasPrice())
  const wei = (SWEEP_GAS + REDEEM_GAS) * gasPrice
  // wei (18) x price (8) -> USDG (6): divide by 10^20.
  return (wei * ethUsd) / 10n ** 20n
}
