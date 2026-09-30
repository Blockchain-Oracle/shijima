'use client'

import {
  Captcha,
  type ConnectedWallet,
  PrivyProvider,
  useCreateWallet,
  useLoginWithEmail,
  useLoginWithSiwe,
  usePrivy,
  useUser,
  useWallets,
} from '@privy-io/react-auth'
import { type ReactNode, useCallback, useEffect, useRef } from 'react'
import { type EIP1193Provider, getAddress } from 'viem'
import { arbitrum, base, bsc, mainnet, robinhood } from 'viem/chains'
import { useAccount, useConnect, useSignMessage } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { prepareEmailWallet } from '@/lib/email-wallet'
import { chainRpcUrl } from '@/lib/wagmi'
import { EmailContext } from './email-auth-context'

/** Existing wallet connectors stay intact. Email wallets use the same public EIP-1193 connector API. */
export function EmailAuthProvider({
  children,
  enabled,
  signedInAs,
}: {
  children: ReactNode
  enabled: boolean
  signedInAs?: string | undefined
}) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID
  if (!enabled || !appId) return children
  // Privy's bundled viem version has different optional chain extensions. Pass the shared chain metadata.
  const chains = [robinhood, base, arbitrum, mainnet, bsc].map((chain) => ({
    id: chain.id,
    name: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: { default: { http: chain.id === robinhood.id ? [chainRpcUrl] : chain.rpcUrls.default.http } },
    blockExplorers: chain.blockExplorers,
  }))
  const defaultChain = chains[0]
  if (!defaultChain) return children
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'wallet'],
        defaultChain,
        supportedChains: chains,
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        appearance: { theme: 'dark', accentColor: '#CCFF00', logo: '/icon', showWalletLoginFirst: false },
      }}
    >
      <EmailBridge signedInAs={signedInAs}>{children}</EmailBridge>
      <Captcha />
    </PrivyProvider>
  )
}

function EmailBridge({ children, signedInAs }: { children: ReactNode; signedInAs?: string | undefined }) {
  const privy = usePrivy()
  const { wallets, ready: walletsReady } = useWallets()
  const otp = useLoginWithEmail()
  const siwe = useLoginWithSiwe()
  const { createWallet } = useCreateWallet()
  const { refreshUser } = useUser()
  const preparing = useRef<Promise<void> | null>(null)
  const { address, isConnected } = useAccount()
  const { connectAsync } = useConnect()
  const { signMessageAsync } = useSignMessage()
  const restoring = useRef(false)

  const prepareWallet = useCallback(() => {
    // A retry joins an in-flight creation, so a slow response cannot create a second wallet.
    if (preparing.current) return preparing.current
    const operation = prepareEmailWallet(refreshUser, () => createWallet())
    preparing.current = operation
    void operation
      .finally(() => {
        if (preparing.current === operation) preparing.current = null
      })
      .catch(() => {})
    return operation
  }, [refreshUser, createWallet])

  const connect = useCallback(
    async (wallet: ConnectedWallet) => {
      const provider = await wallet.getEthereumProvider()
      await connectAsync({
        connector: injected({
          target: {
            id: `shijima.email.${wallet.address.toLowerCase()}`,
            name: wallet.walletClientType === 'privy' ? 'Email wallet' : wallet.meta.name,
            // Both expose EIP-1193; their libraries type event handlers differently.
            provider: provider as unknown as EIP1193Provider,
          },
        }),
      })
    },
    [connectAsync],
  )

  // Restores only the embedded wallet belonging to the current server session, never a different account.
  useEffect(() => {
    const wallet = wallets.find(
      (w) => w.walletClientType === 'privy' && w.address.toLowerCase() === signedInAs,
    )
    if (!wallet || !walletsReady || isConnected || restoring.current) return
    restoring.current = true
    void connect(wallet).catch(() => {
      restoring.current = false
    })
  }, [wallets, walletsReady, signedInAs, isConnected, connect])

  const prepareLink = async (owner: string) => {
    if (address?.toLowerCase() !== owner.toLowerCase())
      throw new Error('Reconnect the wallet that owns this account first.')
    const linked = privy.user?.linkedAccounts.some(
      (a) => a.type === 'wallet' && a.address.toLowerCase() === owner.toLowerCase(),
    )
    if (privy.authenticated && linked) return
    if (privy.authenticated) await privy.logout()
    const message = await siwe.generateSiweMessage({
      address: getAddress(owner),
      chainId: `eip155:${robinhood.id}`,
    })
    const signature = await signMessageAsync({ message })
    await siwe.loginWithSiwe({ message, signature })
  }

  const finish = async (owner: string, link = false) => {
    const token = await privy.getAccessToken()
    if (!token) throw new Error('Your email session expired. Request another code.')
    if (!link) {
      const wallet = wallets.find((w) => w.address.toLowerCase() === owner.toLowerCase())
      const embedded = privy.user?.linkedAccounts.some(
        (a) =>
          a.type === 'wallet' &&
          a.walletClientType === 'privy' &&
          a.address.toLowerCase() === owner.toLowerCase(),
      )
      if (embedded && !wallet)
        throw new Error('Your email wallet is still connecting. Try again in a moment.')
      if (wallet) await connect(wallet)
    }
    const res = await fetch('/api/auth/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ address: owner, link }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error ?? 'Could not finish signing in. Try again.')
  }

  return (
    <EmailContext.Provider
      value={{
        enabled: true,
        ready: privy.ready,
        authenticated: privy.authenticated && Boolean(privy.user?.email),
        email: privy.user?.email?.address,
        wallets,
        accounts:
          privy.user?.linkedAccounts.flatMap((a) =>
            a.type === 'wallet' && a.chainType === 'ethereum'
              ? [{ address: a.address, embedded: a.walletClientType === 'privy' }]
              : [],
          ) ?? [],
        sendCode: async (email) => {
          await otp.sendCode({ email })
        },
        verifyCode: async (code) => {
          await otp.loginWithCode({ code })
        },
        prepareWallet,
        prepareLink,
        finish,
        logout: privy.logout,
      }}
    >
      {children}
    </EmailContext.Provider>
  )
}
