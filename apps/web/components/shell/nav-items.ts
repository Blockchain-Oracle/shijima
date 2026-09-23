import { webCopy } from '@desk/shared'
import {
  BookOpen,
  BookText,
  ChartLine,
  GalleryVerticalEnd,
  Layers3,
  type LucideIcon,
  Radar,
} from 'lucide-react'
import type { Route } from 'next'

/**
 * Every destination in one registry, as in Agari (`components/shell/header/nav-items.ts`), with ours. Markets
 * comes first, then Agents: the website's header. Signed in, the app's sidebar takes over.
 */
export type NavItem = {
  id: string
  name: string
  href: Route
  description: string
  icon: LucideIcon
  match?: { paths: readonly string[]; exact?: boolean }
}

export type NavSection = { id: string; name: string; description: string; items: readonly NavItem[] }

export const NAV_ITEMS = {
  agents: {
    id: 'agents',
    name: webCopy.nav.agents.name,
    href: '/agents',
    description: webCopy.nav.agents.description,
    icon: Radar,
    match: { paths: ['/agents'] },
  },
  markets: {
    id: 'markets',
    name: webCopy.nav.markets.name,
    href: '/markets',
    description: webCopy.nav.markets.description,
    icon: ChartLine,
    match: { paths: ['/markets', '/stock'] },
  },
  reels: {
    id: 'reels',
    name: webCopy.nav.reels.name,
    href: '/reels',
    description: webCopy.nav.reels.description,
    icon: GalleryVerticalEnd,
  },
  strategies: {
    id: 'strategies',
    name: webCopy.nav.strategies.name,
    href: '/strategies',
    description: webCopy.nav.strategies.description,
    icon: Layers3,
    match: { paths: ['/strategies', '/start'] },
  },
  howItWorks: {
    id: 'how-it-works',
    name: webCopy.nav.howItWorks.name,
    href: '/how-it-works',
    description: webCopy.nav.howItWorks.description,
    icon: BookOpen,
  },
  docs: {
    id: 'docs',
    name: webCopy.nav.docs.name,
    href: '/docs',
    description: webCopy.nav.docs.description,
    icon: BookText,
  },
} as const satisfies Record<string, NavItem>

export const DESKTOP_NAV: readonly NavItem[] = [
  NAV_ITEMS.markets,
  NAV_ITEMS.agents,
  NAV_ITEMS.strategies,
  NAV_ITEMS.reels,
  NAV_ITEMS.howItWorks,
]

export const MOBILE_NAV: readonly NavItem[] = [
  NAV_ITEMS.markets,
  NAV_ITEMS.agents,
  NAV_ITEMS.strategies,
  NAV_ITEMS.reels,
]

export const MOBILE_DRAWER_SECTIONS: readonly NavSection[] = [
  { id: 'yours', ...webCopy.nav.sections.yours, items: [NAV_ITEMS.agents] },
  {
    id: 'explore',
    ...webCopy.nav.sections.explore,
    items: [NAV_ITEMS.markets, NAV_ITEMS.reels, NAV_ITEMS.strategies],
  },
  { id: 'learn', ...webCopy.nav.sections.learn, items: [NAV_ITEMS.howItWorks, NAV_ITEMS.docs] },
]

export const MOBILE_OVERFLOW: readonly NavItem[] = MOBILE_DRAWER_SECTIONS.flatMap((section) => section.items)

export function isActiveNavItem(pathname: string | null, item: NavItem): boolean {
  if (!pathname) return false
  const match = item.match ?? { paths: [item.href] }
  return match.paths.some((path) => pathname === path || (!match.exact && pathname.startsWith(`${path}/`)))
}
