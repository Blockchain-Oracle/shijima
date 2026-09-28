'use client'

import { EXPLORER } from '@desk/chain'
import { appCopy, CASH_LOOK, lookOf, short } from '@desk/shared'
import { Check, Copy, ExternalLink, QrCode, Wallet } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Qr } from '@/components/ui/qr'
import { TokenLogo, TokenStack } from '@/components/ui/token-logo'

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
  balances,
  holdings = [],
}: {
  address: string
  /** The agent's last check: cash, savings and total. Stocks are what remains. */
  balances: AgentBalances | null
  /** What each stock is worth, for the bar's segments and logos. */
  holdings?: { symbol: string; valueUsdg: string }[]
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
      {balances ? <Balances b={balances} holdings={holdings} /> : null}
      {open && (
        <div id="ap-wallet-more" className="ap-wallet-more">
          <Qr text={address} label={c.address} className="ap-money-qr" />
          <div className="ap-wallet-more-text">
            <code className="ap-wallet-full">{address}</code>
            <p>{c.addressNote}</p>
            <p className="ap-muted">{c.gasBody}</p>
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * Where the money is, as one bar split by what holds it (after 21st's Partition Bar, 26545): a segment per stock
 * in its own colour, then savings and cash, with the total beside the title and a legend of logos, dollars and
 * shares under it. An empty account shows an empty track and says so.
 */
function Balances({ b, holdings }: { b: AgentBalances; holdings: { symbol: string; valueUsdg: string }[] }) {
  const cash = BigInt(b.cashUsdg)
  const savings = BigInt(b.vaultUsdg)
  const total = BigInt(b.totalUsdg)
  const stocks = total - cash - savings > 0n ? total - cash - savings : 0n
  const held = holdings
    .map((h) => ({ symbol: h.symbol, value: BigInt(h.valueUsdg) }))
    .filter((h) => h.value > 0n)
    .sort((a, b) => (b.value > a.value ? 1 : -1))
  const share = (v: bigint) => (total > 0n ? Number((v * 10_000n) / total) / 100 : 0)
  const pct = (v: bigint) => `${share(v).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
  const segments = [
    ...held.map((h) => ({ key: h.symbol, value: h.value, color: lookOf(h.symbol).color })),
    ...(savings > 0n ? [{ key: c.savings, value: savings, color: 'var(--color-profit)' }] : []),
    ...(cash > 0n ? [{ key: c.cash, value: cash, color: CASH_LOOK.color }] : []),
  ]
  const legend: { key: string; logo: ReactNode; label: string; value: bigint }[] = [
    {
      key: 'stocks',
      logo: held.length > 0 ? <TokenStack symbols={held.map((h) => h.symbol)} size={18} max={4} /> : null,
      label: c.stocks,
      value: stocks,
    },
    ...(savings > 0n
      ? [{ key: 'savings', logo: <TokenLogo symbol="USDG" size={18} />, label: c.savings, value: savings }]
      : []),
    { key: 'cash', logo: <TokenLogo symbol="USDG" size={18} />, label: c.cash, value: cash },
  ]
  return (
    <div
      className="ap-split"
      // The time is written in the reader's own zone, which the server cannot know.
      suppressHydrationWarning
      title={c.asOf(new Date(b.takenAt).toLocaleString())}
    >
      <div className="ap-split-head">
        <span className="ap-split-title">{c.split}</span>
        <span className="ap-split-total">
          <small>{c.total}</small>
          {dollars(total)}
        </span>
      </div>
      {total > 0n ? (
        <ul className="ap-split-bar" aria-hidden="true">
          {segments.map((sg) => (
            <li
              className="ap-split-seg"
              key={sg.key}
              style={{ flexGrow: share(sg.value), background: sg.color }}
              title={`${sg.key} ${pct(sg.value)}`}
            />
          ))}
        </ul>
      ) : (
        <div className="ap-split-bar is-empty" aria-hidden="true" />
      )}
      {total > 0n ? (
        <dl className="ap-split-legend">
          {legend.map((l) => (
            <div key={l.key} className="ap-split-item">
              <dt>
                {l.logo}
                {l.label}
              </dt>
              <dd>
                {dollars(l.value)}
                <small>{pct(l.value)}</small>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="ap-muted">{c.empty}</p>
      )}
    </div>
  )
}
