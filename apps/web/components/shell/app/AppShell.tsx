'use client'

import { appCopy, webCopy } from '@desk/shared'
import { ChartLine, LayoutDashboard, ListTree, Menu, PanelLeft, Radar } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  AnimatedSidebarInset,
  AnimatedSidebarProvider,
  AnimatedSidebarTrigger,
  useAnimatedSidebar,
} from '@/components/ui/animated-sidebar'
import { cn } from '@/lib/utils'
import Footer from '../Footer'
import GrainOverlay from '../GrainOverlay'
import { HeaderAccount } from '../HeaderAccount'
import { HeaderInbox } from '../HeaderInbox'
import { ShijimaMark } from '../ShijimaMark'
import ThemeToggle from '../ThemeToggle'
import { WrongNetworkBanner } from '../WrongNetworkBanner'
import { AppSidebar } from './AppSidebar'
import type { SidebarAgent } from './types'

export interface AppShellProps {
  children: ReactNode
  signedInAs: string | undefined
  unread: number
  agents: SidebarAgent[]
}

/**
 * The signed-in app: the sidebar on the left, a slim bar on top (the sidebar toggle, the bell, the theme and the
 * account), the page, and on a phone a bottom bar that holds its own height so it never covers the page.
 */
export function AppShell({ children, signedInAs, unread, agents }: AppShellProps) {
  return (
    <AnimatedSidebarProvider className="app-shell">
      <AppSidebar signedInAs={signedInAs} agents={agents} />
      <AnimatedSidebarInset className="app-inset">
        <TopBar signedInAs={signedInAs} unread={unread} />
        <GrainOverlay />
        <div className="app-page">
          <WrongNetworkBanner />
          {children}
        </div>
        <Footer />
        <BottomBar signedIn={signedInAs !== undefined} />
      </AnimatedSidebarInset>
    </AnimatedSidebarProvider>
  )
}

function TopBar({ signedInAs, unread }: { signedInAs: string | undefined; unread: number }) {
  return (
    <header className="app-topbar">
      <AnimatedSidebarTrigger
        className="app-topbar-trigger hidden md:inline-flex"
        aria-label={appCopy.sidebar.toggle}
      >
        <PanelLeft aria-hidden="true" className="size-4" />
      </AnimatedSidebarTrigger>
      <Link
        href={signedInAs ? '/overview' : '/markets'}
        className="app-topbar-logo md:hidden"
        aria-label={webCopy.nav.homeAria}
      >
        <span className="logo-mark">
          <ShijimaMark />
        </span>
        <span>{webCopy.brand.name.toUpperCase()}</span>
      </Link>
      <div className="app-topbar-right">
        <ThemeToggle />
        {signedInAs ? <HeaderInbox unread={unread} /> : null}
        <HeaderAccount signedInAs={signedInAs} />
      </div>
    </header>
  )
}

/** The phone's bar: four places and the menu, which opens the whole sidebar as a sheet. */
function BottomBar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname()
  const { setOpenMobile, openMobile } = useAnimatedSidebar()
  const c = appCopy.bottomBar
  const items = [
    ...(signedIn ? [{ href: '/overview', label: c.overview, icon: LayoutDashboard }] : []),
    { href: '/agents', label: c.agents, icon: Radar },
    { href: '/markets', label: c.markets, icon: ChartLine },
    ...(signedIn ? [{ href: '/activity', label: c.activity, icon: ListTree }] : []),
  ] as const
  return (
    <nav className="app-bottombar md:hidden" aria-label={c.aria}>
      {items.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href as never}
            className={cn(active && 'active')}
            aria-current={active ? 'page' : undefined}
          >
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        )
      })}
      <button
        type="button"
        className={cn(openMobile && 'active')}
        aria-expanded={openMobile}
        onClick={() => setOpenMobile(true)}
      >
        <Menu aria-hidden="true" />
        <span>{c.menu}</span>
      </button>
    </nav>
  )
}
