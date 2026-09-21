import { webCopy } from '@desk/shared'
import Link from 'next/link'

/** Agari's footer row, carrying the one line every page must: what a Stock Token is not. */
export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <p className="footer-disclosure type-caption text-ink-muted">{webCopy.footer.disclosure}</p>
        <div className="footer-row">
          <Link href="/how-it-works" data-cursor="hover">
            {webCopy.footer.howItWorks}
          </Link>
        </div>
      </div>
    </footer>
  )
}
