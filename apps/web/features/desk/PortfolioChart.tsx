'use client'

import { deskCopy, usd } from '@desk/shared'
import { motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'

/**
 * The desk's value through time, after 21st's Portfolio Chart (29532): the value line against a dashed line for
 * where it started, a strip underneath showing how far it sits below its own high, a crosshair that reads out
 * any moment, and dots where the desk decided something. Ranges without enough history are not offered.
 */
export interface ValuePoint {
  /** Milliseconds since 1970. */
  t: number
  /** Dollars. */
  value: number
  /** True for a point from the desk's earlier contract, drawn in the same line. */
  earlier?: boolean
  /**
   * Money the owner put in minus money taken out so far, in dollars. When points carry it, every change the chart
   * reads out is NET of it: taking $2 out reads as no change, not a loss.
   */
  flow?: number
}
export interface ChartMarker {
  t: number
  /** A decision, or money the owner moved: `in` added, `out` taken out. */
  kind: 'acted' | 'would' | 'waited' | 'in' | 'out'
  /** Read on hover, and in the legend for money: "You took out $2". */
  label?: string
}

const HOUR = 3_600_000
const DAY = 24 * HOUR
const RANGES = [
  { key: '1D', ms: DAY },
  { key: '1W', ms: 7 * DAY },
  { key: '1M', ms: 30 * DAY },
  { key: 'ALL', ms: Number.POSITIVE_INFINITY },
] as const
type RangeKey = (typeof RANGES)[number]['key']

const PAD = { top: 10, right: 58, bottom: 22, left: 4 }
const DD_SHARE = 0.22
const GAP = 12
const MARKER_COLOR = {
  acted: 'var(--profit)',
  would: 'var(--color-accent)',
  waited: 'var(--color-info)',
  in: 'var(--color-ink)',
  out: 'var(--color-ink-muted)',
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e?.contentRect.width ?? 0))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** A smooth path through points that never overshoots them (monotone cubic). */
function monotone(pts: { x: number; y: number }[]): string {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${pts[0]?.x},${pts[0]?.y}`
  const dx: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i] as { x: number; y: number }
    const b = pts[i + 1] as { x: number; y: number }
    dx.push(b.x - a.x)
    m.push((b.y - a.y) / (b.x - a.x || 1))
  }
  const t: number[] = [m[0] ?? 0]
  for (let i = 1; i < n - 1; i++) {
    const a = m[i - 1] ?? 0
    const b = m[i] ?? 0
    const h0 = dx[i - 1] ?? 0
    const h1 = dx[i] ?? 0
    t.push(a * b <= 0 ? 0 : (3 * (h0 + h1)) / ((2 * h1 + h0) / a + (h1 + 2 * h0) / b))
  }
  t.push(m[n - 2] ?? 0)
  let d = `M${pts[0]?.x.toFixed(1)},${pts[0]?.y.toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i] as { x: number; y: number }
    const b = pts[i + 1] as { x: number; y: number }
    const h = (dx[i] ?? 0) / 3
    d += `C${(a.x + h).toFixed(1)},${(a.y + h * (t[i] ?? 0)).toFixed(1)} ${(b.x - h).toFixed(1)},${(b.y - h * (t[i + 1] ?? 0)).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`
  }
  return d
}

const money = (v: number) => usd(BigInt(Math.round(v * 1e6)))
const when = (t: number) =>
  new Date(t).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })

