import { arbitrum, base, bsc, mainnet, robinhood } from 'viem/chains'
import { createConfig, http } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { chainRpcUrl, moneyChain } from './money/chains'

/**
 * The wallet, in the browser only.
 *
 * No wallet kit: RainbowKit and ConnectKit still require wagmi 2, and AppKit's wagmi 3 support is unfinished
 * (checked 25 Sep). Our own picker (components/shell/wallet) lists every browser wallet the page finds through
 * EIP-6963, which wagmi does by itself, plus WalletConnect for a wallet on a phone, drawn with our own QR code.
 * WalletConnect needs a Reown project id; without one the picker simply leaves it out.
 *
 * The RPC is passed explicitly, because viem's built-in entry for this chain lists a third-party endpoint we
 * did not choose.
 */
export { chainRpcUrl }

const rpc = (id: number) => moneyChain(id)?.rpc

export const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

// WalletConnect shows the wallet which site is asking, and checks it against the page's own origin.
const siteUrl = typeof window === 'undefined' ? '' : window.location.origin

/**
 * Robinhood Chain is home. The other four are only where an owner may bring dollars from, through Relay: the
 * wallet switches to one for the deposit and back again afterwards.
 */
export const config = createConfig({
  chains: [robinhood, base, arbitrum, mainnet, bsc],
  connectors: [
    injected(),
    // Only in the browser: WalletConnect's provider reaches for indexedDB as soon as it loads, which a server has not.
    ...(walletConnectProjectId && typeof window !== 'undefined'
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            // We draw the QR ourselves, in the picker, from the connector's display_uri message.
            showQrModal: false,
            metadata: {
              name: 'Shijima',
              description: 'AI agents that trade Stock Tokens 24/7 on Robinhood Chain',
              url: siteUrl,
              icons: [`${siteUrl}/icon`],
            },
          }),
        ]
      : []),
  ],
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
