import { webCopy } from '@desk/shared'
import Link from 'next/link'

/**
 * Agari's footer row, carrying the one line every page must: what a Stock Token is not. The links are the pages
 * that make the promises checkable: the rules, the way out without this website, and whether the desk is awake.
 */
export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <p className="footer-disclosure type-caption text-ink-muted">{webCopy.footer.disclosure}</p>
        <div className="footer-row">
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label={webCopy.footer.howItWorks}>
            <Link href="/how-it-works" data-cursor="hover">
              {webCopy.footer.howItWorks}
            </Link>
            <Link href="/docs" data-cursor="hover">
              {webCopy.footer.docs}
            </Link>
            <Link href="/how-it-works#withdraw-without-us" data-cursor="hover">
              {webCopy.footer.withdraw}
            </Link>
            <Link href="/status" data-cursor="hover">
              {webCopy.footer.status}
            </Link>
            <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" data-cursor="hover">
              {webCopy.footer.charts}
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}
