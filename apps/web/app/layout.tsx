import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Connect } from '@/components/connect'
import { Providers } from '@/components/providers'
import { signedInAddress } from '@/lib/session'
import './globals.css'

export const metadata: Metadata = {
  title: 'Shijima',
  description:
    'A desk that looks after Stock Tokens while the US market is shut, and writes down every decision.',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const signedInAs = await signedInAddress().catch(() => undefined)
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>
          <header className="border-line border-b">
            <nav className="mx-auto flex max-w-4xl items-center gap-5 px-4 py-3 text-sm">
              <Link href="/" className="font-semibold text-ink">
                Shijima
              </Link>
              <Link href="/how-it-works" className="text-ink-soft hover:text-ink">
                How it decides
              </Link>
              {signedInAs ? (
                <Link href="/desks" className="text-ink-soft hover:text-ink">
                  Your desks
                </Link>
              ) : null}
              <Link href="/start" className="text-ink-soft hover:text-ink">
                Open a desk
              </Link>
              <div className="ml-auto">
                <Connect signedInAs={signedInAs} />
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-4xl px-4 pt-4 pb-10 text-ink-faint text-xs">
            Stock Tokens are not shares. Holding one gives you no ownership of the company and no shareholder
            rights. Nothing here is advice.
          </footer>
        </Providers>
      </body>
    </html>
  )
}
