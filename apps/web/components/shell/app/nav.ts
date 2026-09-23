import { appCopy } from '@desk/shared'
import {
  Activity,
  ArrowDown,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ArrowUpRight,
  ChartLine,
  GalleryVerticalEnd,
  Layers3,
  ListTree,
  type LucideIcon,
  Radar,
  Settings,
  ShieldCheck,
  WalletMinimal,
} from 'lucide-react'

/**
 * One list of places for the sidebar, the phone tabs and the More sheet, in the reference wallet's order
 * (WalletShell.tsx:21-32): Wallet, Activity, Send, Receive, then the moves across the line, then proof.
 */
export interface NavItem {
  href: string
  label: string
  detail?: string
  icon: LucideIcon
  /** Also lit on these path prefixes. */
  also?: string[]
  signedIn?: boolean
}

const n = appCopy.nav

/** Pages that exist. The money pages join as they land, so no link ever leads to a 404. */
const BUILT = new Set<string>([
  '/wallet',
  '/receive',
  '/send',
  '/bridge',
  '/fund',
  '/withdraw',
  '/evidence',
  '/activity',
  '/agents',
  '/markets',
  '/strategies',
  '/reels',
  '/live',
  '/settings',
])

const only = (items: NavItem[]) => items.filter((i) => BUILT.has(i.href.split('?')[0] ?? i.href))

export const MONEY: NavItem[] = only([
  { href: '/wallet', label: n.wallet, icon: WalletMinimal, signedIn: true },
  { href: '/activity', label: n.activity, icon: ListTree, signedIn: true },
  { href: '/send', label: n.send, detail: n.details.send, icon: ArrowUpRight, signedIn: true },
  { href: '/receive', label: n.receive, detail: n.details.receive, icon: ArrowDown, signedIn: true },
  { href: '/fund', label: n.fund, detail: n.details.fund, icon: ArrowDownToLine, signedIn: true },
  { href: '/withdraw', label: n.withdraw, detail: n.details.withdraw, icon: ArrowUpFromLine, signedIn: true },
  { href: '/bridge', label: n.bridge, detail: n.details.bridge, icon: ArrowLeftRight, signedIn: true },
  { href: '/evidence', label: n.evidence, detail: n.details.evidence, icon: ShieldCheck, signedIn: true },
])

export const DISCOVER: NavItem[] = only([
  { href: '/agents', label: n.agents, detail: n.details.agents, icon: Radar },
  { href: '/markets', label: n.markets, detail: n.details.markets, icon: ChartLine, also: ['/stock'] },
  { href: '/strategies', label: n.strategies, detail: n.details.strategies, icon: Layers3 },
  { href: '/reels', label: n.reels, detail: n.details.reels, icon: GalleryVerticalEnd },
  { href: '/live', label: n.live, detail: n.details.live, icon: Activity },
])

export const SETTINGS: NavItem = {
  href: '/settings',
  label: n.settings,
  detail: n.details.settings,
  icon: Settings,
}

export const HOME_HREF = MONEY[0]?.href ?? '/agents'

/** Is this path the one a link names, or under it. `/agents` alone must not light up for an agent's own page. */
export function isOn(pathname: string | null, item: NavItem, exact = false): boolean {
  if (!pathname) return false
  const hrefs = [item.href.split('?')[0] ?? item.href, ...(item.also ?? [])]
  return hrefs.some((h) => pathname === h || (!exact && pathname.startsWith(`${h}/`)))
}
