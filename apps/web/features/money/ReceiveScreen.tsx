'use client'

import { moneyCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { useState } from 'react'
import {
  BoundaryBadge,
  Button,
  Callout,
  Eyebrow,
  QrCard,
  Screen,
  ScreenTitle,
  Segmented,
} from '@/components/kit'

const EXPLORER = 'https://robinhoodchain.blockscout.com'

export interface ReceiveTarget {
  /** 'wallet', or the agent's slug. */
  key: string
  name: string
  address: string
  kind: 'wallet' | 'agent'
}

/**
 * The reference wallet's Receive (apps/web/src/wallet/ReceiveScreen.tsx): a segmented choice of what to be paid
 * to, the QR card, the full address with Copy, and a callout that says where the money lands and what not to
 * send. Shijima's tabs are your own wallet and each of your agents.
 */
export function ReceiveScreen({ targets, initial }: { targets: ReceiveTarget[]; initial: string }) {
  const c = moneyCopy.receive
  const [key, setKey] = useState(targets.some((t) => t.key === initial) ? initial : 'wallet')
  const [copied, setCopied] = useState(false)
  const target = targets.find((t) => t.key === key) ?? targets[0]
  if (!target) return null
  const isAgent = target.kind === 'agent'

  const copy = () => {
    // Only say "Copied" when the clipboard really took it.
    navigator.clipboard.writeText(target.address).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      },
      () => undefined,
    )
  }

  return (
    <Screen width={760}>
      <ScreenTitle title={c.title} sub={c.sub} />
      {targets.length > 1 ? (
        <div>
          <Segmented
            label={c.title}
            options={targets.map((t) => ({
              value: t.key,
              label: t.kind === 'wallet' ? c.tabWallet : t.name,
            }))}
            value={target.key}
            onChange={(v) => {
              setKey(v)
              setCopied(false)
            }}
          />
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 30, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <QrCard
          text={target.address}
          label={isAgent ? c.agentCaption : c.walletCaption}
          badge={
            isAgent ? (
              <BoundaryBadge kind="agent" label={target.name.toUpperCase()} />
            ) : (
              <BoundaryBadge kind="wallet" />
            )
          }
          caption={isAgent ? c.agentCaption : c.walletCaption}
        />
        <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Eyebrow style={{ marginBottom: 8 }}>
              {isAgent ? c.agentLabel(target.name) : c.walletLabel}
            </Eyebrow>
            <div
              style={{
                border: '1px solid var(--bd2)',
                borderRadius: 13,
                background: 'var(--card)',
                padding: 15,
                fontFamily: 'var(--fm)',
                fontSize: 13,
                color: 'var(--tx)',
                lineHeight: 1.6,
                wordBreak: 'break-all',
              }}
            >
              {target.address}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 11, flexWrap: 'wrap' }}>
            <Button onClick={copy}>{copied ? c.copied : c.copy}</Button>
            <a
              href={`${EXPLORER}/address/${target.address}`}
              target="_blank"
              rel="noreferrer noopener"
              style={{ alignSelf: 'center', fontSize: 12.5, fontWeight: 600, color: 'var(--ac2)' }}
            >
              {c.explorer} ↗
            </a>
          </div>
          <Callout
            tone={isAgent ? 'agent' : 'wallet'}
            title={isAgent ? c.agentCalloutTitle : c.walletCalloutTitle}
          >
            {isAgent ? c.agentCallout : c.walletCallout}
          </Callout>
          <div style={{ fontSize: 12.5, color: 'var(--tx2)' }}>
            {c.elsewhere}{' '}
            <Link href={'/bridge' as Route} style={{ color: 'var(--ac2)', fontWeight: 600 }}>
              {c.elsewhereLink} →
            </Link>
          </div>
        </div>
      </div>
    </Screen>
  )
}
