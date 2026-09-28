import { ago, appCopy, CASH_LOOK, comparedTo, deskCopy, lookOf, usd } from '@desk/shared'
import { ChevronDown } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { CountUp } from '@/components/ui/count-up'
import { Sparkline } from '@/components/ui/sparkline'
import { TokenLogo } from '@/components/ui/token-logo'
import { chartPoints, flowMarkers } from '@/features/desk/chart-points'
import { MARKER_KIND } from '@/features/desk/DeskPanels'
import { HoldingFlags } from '@/features/desk/HoldingsPanel'
import { type ChartMarker, PortfolioChart } from '@/features/desk/PortfolioChart'
import type { DeskView } from '@/lib/desk.server'
import { EmptyFan } from './EmptyFan'

const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`

/**
 * Everything the agent holds, in one module: the value and how it moved since the money went in, the chart,
 * then one row per holding against its target that opens in place to its price, source and flags. It replaces
 * four blocks that each told part of this ("What it holds", Value, Allocation and Holdings).
 */
export function Portfolio({ view }: { view: DeskView }) {
  const c = appCopy.agentPage.portfolio
  const p = view.plate
  if (!p) {
    return (
      <section className="ap-card ap-portfolio" aria-label={c.title}>
        <p className="ap-label">{c.title}</p>
        <EmptyFan
          symbols={view.mandate?.targets.map((t) => t.symbol) ?? []}
          title={deskCopy.plate.title}
          body={c.notYet}
        />
      </section>
    )
  }
  const total = BigInt(p.totalUsdg)
  const base = p.baselineUsdg ? BigInt(p.baselineUsdg) : null

  const points = chartPoints(view)
  const markers: ChartMarker[] = [
    ...view.markers.flatMap((m) => {
      const kind = MARKER_KIND[m.outcome]
      return kind ? [{ t: new Date(m.at).getTime(), kind }] : []
    }),
    ...flowMarkers(view),
  ]
  const drift = view.mandate?.driftToleranceBps ?? 300
  const cash = BigInt(p.cashUsdg) + BigInt(p.vaultUsdg)
  const now = new Date()
  const h = deskCopy.holdings
  // One scale for every bar in the card, so a 14% target reads as the same length on every row.
  const widest = Math.max(
    1,
    p.cashBps,
    view.mandate?.cashTargetBps ?? 0,
    ...view.holdings.flatMap((r) => [r.weightBps, r.targetBps]),
  )

  return (
    <section className="ap-card ap-portfolio" aria-label={c.title}>
      <header className="ap-portfolio-head">
        <p className="ap-label">{c.title}</p>
        <span className="ap-portfolio-meta">
          <span>{c.valued(ago(new Date(p.takenAt)))}</span>
        </span>
      </header>

      {points.length > 1 ? (
        <PortfolioChart
          points={points}
          baseline={base !== null ? Number(base) / 1e6 : null}
          markers={markers}
          height={240}
        />
      ) : (
        // One valuation: the chart has nothing to draw, so the value stands on its own.
        <div className="ap-value">
          <span className="ap-value-num">
            <CountUp value={Number(total) / 1e6} />
          </span>
          <p className="ap-muted">{c.noHistory}</p>
        </div>
      )}

      <div className="ap-alloc-legend" aria-hidden="true">
        <span>
          <i className="is-now" />
          {c.legendNow}
        </span>
        <span>
          <i className="is-target" />
          {c.legendTarget}
        </span>
      </div>
      <ul className="ap-holdings" aria-label={c.holdings}>
        {view.holdings.map((row) => {
          const off = row.weightBps - row.targetBps
          const drifted = Math.abs(off) >= drift
          return (
            <li key={row.symbol}>
              <details className="ap-holding">
                <summary>
                  <TokenLogo symbol={row.symbol} size={32} />
                  <span className="ap-holding-name">
                    <span className="ap-holding-line">
                      <strong>{row.name}</strong>
                      <small className="ap-holding-sym">{row.symbol}</small>
                    </span>
                    <Alloc
                      label={c.barLabel(row.name, pct(row.weightBps), pct(row.targetBps))}
                      now={row.weightBps}
                      target={row.targetBps}
                      widest={widest}
                      color={lookOf(row.symbol).color}
                    >
                      <b>{pct(row.weightBps)}</b> / {pct(row.targetBps)}
                      {drifted && (
                        <em className="ap-drift">{off > 0 ? h.over(pct(off)) : h.under(pct(-off))}</em>
                      )}
                    </Alloc>
                  </span>
                  <Sparkline values={row.spark} width={64} height={22} className="ap-holding-spark" />
                  <span className="ap-holding-value">{usd(BigInt(row.valueUsdg))}</span>
                  <ChevronDown aria-hidden="true" className="ap-holding-chev size-4" />
                </summary>
                <div className="ap-holding-more">
                  <p>
                    {row.amount} {row.symbol}
                  </p>
                  <p>
                    {row.price ? h.priceNow(row.price.value, ago(new Date(row.price.at), now)) : h.noPrice}
                    {row.reference
                      ? ` · ${h.referenceIs(row.reference.value, h.referenceKinds[row.reference.kind] ?? row.reference.kind)}`
                      : ''}
                    {row.gapBps !== null ? ` · ${h.gap(comparedTo(row.gapBps))}` : ''}
                  </p>
                  <HoldingFlags flags={row.flags} owner={view.isOwner} />
                  <Link href={`/stock/${row.symbol}` as Route} className="ap-open">
                    {c.stockPage(row.symbol)} →
                  </Link>
                </div>
              </details>
            </li>
          )
        })}
        <li>
          <div className="ap-holding ap-holding--cash">
            <div className="ap-holding-row">
              <TokenLogo symbol="USDG" size={32} />
              <span className="ap-holding-name">
                <span className="ap-holding-line">
                  <strong>{c.cash}</strong>
                  {BigInt(p.vaultUsdg) > 0n && (
                    <small className="ap-holding-sym">{c.inSavings(usd(BigInt(p.vaultUsdg)))}</small>
                  )}
                </span>
                <Alloc
                  label={c.barLabel(
                    c.cash,
                    pct(p.cashBps),
                    view.mandate ? pct(view.mandate.cashTargetBps) : pct(p.cashBps),
                  )}
                  now={p.cashBps}
                  target={view.mandate?.cashTargetBps ?? null}
                  widest={widest}
                  color={CASH_LOOK.color}
                >
                  <b>{pct(p.cashBps)}</b>
                  {view.mandate ? ` / ${pct(view.mandate.cashTargetBps)}` : ''}
                </Alloc>
              </span>
              <span className="ap-holding-value">{usd(cash)}</span>
            </div>
          </div>
        </li>
      </ul>
    </section>
  )
}

/**
 * A holding against its target, the Plan tab's bar (.pl-bar) with a tick where the target sits: the fill is what
 * it holds now, the tick is what the plan asks for, so "under" and "over" read without numbers.
 */
function Alloc({
  label,
  now,
  target,
  widest,
  color,
  children,
}: {
  label: string
  now: number
  target: number | null
  widest: number
  color: string
  children: ReactNode
}) {
  return (
    <span className="ap-alloc">
      <span className="ap-alloc-track" role="img" aria-label={label}>
        <span
          className="ap-alloc-fill"
          style={{ width: `${Math.min(100, (now / widest) * 100)}%`, background: color }}
        />
        {target !== null && (
          <i className="ap-alloc-tick" style={{ left: `${Math.min(99, (target / widest) * 100)}%` }} />
        )}
      </span>
      <small className="ap-alloc-nums">{children}</small>
    </span>
  )
}