export function PortfolioChart({
  points,
  baseline,
  markers = [],
  height = 300,
}: {
  points: ValuePoint[]
  /** Where the desk started, in dollars. The dashed line, and what "up" and "down" are measured from. */
  baseline: number | null
  markers?: ChartMarker[]
  height?: number
}) {
  const c = deskCopy.chart
  const reduced = useReducedMotion()
  const uid = useId().replace(/:/g, '')
  const [wrap, width] = useWidth<HTMLDivElement>()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const span = points.length > 1 ? (points.at(-1)?.t ?? 0) - (points[0]?.t ?? 0) : 0

  // Only offer a range that shows something the next one down does not.
  const offered = RANGES.filter((r, i) => {
    if (r.key === 'ALL') return true
    const shorter = RANGES[i - 1]
    return span > (shorter?.ms ?? 0) * 1.5 && (r.ms < span || i === 0)
  })
  const [range, setRange] = useState<RangeKey>('ALL')
  const [hover, setHover] = useState<number | null>(null)

  const view = useMemo(() => {
    const r = RANGES.find((x) => x.key === range)
    const end = points.at(-1)?.t ?? 0
    return !r || !Number.isFinite(r.ms) ? points : points.filter((p) => p.t >= end - r.ms)
  }, [points, range])
  const n = view.length

  // With flows, the agent's own performance is its value less the money the owner moved: that is what the drawdown
  // and the change are measured on, so a withdrawal is never a fall.
  const netted = points.some((p) => p.flow !== undefined)
  const perf = useCallback((p: ValuePoint) => p.value - (p.flow ?? 0), [])
  const drawdowns = useMemo(() => {
    let peak = Number.NEGATIVE_INFINITY
    return view.map((p) => {
      peak = Math.max(peak, perf(p))
      return peak > 0 ? ((perf(p) - peak) / peak) * 100 : 0
    })
  }, [view, perf])
  const maxDd = Math.min(0, ...drawdowns)

  const w = Math.max(width, 260)
  const x0 = PAD.left
  const x1 = w - PAD.right
  const innerBottom = height - PAD.bottom
  const ddH = (innerBottom - PAD.top) * DD_SHARE
  const valueBottom = innerBottom - ddH - GAP
  const ddTop = innerBottom - ddH
  const tFirst = view[0]?.t ?? 0
  const tLast = view.at(-1)?.t ?? 1
  const cx = useCallback(
    (t: number) => x0 + ((t - tFirst) / (tLast - tFirst || 1)) * (x1 - x0),
    [x1, tFirst, tLast],
  )

  const [lo, hi] = useMemo(() => {
    const vals = view.map((p) => p.value)
    if (baseline !== null) vals.push(baseline)
    const a = Math.min(...vals)
    const b = Math.max(...vals)
    const pad = (b - a) * 0.15 || Math.abs(b) * 0.02 || 1
    return [a - pad, b + pad]
  }, [view, baseline])
  const vy = useCallback(
    (v: number) => valueBottom - ((v - lo) / (hi - lo || 1)) * (valueBottom - PAD.top),
    [lo, hi, valueBottom],
  )
  const dy = useCallback(
    (v: number) => ddTop + (Math.abs(v) / Math.max(0.01, Math.abs(maxDd))) * ddH,
    [ddTop, ddH, maxDd],
  )

  const line = useMemo(() => monotone(view.map((p) => ({ x: cx(p.t), y: vy(p.value) }))), [view, cx, vy])
  const area = n > 1 ? `${line}L${cx(tLast)},${valueBottom}L${cx(tFirst)},${valueBottom}Z` : ''
  const ddLine = useMemo(
    () => monotone(view.map((p, i) => ({ x: cx(p.t), y: dy(drawdowns[i] ?? 0) }))),
    [view, cx, dy, drawdowns],
  )
  const ddArea = n > 1 ? `${ddLine}L${cx(tLast)},${ddTop}L${cx(tFirst)},${ddTop}Z` : ''
  const earlierEnd = view.filter((p) => p.earlier).at(-1)?.t

  const active = view[hover ?? n - 1]
  // Net: what the agent did since the first point in view, over what was at work (the start plus money added).
  const first = view[0]
  const added = active && first ? Math.max(0, (active.flow ?? 0) - (first.flow ?? 0)) : 0
  const change = netted
    ? active && first
      ? perf(active) - perf(first)
      : null
    : active && baseline
      ? active.value - baseline
      : null
  const changeBase = netted ? (first ? first.value + added : 0) : (baseline ?? 0)
  const changePct = change !== null && changeBase > 0 ? (change / changeBase) * 100 : null
  const up = (change ?? 0) >= 0
  const tone = up ? 'var(--profit)' : 'var(--loss)'
  const ticks = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15]

  const onMove = (clientX: number) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box || n === 0) return
    const t =
      tFirst +
      ((clientX - box.left - x0 * (box.width / w)) / ((x1 - x0) * (box.width / w))) * (tLast - tFirst)
    let best = 0
    for (let i = 1; i < n; i++)
      if (Math.abs((view[i]?.t ?? 0) - t) < Math.abs((view[best]?.t ?? 0) - t)) best = i
    setHover(best)
  }

  if (points.length < 2) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border border-dashed border-border text-center">
        <p className="text-sm text-foreground/80">{c.emptyTitle}</p>
        <p className="max-w-xs text-xs text-muted-foreground">{c.empty}</p>
      </div>
    )
  }

  return (
    <div ref={wrap} className="flex w-full flex-col">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="font-[family-name:var(--font-data)] text-[22px] font-semibold tabular-nums text-foreground">
              {active ? money(active.value) : '—'}
            </span>
            {change !== null && changePct !== null && (
              <span
                className="font-[family-name:var(--font-data)] text-[12px] tabular-nums"
                style={{ color: tone }}
              >
                {up ? '+' : '−'}
                {money(Math.abs(change))} ({up ? '+' : '−'}
                {Math.abs(changePct).toFixed(2)}%)
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 font-[family-name:var(--font-data)] text-[10.5px] tabular-nums text-muted-foreground">
            <span>{active ? `${when(active.t)} ET` : ''}</span>
            {active?.earlier && <span>{c.earlier}</span>}
            <span>
              {c.belowHigh}{' '}
              <span className="text-foreground/80">{(drawdowns[hover ?? n - 1] ?? 0).toFixed(2)}%</span>
            </span>
            <span>
              {c.worst} <span className="text-foreground/80">{maxDd.toFixed(2)}%</span>
            </span>
          </div>
        </div>
        {offered.length > 1 && (
          <Segmented<RangeKey>
            size="sm"
            label={c.ranges}
            value={range}
            onChange={(v) => {
              setRange(v)
              setHover(null)
            }}
            options={offered.map((r) => ({ value: r.key, label: r.key === 'ALL' ? c.all : r.key }))}
          />
        )}
      </div>

      {/* A slider, for the keyboard: the arrow keys walk the readout above through time, like 21st's chart. */}
      <div
        className="relative w-full rounded-[var(--radius-md)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-dim)]"
        style={{ height }}
        role="slider"
        aria-label={c.aria(money(view.at(-1)?.value ?? 0), changePct === null ? null : changePct.toFixed(2))}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, n - 1)}
        aria-valuenow={hover ?? n - 1}
        aria-valuetext={active ? `${money(active.value)}, ${when(active.t)} ET` : ''}
        tabIndex={0}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n - 1) - 1))
          if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? n - 1) + 1))
        }}
      >
        {width > 0 && (
          <svg
            ref={svgRef}
            width={w}
            height={height}
            viewBox={`0 0 ${w} ${height}`}
            className="block w-full touch-pan-y select-none overflow-visible"
            aria-hidden
          >
            <defs>
              <linearGradient id={`fill-${uid}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={tone} stopOpacity="0.18" />
                <stop offset="100%" stopColor={tone} stopOpacity="0" />
              </linearGradient>
            </defs>

            {ticks.map((v) => (
              <g key={v}>
                <line
                  x1={x0}
                  x2={x1}
                  y1={vy(v)}
                  y2={vy(v)}
                  stroke="var(--color-hairline)"
                  strokeDasharray="2 4"
                />
                <text
                  x={x1 + 8}
                  y={vy(v) + 3}
                  className="fill-[var(--color-ink-muted)] font-[family-name:var(--font-data)] text-[10px]"
                >
                  {money(v)}
                </text>
              </g>
            ))}

            {earlierEnd !== undefined && earlierEnd > tFirst && (
              <g>
                <rect
                  x={x0}
                  y={PAD.top}
                  width={cx(earlierEnd) - x0}
                  height={valueBottom - PAD.top}
                  fill="var(--color-surface-2)"
                  opacity="0.5"
                />
                <text
                  x={x0 + 6}
                  y={PAD.top + 12}
                  className="fill-[var(--color-ink-muted)] font-[family-name:var(--font-data)] text-[9.5px]"
                >
                  {c.earlierBand}
                </text>
              </g>
            )}

            {baseline !== null && (
              <line
                x1={x0}
                x2={x1}
                y1={vy(baseline)}
                y2={vy(baseline)}
                stroke="var(--color-ink-muted)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            )}

            <path d={area} fill={`url(#fill-${uid})`} />
            <motion.path
              key={range}
              d={line}
              fill="none"
              stroke={tone}
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: reduced ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: reduced ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
            />

            {[...new Map(markers.map((m) => [`${m.t}-${m.kind}`, m])).values()]
              .filter((m) => m.t >= tFirst && m.t <= tLast)
              .map((m) => {
                const near = view.reduce(
                  (b, p) => (Math.abs(p.t - m.t) < Math.abs(b.t - m.t) ? p : b),
                  view[0] as ValuePoint,
                )
                const isMoney = m.kind === 'in' || m.kind === 'out'
                return (
                  <circle
                    key={`${m.t}-${m.kind}`}
                    cx={cx(m.t)}
                    cy={vy(near.value)}
                    r={isMoney ? '4.5' : '3.5'}
                    fill={isMoney ? 'var(--color-surface-1)' : MARKER_COLOR[m.kind]}
                    stroke={isMoney ? MARKER_COLOR[m.kind] : 'var(--color-surface-1)'}
                    strokeWidth={isMoney ? '2' : '1.5'}
                  >
                    {m.label && <title>{m.label}</title>}
                  </circle>
                )
              })}

            <path d={ddArea} fill="var(--loss)" opacity="0.18" />
            <path d={ddLine} fill="none" stroke="var(--loss)" strokeWidth="1" opacity="0.7" />
            <text
              x={x1 + 8}
              y={ddTop + 9}
              className="fill-[var(--color-ink-muted)] font-[family-name:var(--font-data)] text-[9.5px]"
            >
              {c.ddLabel}
            </text>

            {(
              [
                ['start', view[0]],
                ['middle', view[Math.floor(n / 2)]],
                ['end', view.at(-1)],
              ] as const
            ).map(([anchor, p]) =>
              p ? (
                <text
                  key={anchor}
                  x={cx(p.t)}
                  y={height - 6}
                  textAnchor={anchor}
                  className="fill-[var(--color-ink-muted)] font-[family-name:var(--font-data)] text-[10px]"
                >
                  {new Date(p.t).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'America/New_York',
                  })}
                </text>
              ) : null,
            )}

            {hover !== null && active && (
              <g>
                <line
                  x1={cx(active.t)}
                  x2={cx(active.t)}
                  y1={PAD.top}
                  y2={innerBottom}
                  stroke="var(--color-border-strong)"
                />
                <circle
                  cx={cx(active.t)}
                  cy={vy(active.value)}
                  r="4"
                  fill={tone}
                  stroke="var(--color-surface-1)"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {baseline !== null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 border-t border-dashed border-[var(--color-ink-muted)]" />{' '}
            {c.legendStart}
          </span>
        )}
        {(['acted', 'would', 'waited'] as const)
          .filter((k) => markers.some((m) => m.kind === k))
          .map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span
                className={cn('inline-block size-2 rounded-full')}
                style={{ background: MARKER_COLOR[k] }}
              />{' '}
              {c.legend[k]}
            </span>
          ))}
        {markers
          .filter((m) => (m.kind === 'in' || m.kind === 'out') && m.label && m.t >= tFirst && m.t <= tLast)
          .slice(-3)
          .map((m) => (
            <span key={`flow-${m.t}`} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block size-2 rounded-full border-2"
                style={{ borderColor: MARKER_COLOR[m.kind] }}
              />{' '}
              {m.label}
            </span>
          ))}
      </div>
    </div>
  )
}
