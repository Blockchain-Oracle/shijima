'use client'

import { short, webCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type RefObject, useRef, useState } from 'react'
import { useDisconnect } from 'wagmi'
import { TelegramConnect } from '@/features/settings/TelegramConnect'
import { SignInButton } from './SignInButton'
import type { HeaderTelegram } from './types'
import { useFloatingMenus } from './useFloatingMenus'

/**
 * The account corner, in Agari's shape (`HeaderAccount.tsx`): "Connect" until a wallet is connected, then
 * "Sign in", then the address pill and its menu. Signing in proves the wallet with one message, costs nothing
 * and moves nothing. Every transaction that moves money is a separate signature, asked for when it happens.
 */
export function HeaderAccount({
  signedInAs,
  telegram,
}: {
  signedInAs: string | undefined
  telegram?: HeaderTelegram | null
}) {
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
              {telegram?.linked && (
                <div className="header-account-row">
                  <span>{webCopy.account.telegram}</span>
                  <span className="val val--profit">
                    {telegram.linked.username ? `@${telegram.linked.username}` : webCopy.account.telegramOn}
                  </span>
                </div>
              )}
            </div>
            {/* Mounted only while the menu is open, so a code is made only when someone looks. */}
            {telegram && !telegram.linked && (
              <div className="header-account-telegram">
                <span>{webCopy.account.telegramOff}</span>
                <TelegramConnect compact />
              </div>
            )}
            <Link
              href="/agents"
              className="header-account-link"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              {webCopy.account.yourDesks}
            </Link>
            {telegram && (
              <Link
                href={'/settings' as Route}
                className="header-account-link"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                {webCopy.account.settings}
              </Link>
            )}
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
