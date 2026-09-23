'use client'

import { appCopy, webCopy } from '@desk/shared'
import { Loader2, MoreHorizontal } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { hapticTap, usePullToRefresh } from '@/components/kit/gestures'
import { BottomSheet } from '@/components/kit/sheet'
import { GiftCard } from '@/features/gift/GiftCard'
import Footer from '../Footer'
import { HeaderAccount } from '../HeaderAccount'
import { HeaderInbox } from '../HeaderInbox'
import { MarketSessionChip } from '../MarketSessionChip'
import { ShijimaMark } from '../ShijimaMark'
import ThemeToggle from '../ThemeToggle'
import { WrongNetworkBanner } from '../WrongNetworkBanner'
import { AgentRows, AppSidebar, NavLink } from './AppSidebar'
import { AskDrawer } from './AskDrawer'
import { DISCOVER, HOME_HREF, isOn, MONEY, SETTINGS } from './nav'
import type { SidebarAgent } from './types'
import { WalletChip } from './WalletChip'

export interface AppShellProps {
  children: ReactNode
  signedInAs: string | undefined
  unread: number
  agents: SidebarAgent[]
}

/**
 * The app on paper, as the reference wallet frames it (apps/web/src/App.tsx:161-162): a canvas with two soft glows,
 * and the app as one framed panel on it, 1260px wide and at most 880px tall, with the sidebar on the left and only
 * the main area scrolling. Below 980px the frame goes edge to edge and the page scrolls; below 768px the reference
 * phone chrome takes over: a header, four tabs, and More as a sheet.
 */
export function AppShell({ children, signedInAs, unread, agents }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const main = useRef<HTMLElement>(null)
  const [more, setMore] = useState(false)

  // A new page starts at its top, in the frame and on a phone.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on each navigation, which is the pathname.
  useEffect(() => {
    main.current?.scrollTo({ top: 0 })
    setMore(false)
  }, [pathname])

  const scrolled = useCallback(() => Math.max(main.current?.scrollTop ?? 0, window.scrollY), [])
  const refresh = usePullToRefresh(() => router.refresh(), scrolled)
  const pullShown = refresh.pull > 0 || refresh.refreshing || refresh.failed

  return (
    <div className="app-shell kit-canvas">
      <div className="kit-frame">
        <AppSidebar signedInAs={signedInAs} agents={agents} />
        <main id="app-scroll" ref={main} className="kit-main" {...refresh.handlers}>
          <TopRow signedInAs={signedInAs} unread={unread} agents={agents} />
          <div
            className="kit-pull"
            data-on={pullShown || undefined}
            style={{
              height: refresh.refreshing ? 42 : refresh.failed ? 34 : Math.round(refresh.pull * 0.55),
            }}
            aria-hidden="true"
          >
            {refresh.failed ? (
              <span className="kit-pull-failed">Couldn’t refresh — check your connection</span>
            ) : (
              <Loader2
                className={refresh.refreshing ? 'kit-pull-spin' : undefined}
                style={{ transform: refresh.refreshing ? undefined : `rotate(${refresh.pull * 2.4}deg)` }}
              />
            )}
          </div>
          <div key={pathname} className="app-page kit-route">
            <WrongNetworkBanner />
            {children}
          </div>
          <Footer />
        </main>
      </div>
      <PhoneTabs signedIn={signedInAs !== undefined} onMore={() => setMore(true)} moreOpen={more} />
      <BottomSheet open={more} onClose={() => setMore(false)} label={appCopy.nav.moreTitle} tall>
        <MoreSheet signedInAs={signedInAs} agents={agents} onNavigate={() => setMore(false)} />
      </BottomSheet>
    </div>
  )
}

/**
 * The slim row at the top of the page: the market clock on the left; Ask Shijima, the bell and the account on the
 * right. On a phone it is the reference's header: the mark with the wallet's short address, the network chip, and
 * the same buttons.
 */
