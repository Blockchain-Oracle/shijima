'use client'

import { webCopy } from '@desk/shared'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HeaderAccount } from './HeaderAccount'
import { HeaderInbox } from './HeaderInbox'
import { HeaderMoneyPill } from './HeaderMoneyPill'
import { MobileBottomNav } from './MobileBottomNav'
import { DESKTOP_NAV, isActiveNavItem } from './nav-items'
import { ShijimaMark } from './ShijimaMark'
import ThemeToggle from './ThemeToggle'

export interface HeaderProps {
  signedInAs: string | undefined
  /** What the owner's desks held at their last check, raw USDG as a string; null when none has been valued. */
  desksTotalUsdg: string | null
  /** Messages the owner has not opened yet. */
  unread: number
  /** The owner's open desk and whether its Telegram is linked, for the account menu. */
  telegram: HeaderTelegram | null
}

export interface HeaderTelegram {
  deskId: string
  linked: { username: string | null } | null
}

/** Agari's header (`components/shell/header/Header.tsx`), with our nav, our mark and our account corner. */
export default function Header({ signedInAs, desksTotalUsdg, unread, telegram }: HeaderProps) {
  const pathname = usePathname()
  return (
    <>
      <header className="header">
        <Link className="logo" href="/" aria-label={webCopy.nav.homeAria} data-cursor="hover">
          <span className="logo-mark">
            <ShijimaMark />
          </span>
          <span>{webCopy.brand.name.toUpperCase()}</span>
          <span className="logo-ja" lang="ja">
            {webCopy.brand.ja}
          </span>
        </Link>

        <nav className="nav" aria-label={webCopy.nav.primaryAria}>
          <div className="nav-links">
            {DESKTOP_NAV.map((item) => {
              const active = isActiveNavItem(pathname, item)
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`nav-link ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  data-cursor="hover"
                >
                  {item.name}
                </Link>
              )
            })}
          </div>

          <div className="header-right">
            <ThemeToggle />
            {signedInAs ? <HeaderInbox unread={unread} /> : null}
            {signedInAs ? <HeaderMoneyPill totalUsdg={desksTotalUsdg} /> : null}
            <HeaderAccount signedInAs={signedInAs} telegram={telegram} />
          </div>
        </nav>
      </header>
      <MobileBottomNav />
    </>
  )
}
