'use client'

import { appCopy, firstRunCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDisconnect } from 'wagmi'
import { BoundaryBadge, Button } from '@/components/kit'
import { openTour } from '@/features/onboarding/tour'

/**
 * The right column of the reference wallet's Settings (SettingsScreen.tsx:124-145): the "Verify it yourself" card,
 * the dashed note on what this is, and the red-tinted way out (Lock wallet there, Disconnect here).
 */
export function SettingsSide({ verifyHref }: { verifyHref: string }) {
  const c = appCopy.settings
  const router = useRouter()
  const { disconnect } = useDisconnect()

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    disconnect()
    router.push('/home' as Route)
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Link
        href={verifyHref as Route}
        style={{
          display: 'block',
          textDecoration: 'none',
          color: 'inherit',
          border: '1px solid color-mix(in srgb, var(--ac) 25%, transparent)',
          borderRadius: 16,
          background:
            'linear-gradient(160deg, color-mix(in srgb, var(--ac) 8%, transparent), transparent 60%), var(--panel)',
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: 'color-mix(in srgb, var(--ac) 16%, transparent)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--ac2)',
              fontSize: 14,
            }}
          >
            ◆
          </span>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{c.verify.title}</div>
          <div style={{ marginLeft: 'auto' }}>
            <BoundaryBadge kind="onchain" label={c.verify.badge} size="sm" />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {c.verify.rows.map((row) => (
            <div
              key={row}
              style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--tx2)' }}
            >
              <span style={{ color: 'var(--pos)' }}>✓</span>
              {row}
              <span
                style={{ marginLeft: 'auto', fontFamily: 'var(--fm)', fontSize: 10.5, color: 'var(--ac2)' }}
              >
                {c.verify.open}
              </span>
            </div>
          ))}
        </div>
      </Link>

      <div
        style={{
          padding: '15px 17px',
          border: '1px dashed color-mix(in srgb, var(--warn) 40%, transparent)',
          borderRadius: 14,
          background: 'color-mix(in srgb, var(--warn) 5%, transparent)',
          fontSize: 12,
          lineHeight: 1.55,
          color: 'var(--warn)',
        }}
      >
        {c.realMoney}
      </div>

      <Button variant="secondary" onClick={openTour} title={firstRunCopy.tourNote}>
        {firstRunCopy.tour}
      </Button>

      <button
        type="button"
        onClick={signOut}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
          padding: 14,
          border: '1px solid color-mix(in srgb, var(--dng) 40%, transparent)',
          borderRadius: 13,
          background: 'color-mix(in srgb, var(--dng) 6%, transparent)',
          color: 'var(--dng)',
          fontSize: 13.5,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {c.disconnect}
      </button>
    </div>
  )
}
