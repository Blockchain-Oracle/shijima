'use client'

import { appCopy } from '@desk/shared'
import { CornerDownRight } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShijimaMark } from '@/components/shell/ShijimaMark'

/** Where a lost reader most likely meant to go. */
const PLACES = [
  '/',
  '/wallet',
  '/markets',
  '/agents',
  '/agents/new',
  '/strategies',
  '/activity',
  '/settings',
  '/reels',
  '/how-it-works',
  '/docs',
  '/status',
  '/compare',
] as const

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0] ?? 0
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const next = row[j] ?? 0
      row[j] = Math.min(next + 1, (row[j - 1] ?? 0) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = next
    }
  }
  return row[b.length] ?? 0
}

/** The closest known page by its first segment, only when it is close enough to be a typo. */
function suggest(path: string): string | null {
  const first = `/${path.split('/').filter(Boolean)[0] ?? ''}`
  if (first === '/agents') return '/agents'
  let best: { place: string; d: number } | null = null
  for (const place of PLACES) {
    const d = distance(first.toLowerCase(), place)
    if (!best || d < best.d) best = { place, d }
  }
  return best && best.d <= Math.max(2, Math.floor(first.length / 3)) ? best.place : null
}

/**
 * The 404, on 21st's "404 Did You Mean" (29419): the address struck through, the page it most likely meant,
 * and the ways back. Shijima's own words: the quiet of deep night, which is what the name means.
 */
export function NotFoundScreen() {
  const pathname = usePathname() ?? '/'
  const c = appCopy.notFound
  const guess = suggest(pathname)
  return (
    <div className="app-container nf">
      <span className="logo-mark text-accent" style={{ width: 40, height: 40 }} aria-hidden="true">
        <ShijimaMark />
      </span>
      <p className="nf-code">{c.code}</p>
      <h1 className="nf-title">{c.title}</h1>
      <p className="nf-body">{c.body}</p>
      <p className="nf-path">
        <s>{pathname}</s>
      </p>
      {guess && guess !== pathname && (
        <Link href={guess as Route} className="nf-guess">
          <CornerDownRight aria-hidden="true" className="size-4" />
          <span>
            {c.didYouMean} <code>{guess}</code>
          </span>
        </Link>
      )}
      <div className="nf-actions">
        <Link href="/" className="btn-primary ov-btn">
          {c.home}
        </Link>
        <Link href="/markets" className="btn-secondary ov-btn">
          {c.markets}
        </Link>
        <Link href="/agents" className="btn-secondary ov-btn">
          {c.agents}
        </Link>
      </div>
    </div>
  )
}
