'use client'

import { appCopy, webCopy } from '@desk/shared'
import {
  Bell,
  ChartLine,
  GalleryVerticalEnd,
  Layers3,
  LayoutDashboard,
  ListTree,
  Plus,
  Radar,
  Settings,
  SquareArrowOutUpRight,
  X,
} from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  AnimatedSidebar,
  AnimatedSidebarClose,
  AnimatedSidebarContent,
  AnimatedSidebarFooter,
  AnimatedSidebarGroup,
  AnimatedSidebarGroupContent,
  AnimatedSidebarGroupLabel,
  AnimatedSidebarHeader,
  AnimatedSidebarMenu,
  AnimatedSidebarMenuButton,
  AnimatedSidebarMenuItem,
  AnimatedSidebarRail,
  useAnimatedSidebar,
} from '@/components/ui/animated-sidebar'
import { TokenLogo } from '@/components/ui/token-logo'
import { GiftCard } from '@/features/gift/GiftCard'
import { cn } from '@/lib/utils'
import { ShijimaMark } from '../ShijimaMark'
import { SignInButton } from '../SignInButton'
import { LiveBadge } from './LiveBadge'
import type { SidebarAgent } from './types'
import { WalletChip } from './WalletChip'

/** Is this path the one a link names, or under it. */
function on(pathname: string | null, href: string, exact = false) {
  if (!pathname) return false
  return pathname === href || (!exact && pathname.startsWith(`${href}/`))
}

function dollars(raw: string | null): string {
  if (raw === null) return appCopy.sidebar.noValue
  return `$${(Number(raw) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function change(bps: number | null): { text: string; tone: 'up' | 'down' | 'flat' } | null {
  if (bps === null) return null
  const pct = bps / 100
  return {
    text: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`,
    tone: pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat',
  }
}

/** One status word per agent: what the dot's colour means, for a screen reader and the tooltip. */
function statusOf(a: SidebarAgent): { key: keyof typeof appCopy.sidebar.status; dot: string } {
  if (a.needsYou > 0) return { key: 'needsYou', dot: 'is-needs' }
  if (a.state !== 'active') return { key: 'paused', dot: 'is-paused' }
  if (a.mode === 'shadow') return { key: 'practice', dot: 'is-practice' }
  return { key: 'running', dot: 'is-running' }
}

/** An agent's mark: its heaviest holding's logo with the status dot on its shoulder. */
function AgentMark({ agent }: { agent: SidebarAgent }) {
  const s = statusOf(agent)
  return (
    <span className="agent-mark">
      <TokenLogo symbol={agent.symbols[0] ?? 'CASH'} size={20} />
      <span className={cn('agent-mark-dot', s.dot)} />
    </span>
  )
}

function Group({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <AnimatedSidebarGroup className="pb-2">
      {label ? <AnimatedSidebarGroupLabel>{label}</AnimatedSidebarGroupLabel> : null}
      <AnimatedSidebarGroupContent>
        <AnimatedSidebarMenu>{children}</AnimatedSidebarMenu>
      </AnimatedSidebarGroupContent>
    </AnimatedSidebarGroup>
  )
}

/**
 * The app's sidebar, on 21st's Animated Sidebar (29334): the owner's wallet, then You (Overview, Needs you,
 * Activity), their agents like channels with a live status dot, then Discover. Settings, the live network and
 * the landing page sit at the foot, one click from anywhere. On a phone it is a focus-managed sheet.
 */
