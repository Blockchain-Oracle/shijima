'use client'

import { EXPLORER } from '@desk/chain'
import { appCopy, short } from '@desk/shared'
import { Check, Copy, ExternalLink, QrCode, Wallet } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useState } from 'react'
import { Qr } from '@/components/ui/qr'

const c = appCopy.agentPage.money

/**
 * The agent is the account, so its address sits at the top of the page (DECISIONS F3): where an owner looks
 * first to add money. One line with copy and Blockscout; the QR code, what to send and who pays for gas open on
 * demand beneath it, for a phone beside the computer.
 */
export interface AgentBalances {
  cashUsdg: string
  vaultUsdg: string
  totalUsdg: string
  takenAt: string
}

const dollars = (raw: bigint) =>
  `$${(Number(raw) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function AgentMoney({
  address,
  slug,
  balances,
}: {
  address: string
  slug: string
  /** The agent's last check: cash, savings and total. Stocks are what remains. */
  balances: AgentBalances | null
}) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // A browser that refuses the clipboard still shows the full address in the QR panel to select by hand.
    }
  }
  return (
    <section className="ap-wallet" aria-label={c.title}>
      <div className="ap-wallet-bar">
        <span className="ap-wallet-mark" aria-hidden="true">
          <Wallet className="size-4" />
        </span>
        <div className="ap-wallet-id">
          <span className="ap-wallet-label">{c.title}</span>
          <code title={address}>{short(address, 8, 6)}</code>
        </div>
        <div className="ap-money-actions">
          <button type="button" className="ap-chip-btn" onClick={copy}>
            {copied ? (
              <Check aria-hidden="true" className="size-3.5" />
            ) : (
              <Copy aria-hidden="true" className="size-3.5" />
            )}
            {copied ? c.copied : c.copy}
          </button>
          <button
            type="button"
            className="ap-chip-btn"
            aria-expanded={open}
            aria-controls="ap-wallet-more"
            onClick={() => setOpen((v) => !v)}
          >
            <QrCode aria-hidden="true" className="size-3.5" />
            {open ? c.hideQr : c.qr}
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
      {balances ? <Balances b={balances} /> : null}
      {open && (
        <div id="ap-wallet-more" className="ap-wallet-more">
          <Qr text={address} label={c.address} className="ap-money-qr" />
          <div className="ap-wallet-more-text">
            <code className="ap-wallet-full">{address}</code>
            <p>{c.addressNote}</p>
            <p className="ap-muted">{c.gasBody}</p>
            <Link href={`/receive?agent=${slug}` as Route} className="ap-chip-btn self-start">
              {c.receive} →
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}

/** Cash · Savings · Stocks · Total, the wallet card's split for one agent, from its last check. */
function Balances({ b }: { b: AgentBalances }) {
  const cash = BigInt(b.cashUsdg)
  const savings = BigInt(b.vaultUsdg)
  const total = BigInt(b.totalUsdg)
  const stocks = total - cash - savings > 0n ? total - cash - savings : 0n
  const cells: [string, bigint][] = [
    [c.cash, cash],
    ...(savings > 0n ? ([[c.savings, savings]] as [string, bigint][]) : []),
    [c.stocks, stocks],
    [c.total, total],
  ]
  return (
    <dl className="ap-balances" title={c.asOf(new Date(b.takenAt).toLocaleString())}>
      {cells.map(([label, v]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{dollars(v)}</dd>
        </div>
      ))}
    </dl>
  )
}
