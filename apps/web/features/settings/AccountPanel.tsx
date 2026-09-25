'use client'

import { appCopy, firstRunCopy, short } from '@desk/shared'
import { ChevronRight, Compass, LogOut, ShieldCheck } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDisconnect } from 'wagmi'
import { WalletChip } from '@/components/shell/app/WalletChip'
import { openTour } from '@/features/onboarding/tour'

const c = appCopy.settings

/** Where each "Verify it yourself" line opens. */
const VERIFY_HREF = ['/evidence', '/live', '/evidence'] as const

/**
 * The Account tab: the wallet and its gas, the places to check everything yourself, and the two actions (the tour,
 * disconnect) side by side at the end, instead of a second column of cards.
 */
export function AccountPanel({ address }: { address: string }) {
  const router = useRouter()
  const { disconnect } = useDisconnect()
  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    disconnect()
    router.push('/home' as Route)
    router.refresh()
  }

  return (
    <div className="st-stack">
      <section className="st-section">
        <div className="st-row">
          <div className="st-row-text">
            <span className="st-row-title">{c.address}</span>
            <span className="st-row-sub">{c.realMoney}</span>
          </div>
          <span className="st-mono" title={address}>
            {short(address, 6, 4)}
          </span>
        </div>
        <div className="st-row st-row--block">
          <span className="st-row-title">{c.gas}</span>
          <WalletChip address={address} />
        </div>
      </section>

      <section className="st-section">
        <div className="st-section-head">
          <ShieldCheck aria-hidden="true" className="size-4" />
          <span>{c.verify.title}</span>
        </div>
        {c.verify.rows.map((row, i) => (
          <Link key={row} href={VERIFY_HREF[i] as Route} className="st-row st-row--link">
            <span className="st-row-title">{row}</span>
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        ))}
      </section>

      <div className="st-actions">
        <button type="button" className="st-btn" onClick={openTour} title={firstRunCopy.tourNote}>
          <Compass aria-hidden="true" className="size-4" />
          {firstRunCopy.tour}
        </button>
        <button type="button" className="st-btn st-btn--danger" onClick={signOut}>
          <LogOut aria-hidden="true" className="size-4" />
          {c.disconnect}
        </button>
      </div>
    </div>
  )
}