export function AppSidebar({
  signedInAs,
  agents,
}: {
  signedInAs: string | undefined
  agents: SidebarAgent[]
}) {
  const pathname = usePathname()
  const { state, isMobile } = useAnimatedSidebar()
  const collapsed = state === 'collapsed' && !isMobile
  const c = appCopy.sidebar
  const waiting = agents.reduce((n, a) => n + a.needsYou, 0)

  return (
    <AnimatedSidebar ariaLabel={c.aria} collapsible="icon" panelClassName="app-sidebar-panel">
      <AnimatedSidebarHeader className="app-sidebar-header">
        <div className="app-sidebar-brand">
          <Link
            href={signedInAs ? '/overview' : '/markets'}
            className="app-sidebar-logo"
            aria-label={webCopy.nav.homeAria}
          >
            <span className="logo-mark">
              <ShijimaMark />
            </span>
            {!collapsed && (
              <>
                <span className="app-sidebar-word">{webCopy.brand.name.toUpperCase()}</span>
                <span className="logo-ja" lang="ja">
                  {webCopy.brand.ja}
                </span>
              </>
            )}
          </Link>
          <AnimatedSidebarClose
            className="ml-auto text-muted-foreground hover:bg-muted md:hidden"
            aria-label={c.close}
          >
            <X aria-hidden="true" className="size-4" />
          </AnimatedSidebarClose>
        </div>
        {signedInAs ? (
          <WalletChip address={signedInAs} collapsed={collapsed} />
        ) : collapsed ? null : (
          <div className="app-sidebar-signedout">
            <strong>{c.signedOut.title}</strong>
            <p>{c.signedOut.body}</p>
            <SignInButton />
          </div>
        )}
      </AnimatedSidebarHeader>

      <AnimatedSidebarContent className="app-sidebar-content">
        {signedInAs && (
          <Group label={c.groups.you}>
            <AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuButton
                href="/overview"
                isActive={on(pathname, '/overview')}
                icon={<LayoutDashboard className="size-4" />}
              >
                {c.overview}
              </AnimatedSidebarMenuButton>
            </AnimatedSidebarMenuItem>
            <AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuButton
                href="/activity?tab=needs"
                isActive={false}
                icon={<Bell className="size-4" />}
                badge={waiting > 0 ? <span className="app-sidebar-count">{waiting}</span> : undefined}
              >
                {c.needsYou}
              </AnimatedSidebarMenuButton>
            </AnimatedSidebarMenuItem>
            <AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuButton
                href="/activity"
                isActive={on(pathname, '/activity')}
                icon={<ListTree className="size-4" />}
              >
                {c.activity}
              </AnimatedSidebarMenuButton>
            </AnimatedSidebarMenuItem>
          </Group>
        )}

        {signedInAs && (
          <Group label={c.groups.agents}>
            {agents.map((a) => {
              const ch = change(a.changeBps)
              const s = statusOf(a)
              return (
                <AnimatedSidebarMenuItem key={a.id}>
                  <AnimatedSidebarMenuButton
                    href={`/agents/${a.slug}`}
                    isActive={on(pathname, `/agents/${a.slug}`) || on(pathname, `/agents/${a.id}`)}
                    icon={<AgentMark agent={a} />}
                    className="app-sidebar-agent"
                    badge={
                      <span className="app-sidebar-agent-money">
                        <span>{dollars(a.valueUsdg)}</span>
                        {ch && <span className={`is-${ch.tone}`}>{ch.text}</span>}
                      </span>
                    }
                  >
                    <span className="sr-only">{`${c.status[s.key]}: `}</span>
                    {a.name}
                  </AnimatedSidebarMenuButton>
                </AnimatedSidebarMenuItem>
              )
            })}
            <AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuButton
                href="/agents/new"
                isActive={on(pathname, '/agents/new', true)}
                icon={<Plus className="size-4" />}
              >
                {c.newAgent}
              </AnimatedSidebarMenuButton>
            </AnimatedSidebarMenuItem>
          </Group>
        )}

        <Group label={c.groups.discover}>
          <AnimatedSidebarMenuItem>
            <AnimatedSidebarMenuButton
              href="/markets"
              isActive={on(pathname, '/markets') || on(pathname, '/stock')}
              icon={<ChartLine className="size-4" />}
            >
              {c.markets}
            </AnimatedSidebarMenuButton>
          </AnimatedSidebarMenuItem>
          <AnimatedSidebarMenuItem>
            <AnimatedSidebarMenuButton
              href="/agents"
              isActive={on(pathname, '/agents', true)}
              icon={<Radar className="size-4" />}
            >
              {c.liveAgents}
            </AnimatedSidebarMenuButton>
          </AnimatedSidebarMenuItem>
          <AnimatedSidebarMenuItem>
            <AnimatedSidebarMenuButton
              href="/strategies"
              isActive={on(pathname, '/strategies')}
              icon={<Layers3 className="size-4" />}
            >
              {c.strategies}
            </AnimatedSidebarMenuButton>
          </AnimatedSidebarMenuItem>
          <AnimatedSidebarMenuItem>
            <AnimatedSidebarMenuButton
              href="/reels"
              isActive={on(pathname, '/reels')}
              icon={<GalleryVerticalEnd className="size-4" />}
            >
              {c.reels}
            </AnimatedSidebarMenuButton>
          </AnimatedSidebarMenuItem>
        </Group>
      </AnimatedSidebarContent>

      <AnimatedSidebarFooter className="app-sidebar-footer">
        {!collapsed && signedInAs && <GiftCard compact className="app-sidebar-gift" />}
        <AnimatedSidebarMenu>
          <AnimatedSidebarMenuItem>
            <AnimatedSidebarMenuButton
              href="/settings"
              isActive={on(pathname, '/settings')}
              icon={<Settings className="size-4" />}
            >
              {c.settings}
            </AnimatedSidebarMenuButton>
          </AnimatedSidebarMenuItem>
        </AnimatedSidebarMenu>
        {!collapsed && (
          <div className="app-sidebar-foot">
            <LiveBadge compact />
            <p className="app-sidebar-links">
              <a href="https://platform.openserv.ai/agents/4513" target="_blank" rel="noreferrer noopener">
                {c.runsOn}
              </a>
              <span aria-hidden="true">·</span>
              <Link href={'/home' as Route}>
                {c.landing} <SquareArrowOutUpRight aria-hidden="true" className="inline size-3" />
              </Link>
            </p>
          </div>
        )}
      </AnimatedSidebarFooter>
      <AnimatedSidebarRail aria-label={c.toggle} />
    </AnimatedSidebar>
  )
}
