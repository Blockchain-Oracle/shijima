import type { CSSProperties, ReactNode } from 'react'

/**
 * The reference wallet's shared primitives (packages/ui/src/primitives.tsx @ 859d95f), ported as written: inline styles
 * that read the theme's CSS variables. Only the colours changed: the reference's periwinkle is our accent, and
 * its Stellar boundary names are Shijima's (an agent's money, your wallet, what leaves your wallet).
 */

export const fontMono = 'var(--fm)'

export type TxStatus = 'working' | 'confirmed' | 'done' | 'onItsWay' | 'pending' | 'failed'

const STATUS_COLOR: Record<TxStatus, string> = {
  working: 'var(--warn)',
  confirmed: 'var(--tx3)',
  done: 'var(--pos)',
  onItsWay: 'var(--warn)',
  pending: 'var(--ac2)',
  failed: 'var(--dng)',
}

const STATUS_LABEL: Record<TxStatus, string> = {
  working: 'WORKING',
  confirmed: 'CONFIRMED',
  done: 'DONE',
  onItsWay: 'ON ITS WAY',
  pending: 'PENDING',
  failed: 'FAILED',
}

/** Monospace status chip with a coloured dot. Pending, working and on-its-way pulse. */
export function StatusPill({ status, label }: { status: TxStatus; label?: string }) {
  const color = STATUS_COLOR[status]
  const pulses = status === 'pending' || status === 'working' || status === 'onItsWay'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 9.5,
        color,
        fontFamily: fontMono,
        letterSpacing: '.04em',
      }}
    >
      <span
        className={pulses ? 'animate-kitPulse' : undefined}
        style={{ width: 6, height: 6, borderRadius: '50%', background: color }}
      />
      {label ?? STATUS_LABEL[status]}
    </span>
  )
}

export type Boundary = 'agent' | 'wallet' | 'leaves' | 'onchain' | 'readOnly' | 'live' | 'neutral'

const BOUNDARY: Record<Boundary, { label: string; color: string }> = {
  agent: { label: 'YOUR AGENT', color: 'var(--ac2)' },
  wallet: { label: 'YOUR WALLET', color: 'var(--warn)' },
  leaves: { label: 'LEAVES YOUR WALLET', color: 'var(--dng)' },
  onchain: { label: 'ON CHAIN', color: 'var(--pub)' },
  readOnly: { label: 'READ-ONLY', color: 'var(--ac2)' },
  live: { label: 'MAINNET', color: 'var(--pos)' },
  neutral: { label: '', color: 'var(--tx3)' },
}

/** The small mono badge that names where money sits or goes on each money surface. */
export function BoundaryBadge({
  kind,
  label,
  size = 'md',
}: {
  kind: Boundary
  label?: string
  size?: 'sm' | 'md'
}) {
  const b = BOUNDARY[kind]
  const style: CSSProperties = {
    padding: size === 'sm' ? '2px 6px' : '2px 7px',
    border: '1px solid var(--bd2)',
    borderRadius: 5,
    fontSize: size === 'sm' ? 8.5 : 9,
    color: b.color,
    fontFamily: fontMono,
    letterSpacing: '.06em',
    whiteSpace: 'nowrap',
  }
  return <span style={style}>{label ?? b.label}</span>
}

/** Standard bordered surface card. */
export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ border: '1px solid var(--bd)', borderRadius: 14, background: 'var(--card)', ...style }}>
      {children}
    </div>
  )
}

export type CalloutTone = 'info' | 'warn' | 'wallet' | 'danger' | 'agent'

const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`

const CALLOUT_TONE: Record<CalloutTone, { border: string; bg: string; accent: string }> = {
  info: { border: tint('var(--ac)', 25), bg: tint('var(--ac)', 6), accent: 'var(--ac2)' },
  warn: { border: tint('var(--warn)', 30), bg: tint('var(--warn)', 6), accent: 'var(--warn)' },
  wallet: { border: tint('var(--pub)', 25), bg: tint('var(--pub)', 5), accent: 'var(--pub)' },
  danger: { border: tint('var(--dng)', 30), bg: tint('var(--dng)', 6), accent: 'var(--dng)' },
  agent: { border: tint('var(--ac)', 28), bg: tint('var(--ac)', 7), accent: 'var(--ac2)' },
}

/** Inline callout for what a step does, what it costs, or why it is refused. */
export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: CalloutTone
  title?: string
  children: ReactNode
}) {
  const t = CALLOUT_TONE[tone]
  return (
    <div
      style={{
        padding: '12px 14px',
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        background: t.bg,
        fontSize: 12,
        color: 'var(--tx2)',
        lineHeight: 1.55,
      }}
    >
      {title ? <span style={{ color: t.accent, fontWeight: 700 }}>{title} </span> : null}
      {children}
    </div>
  )
}

/** The network pill: Robinhood Chain mainnet is the only network, so the dot is always live. */
export function NetworkPill({ label = 'MAINNET' }: { label?: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        border: '1px solid var(--bd)',
        borderRadius: 999,
        fontSize: 9.5,
        color: 'var(--tx2)',
        fontFamily: fontMono,
        letterSpacing: '.08em',
      }}
    >
      <span
        className="animate-kitPulse"
        style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--pos)' }}
      />
      {label}
    </span>
  )
}

/** Filter / preset chip. */
export function Chip({
  label,
  active = false,
  onClick,
}: {
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      style={{
        padding: '5px 12px',
        borderRadius: 999,
        border: active ? '1px solid var(--ac)' : '1px solid var(--bd)',
        background: active ? tint('var(--ac)', 12) : 'transparent',
        color: active ? 'var(--tx)' : 'var(--tx2)',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

export type PillTone = 'pos' | 'warn' | 'ac' | 'neutral'

const PILL_COLOR: Record<PillTone, string> = {
  pos: 'var(--pos)',
  warn: 'var(--warn)',
  ac: 'var(--ac2)',
  neutral: 'var(--tx3)',
}

/** Small labelled status pill with an optional pulsing dot (SYNCED, CHECKED). */
export function Pill({
  label,
  tone = 'neutral',
  dot = false,
  pulse = false,
}: {
  label: string
  tone?: PillTone
  dot?: boolean
  pulse?: boolean
}) {
  const color = PILL_COLOR[tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        border: '1px solid var(--bd)',
        borderRadius: 999,
        fontSize: 9.5,
        color,
        fontFamily: fontMono,
        letterSpacing: '.06em',
        whiteSpace: 'nowrap',
      }}
    >
      {dot ? (
        <span
          className={pulse ? 'animate-kitPulse' : undefined}
          style={{ width: 5, height: 5, borderRadius: '50%', background: color }}
        />
      ) : null}
      {label}
    </span>
  )
}

/** Truncate a long address or hash: `head…tail`. */
export function truncateMiddle(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

/** The mono eyebrow label the reference puts over every field and group. */
export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        font: '600 9px/1 var(--fm)',
        letterSpacing: '.12em',
        color: 'var(--tx3)',
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** A page's title row, as every reference screen opens: 26px title, one quiet line, and whatever sits right. */
export function ScreenTitle({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontWeight: 800, fontSize: 26, letterSpacing: '-.025em', lineHeight: 1.1 }}>
          {title}
        </h1>
        {sub ? <div style={{ fontSize: 13, color: 'var(--tx2)', marginTop: 6 }}>{sub}</div> : null}
      </div>
      {right ? (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>{right}</div>
      ) : null}
    </div>
  )
}
