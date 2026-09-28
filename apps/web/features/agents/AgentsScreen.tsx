import { appCopy, CASH_LOOK, deskCopy, lookOf } from '@desk/shared'
import { Copy, Eye, Plus } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { LiveBadge } from '@/components/shell/app/LiveBadge'
import { AllocationDonut, type DonutSlice } from '@/components/ui/allocation-donut'
import { StatusDot } from '@/components/ui/desk-kit'
import { Sparkline } from '@/components/ui/sparkline'
import { TokenLogo, TokenStack } from '@/components/ui/token-logo'
import { When } from '@/components/when'
import type { PublicAgent } from '@/lib/agents.server'
import type { OverviewAgent } from '@/lib/overview.server'
import { cn } from '@/lib/utils'
import './agents.css'

const usd = (raw: string | null) =>
  raw === null
    ? '—'
    : `$${(Number(raw) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const signedPct = (bps: number) => `${bps > 0 ? '+' : ''}${(bps / 100).toFixed(2)}%`

/**
 * Agents: the owner's own on top, then every shared agent as a ranked card (21st's Leaderboard Card, 13053, laid out
 * as a grid), live-first: its rank, mode and whether it is running; its basket as a donut with the real logos; what
 * it holds in mono with the day's change and a sparkline; its latest decision in its own words; its graded record
 * and followers; then the copy fee and Copy when its owner allows copying. With no shared agent, a designed empty
 * state after 21st's Empty State (1435).
 * With no agent of their own, the owner meets 21st's Empty State with Marquee (19377): the live agents drifting past
 * behind the two ways in, create or copy. The owner's own agents are cards after 21st's Stats cards with links
 * (4402): logos, mode, value and change, and the latest decision in a line, with a dashed card to make another.
 */
export function AgentsScreen({
  mine,
  signedIn,
  live,
}: {
  mine: OverviewAgent[]
  signedIn: boolean
  live: PublicAgent[]
}) {
  const c = appCopy.agents
  return (
    <div className="app-container">
      <header className="ov-head">
        <div>
          <p className="ov-kicker">{c.kicker}</p>
          <h1 className="ov-title">{c.title}</h1>
          <p className="ag-intro">{c.intro}</p>
        </div>
        <LiveBadge />
      </header>

      {signedIn && (
        <section className="ag-section" aria-labelledby="ag-yours">
          <h2 id="ag-yours" className="ov-section-title">
            {c.yours}
          </h2>
          {mine.length === 0 ? (
            <div className="ag-empty">
              <div className="ag-empty-marquee" aria-hidden="true">
                <div className="ag-empty-track">
                  {(['a', 'b', 'c'] as const).flatMap((round) =>
                    live.slice(0, 4).map((a) => (
                      <span key={`${round}-${a.id}`} className="ag-empty-pill">
                        <TokenStack symbols={a.symbols.length ? a.symbols : ['CASH']} size={18} max={3} />
                        {a.name}
                      </span>
                    )),
                  )}
                </div>
              </div>
              <div className="ag-empty-body">
                <h3>{c.none.title}</h3>
                <p>{c.none.body}</p>
                <div className="ov-empty-actions">
                  <Link href="/agents/new" className="btn-primary ov-btn">
                    <Plus aria-hidden="true" className="size-4" /> {c.none.create}
                  </Link>
                  <a href="#live" className="btn-secondary ov-btn">
                    <Copy aria-hidden="true" className="size-4" /> {c.none.copy}
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="ag-mine ag-mine--rich">
              {mine.map((a) => (
                <Link key={a.id} href={`/agents/${a.slug}` as Route} className="ag-card">
                  <span className="ag-card-top">
                    <TokenStack symbols={a.symbols.length ? a.symbols : ['USDG']} size={28} max={4} />
                    <StatusDot tone={a.mode === 'shadow' ? 'practice' : 'live'}>
                      {deskCopy.modes[a.mode]}
                    </StatusDot>
                  </span>
                  <span className="ag-card-name">{a.name}</span>
                  <span className="ag-card-value">
                    <strong>{usd(a.valueUsdg)}</strong>
                    {a.changeBps !== null && a.changeBps !== 0 && (
                      <span className={a.changeBps > 0 ? 'is-up' : 'is-down'}>{signedPct(a.changeBps)}</span>
                    )}
                  </span>
                  <span className="ag-card-latest">
                    {a.needsYou > 0 ? (
                      <em>{c.needsYou(a.needsYou)}</em>
                    ) : a.latest ? (
                      <>
                        <TokenLogo symbol={a.latest.symbol ?? 'USDG'} size={16} />
                        <span>{a.latest.summary}</span>
                      </>
                    ) : (
                      <span>{c.noDecision}</span>
                    )}
                  </span>
                </Link>
              ))}
              <Link href="/agents/new" className="ag-card ag-card--new">
                <span className="ag-card-plus" aria-hidden="true">
                  <Plus className="size-5" />
                </span>
                <span className="ag-card-name">{c.newAgent}</span>
                <span className="ag-card-latest">{c.newAgentBody}</span>
              </Link>
            </div>
          )}
        </section>
      )}

      <section id="live" className="ag-section" aria-labelledby="ag-live">
        <h2 id="ag-live" className="ov-section-title">
          {c.live}
        </h2>
        {live.length === 0 ? (
          <div className="ag-none">
            <div className="ag-none-fan" aria-hidden="true">
              {['SPY', 'NVDA', 'AAPL'].map((sym) => (
                <span key={sym} className="ag-none-tile">
                  <TokenLogo symbol={sym} size={26} />
                </span>
              ))}
            </div>
            <h3>{c.emptyShared.title}</h3>
            <p>{c.emptyShared.body}</p>
            <Link href="/agents/new" className="btn-primary ov-btn">
              <Plus aria-hidden="true" className="size-4" /> {c.emptyShared.create}
            </Link>
          </div>
        ) : (
          <ol className="ag-grid">
            {live.map((a, i) => {
              const slices: DonutSlice[] = [
                ...a.weights.map((w) => ({
                  symbol: w.symbol,
                  label: w.symbol,
                  pct: w.weightBps / 100,
                  color: lookOf(w.symbol).color,
                })),
                ...(a.cashBps > 0
                  ? [{ symbol: 'CASH', label: c.cash, pct: a.cashBps / 100, color: CASH_LOOK.color }]
                  : []),
              ]
              const up = a.dayBps !== null && a.dayBps > 0
              const down = a.dayBps !== null && a.dayBps < 0
              return (
                <li key={a.id} className="ag-tile">
                  <header className="ag-tile-head">
                    <span className="ag-tile-rank">{c.rank(i + 1)}</span>
                    <StatusDot tone={a.mode === 'shadow' ? 'practice' : 'live'}>
                      {a.mode === 'shadow' ? c.practice : c.liveMode}
                    </StatusDot>
                    <span className="ag-tile-run" data-on={a.running ? 'true' : undefined}>
                      <i aria-hidden="true" />
                      {a.running ? c.looking : c.notRunning}
                    </span>
                  </header>

                  <Link href={`/agents/${a.slug}` as Route} className="ag-tile-who">
                    <AllocationDonut
                      slices={slices}
                      size={64}
                      thickness={8}
                      center={String(a.weights.length)}
                    />
                    <span className="ag-tile-name">
                      <strong>{a.name}</strong>
                      <span className="ag-tile-basket">
                        <TokenStack symbols={a.symbols.length ? a.symbols : ['USDG']} size={20} max={5} />
                        <small>{c.stocks(a.weights.length)}</small>
                      </span>
                    </span>
                  </Link>

                  <div className="ag-tile-perf">
                    <div className="ag-tile-value">
                      <span className="ag-tile-label">{c.holds}</span>
                      <strong className="ag-tile-amount">{usd(a.valueUsdg)}</strong>
                      {a.dayBps !== null && (
                        <em className={cn(up && 'is-up', down && 'is-down')}>
                          {signedPct(a.dayBps)} <small>{c.day}</small>
                        </em>
                      )}
                    </div>
                    {a.spark.length > 1 && (
                      <Sparkline values={a.spark} width={132} height={40} className="ag-tile-spark" />
                    )}
                  </div>

                  <div className="ag-tile-latest">
                    {a.latest ? (
                      <>
                        <TokenLogo symbol={a.latest.symbol ?? 'USDG'} size={20} />
                        <span className="ag-tile-latest-text">{a.latest.summary}</span>
                        <span className="ag-tile-latest-when">
                          <When at={a.latest.at} />
                        </span>
                      </>
                    ) : (
                      <span className="ag-tile-latest-text">{c.noDecision}</span>
                    )}
                  </div>

                  <div className="ag-tile-record" title={c.recordTitle}>
                    <span>{c.record(a.better, a.graded)}</span>
                    <span>{c.followers(a.followers)}</span>
                  </div>

                  <footer className="ag-tile-foot">
                    <span className="ag-tile-fee">
                      {a.copyable
                        ? BigInt(a.copyFeeUsdg) > 0n
                          ? c.fee(usd(a.copyFeeUsdg))
                          : c.free
                        : c.closedToCopy}
                    </span>
                    <span className="ag-tile-cta">
                      <Link href={`/agents/${a.slug}` as Route} className="btn-secondary ov-btn-sm">
                        <Eye aria-hidden="true" className="size-3.5" /> {c.watch}
                      </Link>
                      {a.copyable && (
                        <Link href={`/agents/${a.slug}?copy=1` as Route} className="btn-primary ov-btn-sm">
                          <Copy aria-hidden="true" className="size-3.5" /> {c.copy}
                        </Link>
                      )}
                    </span>
                  </footer>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
