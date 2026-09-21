'use client'

import { short, webCopy } from '@desk/shared'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type RefObject, useRef, useState } from 'react'
import { robinhood } from 'viem/chains'
import { createSiweMessage } from 'viem/siwe'
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi'
import { useFloatingMenus } from './useFloatingMenus'

/**
 * The account corner, in Agari's shape (`HeaderAccount.tsx`): "Connect" until a wallet is connected, then
 * "Sign in", then the address pill and its menu. Signing in proves the wallet with one message, costs nothing
 * and moves nothing. Every transaction that moves money is a separate signature, asked for when it happens.
 */
export function HeaderAccount({ signedInAs }: { signedInAs: string | undefined }) {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: connecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { signMessageAsync } = useSignMessage()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string>()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const refs = useRef<ReadonlyArray<RefObject<HTMLElement | null>>>([menuRef])
  useFloatingMenus(refs.current, () => setOpen(false))

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
    } catch (e) {
      setProblem(e instanceof Error ? e.message.split('\n')[0] : webCopy.account.signInFailed)
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    setOpen(false)
    await fetch('/api/auth/logout', { method: 'POST' })
    disconnect()
    router.refresh()
  }

  if (signedInAs) {
    return (
      <div className="relative" ref={menuRef} data-cursor="hover">
        <button
          type="button"
          className="wallet-pill"
          aria-label={webCopy.account.menu}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="addr-dot" />
          <span title={signedInAs}>{short(signedInAs, 6, 4)}</span>
        </button>
        {open && (
          <div className="header-account-menu" role="menu">
            <div className="header-account-pools">
              <div className="header-account-row">
                <span>{webCopy.account.signedInAs}</span>
                <span className="val">{short(signedInAs, 6, 4)}</span>
              </div>
            </div>
            <Link
              href="/desks"
              className="header-account-link"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              {webCopy.account.yourDesks}
            </Link>
            <button
              type="button"
              className="header-account-link header-account-link--danger"
              role="menuitem"
              onClick={signOut}
            >
              {webCopy.account.signOut}
            </button>
          </div>
        )}
      </div>
    )
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
        className="btn btn-primary"
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
