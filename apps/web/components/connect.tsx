'use client'

import { short } from '@desk/shared'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { robinhood } from 'viem/chains'
import { createSiweMessage } from 'viem/siwe'
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi'

/**
 * Connect a wallet, then prove it owns its address by signing one message.
 *
 * Signing here costs nothing and moves nothing. It is how the site knows which desk is yours. Every
 * transaction that moves money is a separate signature, asked for at the moment it happens.
 */
export function Connect({ signedInAs }: { signedInAs: string | undefined }) {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: connecting } = useConnect()
  const { disconnect } = useDisconnect()
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
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Sign-in failed.')
      router.refresh()
    } catch (e) {
      setProblem(e instanceof Error ? e.message.split('\n')[0] : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    disconnect()
    router.refresh()
  }

  if (signedInAs) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-ink-soft">{short(signedInAs)}</span>
        <button type="button" onClick={signOut} className="text-ink-faint hover:text-ink">
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {!isConnected ? (
        <button
          type="button"
          disabled={!injected || connecting}
          onClick={() => injected && connect({ connector: injected })}
          className="rounded-md border border-accent px-3 py-1.5 font-medium text-accent text-sm hover:bg-accent hover:text-surface disabled:opacity-50"
        >
          {connecting ? 'Check your wallet…' : injected ? 'Connect a wallet' : 'No wallet found'}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={signIn}
          className="rounded-md border border-accent px-3 py-1.5 font-medium text-accent text-sm hover:bg-accent hover:text-surface disabled:opacity-50"
        >
          {busy ? 'Check your wallet…' : `Sign in as ${short(address ?? '')}`}
        </button>
      )}
      {problem ? <span className="max-w-xs text-blocked text-xs">{problem}</span> : null}
      {!injected ? (
        <span className="max-w-xs text-ink-faint text-xs">
          Install a browser wallet such as MetaMask or Rabby to use a desk.
        </span>
      ) : null}
    </div>
  )
}