function TopRow({
  signedInAs,
  unread,
  agents,
}: {
  signedInAs: string | undefined
  unread: number
  agents: SidebarAgent[]
}) {
  return (
    <header className="kit-top">
      <Link
        href={(signedInAs ? HOME_HREF : '/home') as Route}
        className="kit-top-brand"
        aria-label={webCopy.nav.homeAria}
      >
        <span className="kit-brand-tile logo-mark">
          <ShijimaMark />
        </span>
        <span className="kit-top-brand-words">
          <strong>{appCopy.nav.brand}</strong>
          <em>{appCopy.nav.tagline}</em>
        </span>
      </Link>
      <MarketSessionChip className="kit-top-session" />
      <div className="kit-top-right">
        {signedInAs && agents.length > 0 ? <AskDrawer agents={agents} /> : null}
        <span className="kit-top-theme">
          <ThemeToggle />
        </span>
        {signedInAs ? <HeaderInbox unread={unread} /> : null}
        <HeaderAccount signedInAs={signedInAs} />
      </div>
    </header>
  )
}

/** The reference phone app's four tabs (MobileChrome.tsx:23-28): home, two places, and More. */
function PhoneTabs({
  signedIn,
  onMore,
  moreOpen,
}: {
  signedIn: boolean
  onMore: () => void
  moreOpen: boolean
}) {
  const pathname = usePathname()
  const byHref = (href: string) => [...MONEY, ...DISCOVER].find((i) => i.href === href)
  const tabs = (
    signedIn
      ? [byHref(HOME_HREF), byHref('/agents'), byHref('/fund') ?? byHref('/markets')]
      : [byHref('/agents'), byHref('/markets'), byHref('/strategies')]
  ).filter((t): t is NonNullable<typeof t> => Boolean(t))
  return (
    <nav className="kit-tabs" aria-label={appCopy.bottomBar.aria}>
      {tabs.map((t) => {
        const Icon = t.icon
        const active = !moreOpen && isOn(pathname, t, t.href === '/agents')
        return (
          <Link
            key={t.href}
            href={t.href as Route}
            data-active={active || undefined}
            aria-current={active ? 'page' : undefined}
            onClick={hapticTap}
          >
            <Icon aria-hidden="true" />
            <span>{t.label}</span>
          </Link>
        )
      })}
      <button
        type="button"
        data-active={moreOpen || undefined}
        aria-expanded={moreOpen}
        onClick={() => {
          hapticTap()
          onMore()
        }}
      >
        <MoreHorizontal aria-hidden="true" />
        <span>{appCopy.nav.more}</span>
      </button>
    </nav>
  )
}

/** More, as the reference groups it (MobileChrome.tsx:79-101): Move, your agents, Discover, Account. */
function MoreSheet({
  signedInAs,
  agents,
  onNavigate,
}: {
  signedInAs: string | undefined
  agents: SidebarAgent[]
  onNavigate: () => void
}) {
  const pathname = usePathname()
  const n = appCopy.nav
  return (
    <div className="kit-more">
      <div className="kit-more-head">
        <span className="kit-brand-tile logo-mark">
          <ShijimaMark />
        </span>
        <span>
          <strong>{n.more}</strong>
          <em>{n.motto}</em>
        </span>
      </div>
      {signedInAs ? (
        <>
          <WalletChip address={signedInAs} />
          <GiftCard compact className="app-sidebar-gift" />
          <Group title={n.groups.move}>
            {MONEY.map((item) => (
              <NavLink key={item.href} item={item} active={isOn(pathname, item)} onNavigate={onNavigate} />
            ))}
          </Group>
          <Group title={n.groups.agents}>
            <AgentRows agents={agents} pathname={pathname} onNavigate={onNavigate} />
          </Group>
        </>
      ) : null}
      <Group title={n.groups.discover}>
        {DISCOVER.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isOn(pathname, item, item.href === '/agents')}
            onNavigate={onNavigate}
          />
        ))}
      </Group>
      <Group title={n.groups.account}>
        {signedInAs ? (
          <NavLink item={SETTINGS} active={isOn(pathname, SETTINGS)} onNavigate={onNavigate} />
        ) : null}
        <div className="kit-more-row">
          <span>Theme</span>
          <ThemeToggle />
        </div>
        <Link href={'/home' as Route} className="kit-nav-item" onClick={onNavigate}>
          <span className="kit-nav-bar" aria-hidden="true" />
          <span className="kit-label">{n.home}</span>
        </Link>
      </Group>
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="kit-more-group">
      <h2>{title}</h2>
      {children}
    </section>
  )
}
