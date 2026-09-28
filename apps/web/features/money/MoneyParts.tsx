import { CASH_LOOK, lookOf, moneyCopy } from '@desk/shared'
import type { ReactNode } from 'react'
import { AssetMark } from '@/components/kit/ticket'
import { AllocationDonut, type DonutSlice } from '@/components/ui/allocation-donut'
import { type Brand, BrandLogo } from '@/components/ui/brand-logo'
import { CHAIN_LOGOS, ChainLogo } from '@/components/ui/chain-logo'
import { TokenLogo } from '@/components/ui/token-logo'

/**
 * The money pages' shared pieces, drawn with real marks: every token, chain and partner wears its own logo.
 * Styles are the `.mn-*` rules in styles/kit/wallet.css.
 */

const t = moneyCopy.ticket
const ROBINHOOD = 4663

/** A logo an empty state can hold: a token, a chain or a partner. Never a stand-in icon. */
export type Mark = { token: string } | { chain: number } | { brand: Brand }

const markKey = (m: Mark) => ('token' in m ? m.token : 'chain' in m ? `c${m.chain}` : m.brand)

function MarkTile({ mark }: { mark: Mark }) {
  if ('token' in mark) return <TokenLogo symbol={mark.token} size={26} />
  if ('chain' in mark) return <ChainLogo chainId={mark.chain} size={26} />
  return <BrandLogo brand={mark.brand} size={26} />
}

/**
 * A designed empty state, after 21st's Empty State (1435): a dashed card, three tilted tiles that fan out on
 * hover (each holding a real logo), a title, one line, and the way forward.
 */
export function MoneyEmpty({
  marks,
  title,
  body,
  children,
}: {
  marks: Mark[]
  title: string
  body: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="mn-empty">
      <div className="mn-empty-marks" aria-hidden="true" data-n={Math.min(marks.length, 3)}>
        {marks.slice(0, 3).map((m) => (
          <span key={markKey(m)} className="mn-empty-tile">
            <MarkTile mark={m} />
          </span>
        ))}
      </div>
      <strong>{title}</strong>
      <p>{body}</p>
      {children ? <div className="mn-empty-actions">{children}</div> : null}
    </div>
  )
}

/** Numbers side by side in bordered cells, after 21st's Stats Grid (29195), as the Plan tab's limits. */
export function StatGrid({
  cells,
  label,
}: {
  cells: { key: string; value: string; label: string; note?: string; tone?: 'pos' | 'warn' }[]
  label: string
}) {
  return (
    <section className="mn-stats" aria-label={label}>
      {cells.map((c) => (
        <div key={c.key}>
          <span className="mn-stat-value" data-tone={c.tone}>
            {c.value}
          </span>
          <span className="mn-stat-label">{c.label}</span>
          {c.note ? <small>{c.note}</small> : null}
        </div>
      ))}
    </section>
  )
}

export interface HoldingLine {
  /** Unique within the list: "cash", "savings", or a symbol. */
  key: string
  /** The logo to draw. */
  symbol: string
  name: string
  sub: string
  valueUsd: number | null
}

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * What an account holds, drawn as the Plan tab draws a basket: 21st's Sectors Donut (22247) beside one row per
 * holding with its real logo, a bar to its share, and its dollar value in mono.
 */
export function HoldingsBreakdown({ lines, caption }: { lines: HoldingLine[]; caption: string }) {
  const total = lines.reduce((s, l) => s + (l.valueUsd ?? 0), 0)
  const widest = Math.max(...lines.map((l) => l.valueUsd ?? 0), 0.000001)
  const colour = (l: HoldingLine) => (l.symbol === 'USDG' ? CASH_LOOK.color : lookOf(l.symbol).color)
  const slices: DonutSlice[] =
    total > 0
      ? lines
          .filter((l) => (l.valueUsd ?? 0) > 0)
          .map((l) => ({
            symbol: l.key,
            label: l.name,
            pct: ((l.valueUsd ?? 0) / total) * 100,
            color: colour(l),
          }))
      : []
  return (
    <div className="mn-hold-wrap">
      <div className="mn-hold">
        <AllocationDonut slices={slices} size={124} center={money(total)} caption={caption} />
        <ul className="mn-hold-rows">
          {lines.map((l) => (
            <li key={l.key}>
              <AssetMark symbol={l.symbol} chainId={ROBINHOOD} size={30} />
              <span className="mn-hold-name">
                <b>{l.name}</b>
                <small>{l.sub}</small>
              </span>
              <span className="mn-hold-bar" aria-hidden="true">
                <i
                  className="mn-hold-fill"
                  style={{ width: `${((l.valueUsd ?? 0) / widest) * 100}%`, background: colour(l) }}
                />
              </span>
              <span className="mn-hold-value">{l.valueUsd === null ? '—' : money(l.valueUsd)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export interface WalletLine {
  key: string
  symbol: string
  name: string
  held: string
  usd: string | null
}

/** Your own wallet beside a ticket: each token with its logo on Robinhood Chain, the amount and its worth. */
export function WalletList({ lines, selected }: { lines: WalletLine[]; selected?: string }) {
  return (
    <div className="mn-card">
      <header className="mn-card-head">
        <ChainLogo chainId={ROBINHOOD} size={22} />
        <span className="mn-card-head-text">
          <strong>{t.inWallet}</strong>
          <small>{t.inWalletNote}</small>
        </span>
      </header>
      <ul className="mn-wallet-rows">
        {lines.map((l) => (
          <li key={l.key} data-on={l.key === selected || undefined}>
            <AssetMark symbol={l.symbol} chainId={ROBINHOOD} size={30} />
            <span className="mn-hold-name">
              <b>{l.symbol}</b>
              <small>{l.name}</small>
            </span>
            <span className="mn-wallet-amt">
              <b>{l.held}</b>
              <small>{l.usd ?? '—'}</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const NETWORKS = [4663, 8453, 42161, 1, 56]

/**
 * Where money can go from here: numbered steps when given, every network as a logo tile (Robinhood Chain marked
 * home), and the partners that carry it, each with its own mark.
 */
export function NetworksCard({
  title,
  steps,
  via,
}: {
  title?: string
  steps?: readonly string[]
  via: Brand[]
}) {
  return (
    <div className="mn-card">
      {title ? <strong className="mn-card-title">{title}</strong> : null}
      {steps ? (
        <ol className="mn-steps">
          {steps.map((s, i) => (
            <li key={s} className="mn-step">
              <span aria-hidden="true" className="mn-step-n">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      ) : null}
      <span className="mn-kicker">{t.networks}</span>
      <ul className="mn-nets">
        {NETWORKS.map((id) => (
          <li key={id} className="mn-net" data-home={id === ROBINHOOD || undefined}>
            <ChainLogo chainId={id} size={24} />
            <span className="mn-net-name">{CHAIN_LOGOS[id]?.name}</span>
            {id === ROBINHOOD ? <em className="mn-net-home">{t.home}</em> : null}
          </li>
        ))}
      </ul>
      <div className="mn-via">
        <span className="mn-kicker">{t.via}</span>
        {via.map((b) => (
          <span key={b} className="mn-via-brand">
            <BrandLogo brand={b} size={18} />
            {b === 'relay' ? t.relay : b === 'uniswap' ? t.uniswap : b}
          </span>
        ))}
      </div>
    </div>
  )
}
