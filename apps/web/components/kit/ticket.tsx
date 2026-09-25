'use client'

import { moneyCopy } from '@desk/shared'
import { ArrowDown, Check, ChevronDown, Search } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { formatUnits } from 'viem'
import { quoteMoveAction } from '@/app/money-actions'
import { CHAIN_LOGOS, ChainLogo } from '@/components/ui/chain-logo'
import { TokenLogo } from '@/components/ui/token-logo'
import type { MoveInput, MoveQuote } from '@/lib/money/types'
import { BottomSheet } from './sheet'

/**
 * The money ticket, after 21st's Multi-chain Swap (16251): a "you pay" box with a token pill that wears its chain,
 * an arrow, a "you get" box with the live quote, and a route summary beside it. Rebuilt on the kit's tokens; the
 * quote comes from the same planner Review uses, so what the screen shows is what the wallet will be asked to sign.
 */

const t = moneyCopy.ticket

/** A raw amount as people read it: up to six significant digits, never scientific notation. */
export function readable(raw: string | bigint, decimals: number): string {
  const n = Number(formatUnits(BigInt(raw), decimals))
  if (n === 0) return '0'
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 })
  return n.toLocaleString('en-US', { maximumSignificantDigits: 4 })
}

export const dollars = (usd: number) =>
  `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** A token and its chain: the logo with the chain's logo as a badge, as wallets show them. */
export function AssetMark({
  symbol,
  chainId,
  size = 32,
}: {
  symbol: string
  chainId: number
  size?: number
}) {
  const badge = Math.round(size * 0.46)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flex: 'none', width: size, height: size }}>
      <TokenLogo symbol={symbol} size={size} />
      <span
        style={{
          position: 'absolute',
          right: -3,
          bottom: -3,
          display: 'inline-flex',
          padding: 1.5,
          borderRadius: Math.round(badge * 0.36),
          background: 'var(--panel)',
        }}
      >
        <ChainLogo chainId={chainId} size={badge} />
      </span>
    </span>
  )
}

/** The pill inside a ticket box: token, chain, and a chevron when it opens a picker. */
export function AssetPill({
  symbol,
  chainId,
  label,
  onClick,
}: {
  symbol: string
  chainId: number
  /** Replaces the symbol, as "Shijima's own" for an agent. */
  label?: string
  onClick?: () => void
}) {
  const body = (
    <>
      <AssetMark symbol={symbol} chainId={chainId} size={28} />
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
        <strong style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--tx)' }}>{label ?? symbol}</strong>
        <small style={{ fontSize: 10.5, color: 'var(--tx3)' }}>
          {label ? `${symbol} · ` : ''}
          {CHAIN_LOGOS[chainId]?.name ?? ''}
        </small>
      </span>
      {onClick ? <ChevronDown aria-hidden="true" size={15} style={{ color: 'var(--tx3)' }} /> : null}
    </>
  )
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 9,
    flex: 'none',
    padding: '6px 11px 6px 7px',
    borderRadius: 999,
    border: '1px solid var(--bd2)',
    background: 'var(--panel)',
    maxWidth: '100%',
  } as const
  return onClick ? (
    <button type="button" className="kit-pill-btn" onClick={onClick} style={{ ...style, cursor: 'pointer' }}>
      {body}
    </button>
  ) : (
    <span style={style}>{body}</span>
  )
}

/**
 * Two assets in one pill, a thumb under the chosen one: tap anywhere and it slides to the other. Used where the
 * owner picks what arrives, USDG or ETH, right on the asset instead of a row of buttons under the ticket.
 */
export function AssetToggle<A extends string, B extends string>({
  left,
  right,
  value,
  chainId,
  onChange,
  label,
}: {
  left: A
  right: B
  value: A | B
  chainId: number
  onChange: (value: A | B) => void
  label: string
}) {
  const onRight = value === right
  return (
    <button
      type="button"
      role="switch"
      aria-checked={onRight}
      aria-label={label}
      title={label}
      className="kit-asset-toggle"
      data-right={onRight ? '' : undefined}
      onClick={() => onChange(onRight ? left : right)}
    >
      <span className="kit-asset-toggle-thumb" aria-hidden="true" />
      {[left, right].map((sym) => (
        <span key={sym} className="kit-asset-toggle-side" data-on={sym === value ? '' : undefined}>
          <AssetMark symbol={sym} chainId={chainId} size={22} />
          <strong>{sym}</strong>
        </span>
      ))}
    </button>
  )
}

/** One side of the ticket: a label row, then the amount on the left and the asset on the right. */
export function TicketBox({
  label,
  side,
  children,
  foot,
}: {
  label: string
  /** Shown at the right of the label row: what you hold, and Max. */
  side?: ReactNode
  children: ReactNode
  foot?: ReactNode
}) {
  return (
    <div className="kit-ticket-box">
      <div className="kit-ticket-top">
        <span>{label}</span>
        {side ? <span className="kit-ticket-side">{side}</span> : null}
      </div>
      <div className="kit-ticket-row">{children}</div>
      {foot ? <div className="kit-ticket-foot">{foot}</div> : null}
    </div>
  )
}

/** The big number a person types. Accepts digits and one point only. */
export function TicketAmount({
  value,
  onChange,
  label,
  invalid,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  invalid?: boolean
}) {
  return (
    <input
      className="kit-ticket-amount"
      data-invalid={invalid || undefined}
      inputMode="decimal"
      autoComplete="off"
      placeholder="0"
      aria-label={label}
      value={value}
      onChange={(e) => {
        const v = e.target.value.replace(',', '.')
        if (/^\d*\.?\d*$/.test(v)) onChange(v)
      }}
    />
  )
}

/** The quoted side: what lands, while it is being priced, or a dash before there is an amount. */
export function TicketQuoted({ text, loading }: { text: string | null; loading?: boolean }) {
  return (
    <output className="kit-ticket-amount kit-ticket-quoted" data-loading={loading || undefined}>
      {text ?? '0'}
    </output>
  )
}

/** The arrow between the two boxes. */
export function TicketArrow() {
  return (
    <div className="kit-ticket-arrow" aria-hidden="true">
      <span>
        <ArrowDown size={16} />
      </span>
    </div>
  )
}

export interface PickOption {
  key: string
  symbol: string
  name: string
  chainId: number
  /** What is held, already formatted, and its worth. */
  held?: string
  usd?: string | null
  note?: string
}

/**
 * Pick a token, filtered by chain when there is more than one: a sheet on phones, a dialog on wider screens, each
 * row with its logo, its chain and what you hold.
 */
export function AssetPicker({
  open,
  onClose,
  title,
  options,
  selected,
  onPick,
}: {
  open: boolean
  onClose: () => void
  title: string
  options: PickOption[]
  selected?: string
  onPick: (key: string) => void
}) {
  const chains = useMemo(() => [...new Set(options.map((o) => o.chainId))], [options])
  const [chain, setChain] = useState<number | 'all'>('all')
  const [query, setQuery] = useState('')
  const shown = options.filter(
    (o) =>
      (chain === 'all' || o.chainId === chain) &&
      (query === '' || `${o.symbol} ${o.name}`.toLowerCase().includes(query.toLowerCase())),
  )
  return (
    <BottomSheet open={open} onClose={onClose} label={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <strong style={{ fontSize: 17 }}>{title}</strong>
        {options.length > 8 ? (
          <label className="kit-picker-search">
            <Search aria-hidden="true" size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} />
          </label>
        ) : null}
        {chains.length > 1 ? (
          <div className="kit-picker-chains">
            <button type="button" aria-pressed={chain === 'all'} onClick={() => setChain('all')}>
              {t.allChains}
            </button>
            {chains.map((id) => (
              <button key={id} type="button" aria-pressed={chain === id} onClick={() => setChain(id)}>
                <ChainLogo chainId={id} size={16} /> {CHAIN_LOGOS[id]?.name ?? id}
              </button>
            ))}
          </div>
        ) : null}
        <div className="kit-picker-list">
          {shown.map((o) => (
            <button
              key={o.key}
              type="button"
              className="kit-picker-row"
              aria-pressed={o.key === selected}
              onClick={() => {
                onPick(o.key)
                onClose()
              }}
            >
              <AssetMark symbol={o.symbol} chainId={o.chainId} size={32} />
              <span className="kit-picker-name">
                <strong>{o.symbol}</strong>
                <em>{o.note ?? `${o.name} · ${CHAIN_LOGOS[o.chainId]?.name ?? ''}`}</em>
              </span>
              <span className="kit-picker-held">
                {o.held ? <b>{o.held}</b> : null}
                {o.usd ? <em>{o.usd}</em> : null}
              </span>
              {o.key === selected ? (
                <Check aria-hidden="true" size={16} style={{ color: 'var(--ac2)' }} />
              ) : null}
            </button>
          ))}
          {shown.length === 0 ? <p className="kit-picker-none">{t.noMatch}</p> : null}
        </div>
      </div>
    </BottomSheet>
  )
}

export interface QuoteState {
  quote: MoveQuote | null
  why: string | null
  hint: { kind: 'use_fund'; deskId: string; deskSlug: string | null } | { kind: 'need_origin' } | null
  loading: boolean
}

/**
 * A live quote for the move the form describes, fetched half a second after the owner stops typing and again every
 * 30 seconds while it stands, since prices move. Nothing is saved and nothing is signed.
 */
export function useLiveQuote(input: MoveInput | null): QuoteState {
  const key = input ? JSON.stringify(input) : ''
  const [state, setState] = useState<QuoteState>({ quote: null, why: null, hint: null, loading: false })
  const seq = useRef(0)
  useEffect(() => {
    if (!key) {
      setState({ quote: null, why: null, hint: null, loading: false })
      return
    }
    const mine = ++seq.current
    setState((s) => ({ ...s, loading: true }))
    const run = () =>
      quoteMoveAction(JSON.parse(key) as MoveInput)
        .then((r) => {
          if (mine !== seq.current) return
          setState(
            r.ok
              ? { quote: r.quote, why: null, hint: null, loading: false }
              : { quote: null, why: r.why, hint: r.hint ?? null, loading: false },
          )
        })
        .catch(() => mine === seq.current && setState((s) => ({ ...s, loading: false })))
    const first = window.setTimeout(run, 450)
    const again = window.setInterval(run, 30_000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(again)
    }
  }, [key])
  return state
}

/** One line of the route summary. */
export interface SummaryRow {
  label: string
  value: ReactNode
  strong?: boolean
}

/** The rows a quote gives every screen: what lands, the least it can be, the cost, the time and how it moves. */
export function quoteRows(q: MoveQuote | null): SummaryRow[] {
  if (!q) return []
  const r = q.receive
  const rows: SummaryRow[] = [
    { label: t.youGet, value: `${readable(r.amountRaw, r.decimals)} ${r.symbol}`, strong: true },
  ]
  if (r.minimumRaw !== r.amountRaw && BigInt(r.minimumRaw) > 0n)
    rows.push({ label: t.atLeast, value: `${readable(r.minimumRaw, r.decimals)} ${r.symbol}` })
  const fee = Number(q.feeUsdg) / 1e6
  rows.push({ label: t.cost, value: fee <= 0 ? t.free : fee < 0.01 ? t.underCent : `≈ ${dollars(fee)}` })
  rows.push({
    label: t.time,
    value: q.timeEstimate ? t.seconds(q.timeEstimate) : q.route === 'relay' ? t.aboutAMinute : t.oneBlock,
  })
  rows.push({ label: t.route, value: t.routes[q.route] })
  rows.push({ label: t.signatures, value: String(q.signatures) })
  return rows
}

/** The summary beside the ticket: from where to where, then its rows. */
export function RouteSummary({
  from,
  to,
  rows,
  loading,
  empty,
}: {
  from: { chainId: number; label: string }
  to: { chainId: number; label: string }
  rows: SummaryRow[]
  loading?: boolean
  empty: string
}) {
  return (
    <div className="kit-summary" data-loading={loading || undefined}>
      <div className="kit-summary-path">
        <span>
          <ChainLogo chainId={from.chainId} size={22} />
          <em>{from.label}</em>
        </span>
        <i aria-hidden="true" />
        <span>
          <ChainLogo chainId={to.chainId} size={22} />
          <em>{to.label}</em>
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="kit-summary-empty">{loading ? t.pricing : empty}</p>
      ) : (
        <dl className="kit-summary-rows">
          {rows.map((r) => (
            <div key={r.label} data-strong={r.strong || undefined}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
