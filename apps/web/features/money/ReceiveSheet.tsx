'use client'

import { moneyCopy } from '@desk/shared'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { BoundaryBadge, Callout, QrCard, Segmented } from '@/components/kit'
import { BottomSheet } from '@/components/kit/sheet'
import { ChainLogo } from '@/components/ui/chain-logo'
import { TokenStack } from '@/components/ui/token-logo'

const EXPLORER = 'https://robinhoodchain.blockscout.com'

export interface ReceiveTarget {
  /** 'wallet', or the agent's slug. */
  key: string
  name: string
  address: string
  kind: 'wallet' | 'agent'
  /** Stock Tokens it can take: an agent's basket, or what the wallet holds. Drawn as logos beside the network. */
  symbols: string[]
}

/**
 * Receive, as a sheet over the wallet rather than a page: tap the QR or Receive and it opens, a dialog on wider
 * screens and a bottom sheet on phones. What to be paid to (your wallet or one of your agents), its QR code, the
 * full address with Copy, and where the money lands.
 */
export function ReceiveSheet({
  open,
  onClose,
  targets,
  initial,
}: {
  open: boolean
  onClose: () => void
  targets: ReceiveTarget[]
  initial: string
}) {
  const c = moneyCopy.receive
  const [key, setKey] = useState(targets.some((t) => t.key === initial) ? initial : 'wallet')
  const [copied, setCopied] = useState(false)
  const target = targets.find((t) => t.key === key) ?? targets[0]
  if (!target) return null
  const isAgent = target.kind === 'agent'

  const copy = () =>
    navigator.clipboard.writeText(target.address).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      },
      () => undefined,
    )

  return (
    <BottomSheet open={open} onClose={onClose} label={c.title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <strong style={{ fontSize: 18 }}>{c.title}</strong>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--tx3)', lineHeight: 1.5 }}>{c.sub}</p>
        </div>
        {targets.length > 1 ? (
          <Segmented
            label={c.title}
            size="sm"
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
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
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
        </div>
        <div className="mn-net-line">
          <ChainLogo chainId={4663} size={26} />
          <span className="mn-net-text">
            <small>{c.network}</small>
            <strong>{c.networkValue}</strong>
          </span>
          <span className="mn-net-text mn-net-takes">
            <small>{c.takes}</small>
            <TokenStack
              symbols={isAgent ? ['USDG', ...target.symbols] : ['USDG', 'ETH', ...target.symbols]}
              max={4}
              size={20}
            />
          </span>
        </div>
        <div className="kit-address-line">
          <code>{target.address}</code>
          <button type="button" onClick={() => void copy()}>
            {copied ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
            {copied ? c.copied : c.copy}
          </button>
        </div>
        <Callout
          tone={isAgent ? 'agent' : 'wallet'}
          title={isAgent ? c.agentCalloutTitle : c.walletCalloutTitle}
        >
          {isAgent ? c.agentCallout : c.walletCallout}
        </Callout>
        <a
          href={`${EXPLORER}/address/${target.address}`}
          target="_blank"
          rel="noreferrer noopener"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--ac2)',
          }}
        >
          <ExternalLink aria-hidden="true" size={13} /> {c.explorer}
        </a>
      </div>
    </BottomSheet>
  )
}
