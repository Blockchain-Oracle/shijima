'use client'

import { short, webCopy } from '@desk/shared'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type RefObject, useRef, useState } from 'react'
import { useDisconnect } from 'wagmi'
import { SignInButton } from './SignInButton'
import { useFloatingMenus } from './useFloatingMenus'

/**
 * The account corner, in Agari's shape (`HeaderAccount.tsx`): "Connect" until a wallet is connected, then
 * "Sign in", then the address pill and its menu. Signing in proves the wallet with one message, costs nothing
 * and moves nothing. Every transaction that moves money is a separate signature, asked for when it happens.
 */
export function HeaderAccount({ signedInAs }: { signedInAs: string | undefined }) {
  const router = useRouter()
  const { disconnect } = useDisconnect()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const refs = useRef<ReadonlyArray<RefObject<HTMLElement | null>>>([menuRef])
  useFloatingMenus(refs.current, () => setOpen(false))

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

  return <SignInButton />
}
