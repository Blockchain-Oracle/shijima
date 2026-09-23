import { ago, appCopy, CASH_LOOK, comparedTo, deskCopy, lookOf, usd } from '@desk/shared'
import { ChevronDown } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { Countdown, CountUp } from '@/components/ui/count-up'
import { Sparkline } from '@/components/ui/sparkline'
import { TokenLogo } from '@/components/ui/token-logo'
import { chartPoints, flowMarkers } from '@/features/desk/chart-points'
import { MARKER_KIND } from '@/features/desk/DeskPanels'
import { HoldingFlags } from '@/features/desk/HoldingsPanel'
import { type ChartMarker, PortfolioChart } from '@/features/desk/PortfolioChart'
import type { DeskView } from '@/lib/desk.server'

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
        <p className="ap-muted">{c.notYet}</p>
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
  const running = view.desk.state === 'active' && view.desk.lifecycle === 'running'
  const now = new Date()
  const h = deskCopy.holdings

  return (
    <section className="ap-card ap-portfolio" aria-label={c.title}>
      <header className="ap-portfolio-head">
        <p className="ap-label">{c.title}</p>
        <span className="ap-portfolio-meta">
          {running && (
            <span className="ap-next">
              <span className="ap-next-dot" aria-hidden />
              <Countdown to={view.desk.nextCheckAt} />
            </span>
          )}
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

      <ul className="ap-holdings" aria-label={c.holdings}>
        {view.holdings.map((row) => {
          const off = row.weightBps - row.targetBps
          const drifted = Math.abs(off) >= drift
          return (
            <li key={row.symbol}>
              <details className="ap-holding">
                <summary>
                  <TokenLogo symbol={row.symbol} size={28} />
                  <span className="ap-holding-name">
                    <strong>{row.name}</strong>
                    <small>
                      {pct(row.weightBps)} · {h.target(pct(row.targetBps))}
                      {drifted && (
                        <em className="ap-drift">
                          {' · '}
                          {off > 0 ? h.over(pct(off)) : h.under(pct(-off))}
                        </em>
                      )}
                    </small>
                  </span>
                  <Sparkline values={row.spark} width={64} height={22} className="ap-holding-spark" />
                  <span className="ap-holding-value">{usd(BigInt(row.valueUsdg))}</span>
                  <ChevronDown aria-hidden="true" className="ap-holding-chev size-4" />
                </summary>
                <span className="ap-bar" aria-hidden="true">
                  <span
                    style={{
                      width: `${Math.min(100, row.weightBps / 100)}%`,
                      background: lookOf(row.symbol).color,
                    }}
                  />
                  <i style={{ left: `${Math.min(99.5, row.targetBps / 100)}%` }} />
                </span>
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
              <TokenLogo symbol="CASH" size={28} />
              <span className="ap-holding-name">
                <strong>{c.cash}</strong>
                <small>
                  {pct(p.cashBps)}
                  {view.mandate ? ` · ${h.target(pct(view.mandate.cashTargetBps))}` : ''}
                  {BigInt(p.vaultUsdg) > 0n ? ` · ${c.inSavings(usd(BigInt(p.vaultUsdg)))}` : ''}
                </small>
              </span>
              <span className="ap-holding-value">{usd(cash)}</span>
            </div>
            <span className="ap-bar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, p.cashBps / 100)}%`, background: CASH_LOOK.color }} />
              {view.mandate && <i style={{ left: `${Math.min(99.5, view.mandate.cashTargetBps / 100)}%` }} />}
            </span>
          </div>
        </li>
      </ul>
    </section>
  )
}
