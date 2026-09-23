'use client'

import { EXPLORER } from '@desk/chain'
import { appCopy, short } from '@desk/shared'
import { Check, Copy, ExternalLink, Fuel } from 'lucide-react'
import { useState } from 'react'
import { Qr } from '@/components/ui/qr'

const c = appCopy.agentPage.money

/**
 * The agent is the account: its address, so anyone can send it USDG from any wallet or exchange, with a QR code
 * for a phone; and who pays for what, in cents, so nobody wonders how an agent trades without ETH.
 */
export function AgentMoney({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // A browser that refuses the clipboard still shows the full address to select by hand.
    }
  }
  return (
    <section className="ap-card ap-money" aria-label={c.title}>
      <p className="ap-label">{c.title}</p>
      <div className="ap-money-row">
        <Qr text={address} label={c.address} className="ap-money-qr" />
        <div className="ap-money-addr">
          <span className="ap-money-caption">{c.address}</span>
          <code title={address}>{short(address, 10, 8)}</code>
          <div className="ap-money-actions">
            <button type="button" className="ap-chip-btn" onClick={copy}>
              {copied ? (
                <Check aria-hidden="true" className="size-3.5" />
              ) : (
                <Copy aria-hidden="true" className="size-3.5" />
              )}
              {copied ? c.copied : c.copy}
            </button>
            <a
              className="ap-chip-btn"
              href={`${EXPLORER}/address/${address}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              <ExternalLink aria-hidden="true" className="size-3.5" />
              {c.explorer}
            </a>
          </div>
        </div>
      </div>
      <p className="ap-muted">{c.addressNote}</p>
      <div className="ap-gas">
        <Fuel aria-hidden="true" className="size-4" />
        <div>
          <strong>{c.gas}</strong>
          <p>{c.gasBody}</p>
        </div>
      </div>
    </section>
  )
}
