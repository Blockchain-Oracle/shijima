/**
 * Robinhood Chain mainnet (4663). Every address here was confirmed on-chain on 2026-09-19.
 * See docs/research/chain-facts-verified.md and docs/research/architecture/03-desk-account.md.
 */
import type { Address } from 'viem'

export const CHAIN_ID = 4663
export const OFFICIAL_RPC = 'https://rpc.mainnet.chain.robinhood.com'
export const EXPLORER = 'https://robinhoodchain.blockscout.com'

export const USDG: Address = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168' // Paxos, 6 decimals
export const USDG_DECIMALS = 6

export const UNISWAP_V3 = {
  factory: '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA',
  swapRouter02: '0xCaf681a66D020601342297493863E78C959E5cb2',
  quoterV2: '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7',
} as const satisfies Record<string, Address>

/** Steakhouse USDG, Morpho Vault V2, ERC-4626. Never read maxDeposit or maxWithdraw: they return 0 by design. */
export const VAULT: Address = '0xBeEff033F34C046626B8D0A041844C5d1A5409dd'

/** Every Uniswap v3 fee tier. The deep pool is NOT always 500: TSLA and MSFT sit in 3000. */
export const FEE_TIERS = [100, 500, 3000, 10000] as const
export type FeeTier = (typeof FEE_TIERS)[number]

/** Chainlink ETH / USD on this chain, 8 decimals. Only for showing network fees in dollars, never for a trade. */
export const ETH_USD_FEED: Address = '0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9'

export const RHJ_API = 'https://api.robinhood.com/rhj'
export const CHAINLINK_FEEDS_DIRECTORY =
  'https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json'
