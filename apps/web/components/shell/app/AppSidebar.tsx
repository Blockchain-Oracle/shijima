'use client'

import { appCopy, webCopy } from '@desk/shared'
import { Plus, SquareArrowOutUpRight } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { NetworkPill } from '@/components/kit'
import { TokenLogo } from '@/components/ui/token-logo'
import { GiftCard } from '@/features/gift/GiftCard'
import { cn } from '@/lib/utils'
import { ShijimaMark } from '../ShijimaMark'
import { SignInButton } from '../SignInButton'
import ThemeToggle from '../ThemeToggle'
import { LiveBadge } from './LiveBadge'
import { DISCOVER, HOME_HREF, isOn, MONEY, type NavItem, SETTINGS } from './nav'
import type { SidebarAgent } from './types'
import { WalletChip } from './WalletChip'

/**
 * The app's sidebar, in the reference wallet's shape (WalletShell.tsx:104-137): the mark and its line, the network
 * pill, a flat list of places with an accent bar on the one you are on, and the account at the foot with the theme
 * toggle. Shijima adds its agents as live rows, Discover, the free $1, the live block and OpenServ. Below 1100px it
 * is an icon rail; below 768px the phone chrome takes over and this is hidden.
 */

function dollars(raw: string | null): string {
  if (raw === null) return appCopy.sidebar.noValue
  return `$${(Number(raw) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function statusOf(a: SidebarAgent): { key: keyof typeof appCopy.sidebar.status; dot: string } {
  if (a.needsYou > 0) return { key: 'needsYou', dot: 'is-needs' }
  if (a.state !== 'active') return { key: 'paused', dot: 'is-paused' }
  if (a.mode === 'shadow') return { key: 'practice', dot: 'is-practice' }
  return { key: 'running', dot: 'is-running' }
}

export function NavLink({
  item,
  active,
  badge,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  badge?: ReactNode
  onNavigate?: () => void
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href as Route}
      className="kit-nav-item"
      data-active={active || undefined}
      aria-current={active ? 'page' : undefined}
      title={item.label}
      {...(onNavigate ? { onClick: onNavigate } : {})}
    >
      <span className="kit-nav-bar" aria-hidden="true" />
      <Icon aria-hidden="true" className="kit-nav-icon" />
      <span className="kit-label">{item.label}</span>
      {badge}
    </Link>
  )
}

export function AgentRows({
  agents,
  pathname,
  onNavigate,
}: {
  agents: SidebarAgent[]
  pathname: string | null
  onNavigate?: () => void
}) {
  const c = appCopy.sidebar
  return (
    <>
      {agents.map((a) => {
        const s = statusOf(a)
        const active =
          pathname === `/agents/${a.slug}` ||
          pathname?.startsWith(`/agents/${a.slug}/`) ||
          pathname === `/agents/${a.id}` ||
          pathname?.startsWith(`/agents/${a.id}/`)
        return (
          <Link
            key={a.id}
            href={`/agents/${a.slug}` as Route}
            className="kit-nav-item kit-agent-row"
            data-active={active || undefined}
            aria-current={active ? 'page' : undefined}
            title={`${a.name} · ${c.status[s.key]}`}
            {...(onNavigate ? { onClick: onNavigate } : {})}
          >
            <span className="kit-nav-bar" aria-hidden="true" />
            <span className="agent-mark">
              <TokenLogo symbol={a.symbols[0] ?? 'CASH'} size={20} />
              <span className={cn('agent-mark-dot', s.dot)} />
            </span>
            <span className="kit-label kit-agent-name">
              <span className="sr-only">{`${c.status[s.key]}: `}</span>
              {a.name}
            </span>
            <span className="kit-label kit-agent-money">{dollars(a.valueUsdg)}</span>
          </Link>
        )
      })}
      <Link
        href={'/agents/new' as Route}
        className="kit-nav-item"
        data-active={pathname === '/agents/new' || undefined}
        title={appCopy.nav.newAgent}
        {...(onNavigate ? { onClick: onNavigate } : {})}
      >
        <span className="kit-nav-bar" aria-hidden="true" />
        <Plus aria-hidden="true" className="kit-nav-icon" />
        <span className="kit-label">{appCopy.nav.newAgent}</span>
      </Link>
    </>
  )
}

export function AppSidebar({
  signedInAs,
  agents,
}: {
  signedInAs: string | undefined
  agents: SidebarAgent[]
}) {
  const pathname = usePathname()
  const n = appCopy.nav
  const waiting = agents.reduce((sum, a) => sum + a.needsYou, 0)
  const signedIn = signedInAs !== undefined

  return (
    <aside className="kit-side" aria-label={appCopy.sidebar.aria}>
      <Link
        href={(signedIn ? HOME_HREF : '/home') as Route}
        className="kit-brand"
        aria-label={webCopy.nav.homeAria}
      >
        <span className="kit-brand-tile logo-mark">
          <ShijimaMark />
        </span>
        <span className="kit-label kit-brand-words">
          <span className="kit-brand-name">
            {n.brand} <span lang="ja">{webCopy.brand.ja}</span>
          </span>
          <span className="kit-brand-line">{n.tagline}</span>
        </span>
      </Link>

      <div className="kit-side-network kit-label">
        <NetworkPill />
      </div>

      <nav className="kit-nav" aria-label={appCopy.sidebar.aria}>
        {signedIn ? (
          <div className="kit-nav-group">
            {MONEY.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isOn(pathname, item)}
                badge={
                  item.href === '/activity' && waiting > 0 ? (
                    <span className="kit-nav-count">
                      {waiting}
                      <span className="sr-only"> {appCopy.sidebar.needsYou}</span>
                    </span>
                  ) : undefined
                }
              />
            ))}
          </div>
        ) : (
          <div className="kit-side-signedout kit-label">
            <strong>{appCopy.sidebar.signedOut.title}</strong>
            <p>{appCopy.sidebar.signedOut.body}</p>
            <SignInButton />
          </div>
        )}

        {signedIn && (
          <div className="kit-nav-group">
            <div className="kit-nav-heading kit-label">{n.groups.agents}</div>
            <AgentRows agents={agents} pathname={pathname} />
          </div>
        )}

        <div className="kit-nav-group">
          <div className="kit-nav-heading kit-label">{n.groups.discover}</div>
          {DISCOVER.map((item) => (
            <NavLink key={item.href} item={item} active={isOn(pathname, item, item.href === '/agents')} />
          ))}
          {signedIn && <NavLink item={SETTINGS} active={isOn(pathname, SETTINGS)} />}
        </div>
        {signedIn && <GiftCard compact className="app-sidebar-gift kit-label" />}
      </nav>

      <div className="kit-side-foot">
        {signedIn && (
          <div className="kit-label">
            <WalletChip address={signedInAs} />
          </div>
        )}
        <div className="kit-side-row">
          <span className="kit-label kit-side-live">
            <LiveBadge compact />
          </span>
          <ThemeToggle />
        </div>
        <p className="kit-side-links kit-label">
          <a href="https://platform.openserv.ai/agents/4513" target="_blank" rel="noreferrer noopener">
            {appCopy.sidebar.runsOn}
          </a>
          <span aria-hidden="true">·</span>
          <Link href={'/home' as Route}>
            {n.home} <SquareArrowOutUpRight aria-hidden="true" className="inline size-3" />
          </Link>
        </p>
      </div>
    </aside>
  )
}
