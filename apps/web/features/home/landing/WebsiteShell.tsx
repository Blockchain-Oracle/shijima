'use client'

import { homeCopy as H, webCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import ThemeToggle from '@/components/shell/ThemeToggle'
import { WrongNetworkBanner } from '@/components/shell/WrongNetworkBanner'
import { DOCS_SITE_URL } from '@/lib/docs-site'
import { Logo } from './Logo'
import { appHrefFor } from './links'
import './styles.css'
import './flip-cards.css'
import './sections.css'
import './responsive.css'

const LINKS = [
  { href: '/how-it-works', label: H.nav.how },
  { href: '/live', label: H.nav.live },
  { href: '/docs', label: H.nav.docs },
] as const

/** The floating nav pill (the reference's Nav). On phones the links hide and only the brand and the button stay. */
function Nav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname()
  return (
    <header className="nav-pill">
      <Link href="/home" className="nav-brand" aria-label={H.nav.home}>
        <Logo size={32} glow />
        <span>{webCopy.brand.name.toUpperCase()}</span>
        <span className="ja" lang="ja">
          {webCopy.brand.ja}
        </span>
      </Link>
      <nav aria-label={H.nav.primary}>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href as Route}
            aria-current={pathname === l.href || pathname?.startsWith(`${l.href}/`) ? 'page' : undefined}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <span className="nav-theme">
        <ThemeToggle />
      </span>
      <Link className="nav-download" href={appHrefFor(signedIn)}>
        {H.nav.open}
      </Link>
    </header>
  )
}

/** One row: the brand and the motto, the links that make the promises checkable, and the line every page owes. */
function SiteFooter() {
  const f = webCopy.footer
  return (
    <footer className="site-footer">
      <div className="site-footer-brand">
        <Logo size={26} glow />
        <div>
          <strong>{webCopy.brand.name}</strong>
          <span>{H.mottoLine}</span>
        </div>
      </div>
      <nav aria-label={f.howItWorks}>
        <Link href="/how-it-works">{f.howItWorks}</Link>
        <Link href="/docs">{f.docs}</Link>
        {DOCS_SITE_URL && (
          <a href={DOCS_SITE_URL} target="_blank" rel="noreferrer">
            {f.fullDocs}
          </a>
        )}
        <Link href={'/how-it-works#withdraw-without-us' as Route}>{f.withdraw}</Link>
        <Link href="/live">{H.nav.live}</Link>
        <Link href="/status">{f.status}</Link>
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
          {f.charts}
        </a>
      </nav>
      <p className="site-footer-note">{f.disclosure}</p>
    </footer>
  )
}

/**
 * The website's shell (/, /home, /how-it-works, /docs): the reference landing's nav pill, the page, and its
 * footer, on the landing canvas. The app has its own shell.
 */
export function WebsiteShell({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  return (
    <div className="landing-shell">
      <main id="top">
        <Nav signedIn={signedIn} />
        <WrongNetworkBanner />
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
