import type { ReactNode } from 'react'
import CustomCursor from './CustomCursor'
import Footer from './Footer'
import GrainOverlay from './GrainOverlay'
import Header, { type HeaderProps } from './Header'
import Marquee, { type TickerCell } from './Marquee'
import { WrongNetworkBanner } from './WrongNetworkBanner'

/**
 * The shell around every page, as Agari's `ShellChrome` draws it: the ticker, the header, the grain, the cursor,
 * the page and the footer. Shijima has no island routes, so every page gets all of it.
 */
export function ShellChrome({
  children,
  ticker,
  ...header
}: HeaderProps & { children: ReactNode; ticker: TickerCell[] }) {
  return (
    <>
      <Marquee initial={ticker} />
      <Header {...header} />
      <GrainOverlay />
      <CustomCursor />
      <main className="page-shell">
        <WrongNetworkBanner />
        {children}
      </main>
      <Footer />
    </>
  )
}
