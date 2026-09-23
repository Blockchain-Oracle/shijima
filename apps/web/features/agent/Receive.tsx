'use client'

import { appCopy, short } from '@desk/shared'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Qr } from '@/components/ui/qr'

/**
 * The third way to add money: send USDG on Robinhood Chain to the agent's own address, from any wallet or an
 * exchange. No signature here and nothing for the site to do: the money simply arrives in the account.
 */
export function Receive({ address }: { address: string }) {
  const c = appCopy.receive
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // The full address stays on screen to select by hand.
    }
  }
  return (
    <div className="receive">
      <p className="receive-title">{c.title}</p>
      <div className="receive-row">
        <Qr text={address} label={c.title} className="receive-qr" />
        <div className="receive-body">
          <code className="receive-addr">{address}</code>
          <button type="button" className="ap-chip-btn" onClick={copy}>
            {copied ? (
              <Check aria-hidden="true" className="size-3.5" />
            ) : (
              <Copy aria-hidden="true" className="size-3.5" />
            )}
            {copied ? c.copied : c.copy(short(address, 6, 4))}
          </button>
          <p className="receive-warn">{c.warn}</p>
        </div>
      </div>
    </div>
  )
}
