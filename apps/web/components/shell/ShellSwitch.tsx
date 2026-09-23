'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { WebsiteShell } from '@/features/home/landing/WebsiteShell'
import { AppShell } from './app/AppShell'
import type { SidebarAgent } from './app/types'
import type { TickerCell } from './Marquee'
import type { HeaderProps } from './types'

/**
 * Two shells. The website (the landing page at / and /home, How it works, the docs) is the reference landing's
 * nav pill, the page and its footer: it is read before anyone signs in, and it stays reachable after. Everything
 * else is the app, with its sidebar. The live prices ride the landing's Built-on strip now, not a ticker here.
 */
const WEBSITE = ['/', '/home', '/how-it-works', '/docs']

function isWebsite(pathname: string | null) {
  if (!pathname) return false
  return WEBSITE.some((p) => pathname === p || (p !== '/' && pathname.startsWith(`${p}/`)))
}

export function ShellSwitch({
  children,
  agents,
  ...header
}: HeaderProps & { children: ReactNode; ticker: TickerCell[]; agents: SidebarAgent[] }) {
  const pathname = usePathname()
  if (isWebsite(pathname)) {
    return <WebsiteShell signedIn={Boolean(header.signedInAs)}>{children}</WebsiteShell>
  }
  return (
    <AppShell signedInAs={header.signedInAs} unread={header.unread} agents={agents}>
      {children}
    </AppShell>
  )
}
