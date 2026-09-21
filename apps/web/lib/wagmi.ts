import { robinhood } from 'viem/chains'
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'

/**
 * The wallet, in the browser only.
 *
 * No wallet kit: on wagmi 3 they were all still broken when this was written. An injected wallet is enough,
 * and it keeps the page free of a third party's modal, analytics and network calls.
 *
 * The RPC is passed explicitly, because viem's built-in entry for this chain lists a third-party endpoint we
 * did not choose.
 */
export const config = createConfig({
  chains: [robinhood],
  connectors: [injected()],
  transports: { [robinhood.id]: http('https://rpc.mainnet.chain.robinhood.com') },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
