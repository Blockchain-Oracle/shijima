import { createPublicClient, fallback, http, type PublicClient } from 'viem'
import { robinhood } from 'viem/chains'
import { OFFICIAL_RPC } from './addresses'

/**
 * viem's built-in `robinhood` chain lists a third-party RPC second. We never use it: the transport is
 * always given explicit URLs. Pass an Alchemy URL first when one is available, with the official public
 * RPC as the fallback. The public RPC is rate limited and keeps only about ten minutes of state.
 */
export function makePublicClient(rpcUrls: string[] = [OFFICIAL_RPC]): PublicClient {
  const urls = rpcUrls.length > 0 ? rpcUrls : [OFFICIAL_RPC]
  return createPublicClient({
    chain: robinhood,
    transport: fallback(urls.map((u) => http(u, { retryCount: 3, retryDelay: 400, timeout: 20_000 }))),
    batch: { multicall: { batchSize: 4096, wait: 16 } },
  })
}
