'use client'

import type { ReactNode } from 'react'
import { ShijimaMark } from '@/components/shell/ShijimaMark'
import { Qr } from '@/components/ui/qr'

/**
 * The reference wallet's QR card (packages/ui/src/qr.tsx): a white tile with the brand mark in the middle and a caption.
 * The squares come from our own QR maker (components/ui/qr.tsx), so no new dependency.
 */
export function QrCard({
  text,
  label,
  caption,
  badge,
  logo = true,
  size = 172,
}: {
  text: string
  label: string
  caption?: ReactNode
  badge?: ReactNode
  logo?: boolean
  size?: number
}) {
  return (
    <div
      style={{
        flex: 'none',
        width: 300,
        maxWidth: '100%',
        border: '1px solid var(--bd)',
        borderRadius: 18,
        background: 'var(--panel)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
        boxSizing: 'border-box',
      }}
    >
      {badge}
      <div
        style={{ position: 'relative', padding: 16, background: '#fff', borderRadius: 18, display: 'flex' }}
      >
        <span style={{ width: size, height: size, maxWidth: '100%', display: 'block' }}>
          <Qr text={text} label={label} className="kit-qr" />
        </span>
        {logo ? (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%,-50%)',
              width: 38,
              height: 38,
              borderRadius: 10,
              display: 'grid',
              placeItems: 'center',
              border: '3px solid #fff',
              background: '#0a0a0a',
              color: '#f5f5f5',
            }}
            className="logo-mark"
          >
            <span style={{ width: 22, height: 22, display: 'block' }}>
              <ShijimaMark />
            </span>
          </span>
        ) : null}
      </div>
      {caption ? (
        <div style={{ fontSize: 11.5, color: 'var(--tx3)', textAlign: 'center', lineHeight: 1.5 }}>
          {caption}
        </div>
      ) : null}
    </div>
  )
}
