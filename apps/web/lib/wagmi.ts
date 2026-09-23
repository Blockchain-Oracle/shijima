import { arbitrum, base, bsc, mainnet, robinhood } from 'viem/chains'
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { chainRpcUrl, moneyChain } from './money/chains'

/**
 * The wallet, in the browser only.
 *
 * No wallet kit: on wagmi 3 they were all still broken when this was written. An injected wallet is enough,
 * and it keeps the page free of a third party's modal, analytics and network calls.
 *
 * The RPC is passed explicitly, because viem's built-in entry for this chain lists a third-party endpoint we
 * did not choose.
 */
export { chainRpcUrl }

const rpc = (id: number) => moneyChain(id)?.rpc

/**
 * Robinhood Chain is home. The other four are only where an owner may bring dollars from, through Relay: the
 * wallet switches to one for the deposit and back again afterwards.
 */
export const config = createConfig({
  chains: [robinhood, base, arbitrum, mainnet, bsc],
  connectors: [injected()],
  transports: {
    [robinhood.id]: http(chainRpcUrl),
    [base.id]: http(rpc(base.id)),
    [arbitrum.id]: http(rpc(arbitrum.id)),
    [mainnet.id]: http(rpc(mainnet.id)),
    [bsc.id]: http(rpc(bsc.id)),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
