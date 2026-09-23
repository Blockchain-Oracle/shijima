/**
 * The five chains money moves on, with the public RPC and explorer for each. The browser's wallet config
 * (`lib/wagmi.ts`) and the server's receipt checks read the same list, so they can never disagree about a chain.
 */
import { arbitrum, base, bsc, mainnet, robinhood } from 'viem/chains'

/** The RPC the browser reads and sends through on Robinhood Chain. A rehearsal points it at the local fork. */
export const chainRpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com'

export const MONEY_CHAINS = [
  {
    chain: robinhood,
    name: 'Robinhood Chain',
    rpc: chainRpcUrl,
    explorer: 'https://robinhoodchain.blockscout.com',
  },
  { chain: base, name: 'Base', rpc: 'https://mainnet.base.org', explorer: 'https://basescan.org' },
  { chain: arbitrum, name: 'Arbitrum', rpc: 'https://arb1.arbitrum.io/rpc', explorer: 'https://arbiscan.io' },
  {
    chain: mainnet,
    name: 'Ethereum',
    rpc: 'https://ethereum-rpc.publicnode.com',
    explorer: 'https://etherscan.io',
  },
  {
    chain: bsc,
    name: 'BNB Chain',
    rpc: 'https://bsc-dataseed.bnbchain.org',
    explorer: 'https://bscscan.com',
  },
] as const

export const moneyChain = (chainId: number) => MONEY_CHAINS.find((c) => c.chain.id === chainId)

export const txUrl = (chainId: number, hash: string) =>
  `${moneyChain(chainId)?.explorer ?? 'https://robinhoodchain.blockscout.com'}/tx/${hash}`
