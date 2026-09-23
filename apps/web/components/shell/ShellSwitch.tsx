'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { AppShell } from './app/AppShell'
import type { SidebarAgent } from './app/types'
import CustomCursor from './CustomCursor'
import Footer from './Footer'
import GrainOverlay from './GrainOverlay'
import Header, { type HeaderProps } from './Header'
import Marquee, { type TickerCell } from './Marquee'
import { WrongNetworkBanner } from './WrongNetworkBanner'

/**
 * Two shells. The website (the landing page, How it works, the docs) keeps its top header and ticker: it is read
 * before anyone signs in, and it stays reachable after. Everything else is the app, with its sidebar.
 */
const WEBSITE = ['/', '/how-it-works', '/docs']

function isWebsite(pathname: string | null) {
  if (!pathname) return false
  return WEBSITE.some((p) => pathname === p || (p !== '/' && pathname.startsWith(`${p}/`)))
}

export function ShellSwitch({
  children,
  ticker,
  agents,
  ...header
}: HeaderProps & { children: ReactNode; ticker: TickerCell[]; agents: SidebarAgent[] }) {
  const pathname = usePathname()
  if (isWebsite(pathname)) {
    return (
      <>
        <Marquee initial={ticker} />
        <Header {...header} />
        <GrainOverlay />
        <CustomCursor />
        <main className="page-shell">
          <WrongNetworkBanner />
          {children}
        </main>
        <Footer />
      </>
    )
  }
  return (
    <AppShell signedInAs={header.signedInAs} unread={header.unread} agents={agents}>
      {children}
    </AppShell>
  )
}
