'use client'

import { short, webCopy } from '@desk/shared'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { robinhood } from 'viem/chains'
import { createSiweMessage } from 'viem/siwe'
import { useAccount, useConnect, useSignMessage } from 'wagmi'

/**
 * "Connect", then "Sign in": the header's button, also used wherever a page needs a signed-in wallet (the Room,
 * the take composer), as Agari's `ConnectButton` is. Signing in proves the wallet with one message, costs nothing
 * and moves nothing. `onSignedIn` lets a caller re-read what depends on the session.
 */
export function SignInButton({
  onSignedIn,
  className = 'btn btn-primary',
}: {
  onSignedIn?: () => void
  className?: string
}) {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: connecting } = useConnect()
  const { signMessageAsync } = useSignMessage()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string>()
  const injected = connectors[0]

  const signIn = async () => {
    if (!address) return
    setBusy(true)
    setProblem(undefined)
    try {
      const { nonce } = (await (await fetch('/api/auth/nonce')).json()) as { nonce: string }
      const message = createSiweMessage({
        address,
        chainId: robinhood.id,
        domain: window.location.host,
        nonce,
        uri: window.location.origin,
        version: '1',
        statement: 'Prove this wallet is yours. This costs nothing and moves nothing.',
      })
      const signature = await signMessageAsync({ message })
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      })
      if (!res.ok)
        throw new Error(((await res.json()) as { error?: string }).error ?? webCopy.account.signInFailed)
      router.refresh()
      onSignedIn?.()
    } catch (e) {
      setProblem(e instanceof Error ? e.message.split('\n')[0] : webCopy.account.signInFailed)
    } finally {
      setBusy(false)
    }
  }

  const label = !injected
    ? webCopy.account.noWallet
    : !isConnected
      ? connecting
        ? webCopy.account.connecting
        : webCopy.account.connect
      : busy
        ? webCopy.account.connecting
        : webCopy.account.signIn(short(address ?? '', 6, 4))

  return (
    <div className="relative flex flex-col items-end">
      <button
        type="button"
        className={className}
        data-cursor="hover"
        disabled={!injected || connecting || busy}
        title={!injected ? webCopy.account.installWallet : webCopy.account.signInNote}
        onClick={() => (!isConnected ? injected && connect({ connector: injected }) : void signIn())}
      >
        {label}
      </button>
      {problem ? (
        <span className="absolute top-full right-0 mt-2 max-w-xs text-right text-loss type-caption">
          {problem}
        </span>
      ) : null}
    </div>
  )
}
