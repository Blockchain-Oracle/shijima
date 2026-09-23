import { appCopy, deskCopy } from '@desk/shared'
import { Copy, Eye, Plus } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { LiveBadge } from '@/components/shell/app/LiveBadge'
import { StatusDot } from '@/components/ui/desk-kit'
import { Sparkline } from '@/components/ui/sparkline'
import { TokenLogo, TokenStack } from '@/components/ui/token-logo'
import { When } from '@/components/when'
import type { PublicAgent } from '@/lib/agents.server'
import type { OverviewAgent } from '@/lib/overview.server'
import { cn } from '@/lib/utils'

const usd = (raw: string | null) =>
  raw === null
    ? '—'
    : `$${(Number(raw) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const signedPct = (bps: number) => `${bps > 0 ? '+' : ''}${(bps / 100).toFixed(2)}%`

/**
 * Agents: the owner's own on top, then every shared agent as a board (21st's Leaderboard Rankings, 13063), ranked
 * live-first, each with its latest decision in its own words, its graded record and a way to copy it. With no
 * agent of their own, the owner meets 21st's Empty State with Marquee (19377): the live agents drifting past
 * behind the two ways in, create or copy.
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
            <div className="ag-mine">
              {mine.map((a) => (
                <Link key={a.id} href={`/agents/${a.slug}` as Route} className="ag-mine-card">
                  <TokenStack symbols={a.symbols.length ? a.symbols : ['CASH']} size={24} max={3} />
                  <span className="ag-mine-name">
                    <strong>{a.name}</strong>
                    <StatusDot tone={a.mode === 'shadow' ? 'practice' : 'live'}>
                      {deskCopy.modes[a.mode]}
                    </StatusDot>
                  </span>
                  <span className="ag-mine-value">{usd(a.valueUsdg)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <section id="live" className="ag-section" aria-labelledby="ag-live">
        <h2 id="ag-live" className="ov-section-title">
          {c.live}
        </h2>
        {live.length === 0 ? (
          <p className="ov-muted">{c.noneShared}</p>
        ) : (
          <ol className="ag-board">
            {live.map((a, i) => (
              <li key={a.id} className="ag-row">
                <span className="ag-rank">{i + 1}</span>
                <Link href={`/agents/${a.slug}` as Route} className="ag-who">
                  <TokenStack symbols={a.symbols.length ? a.symbols : ['CASH']} size={30} max={3} />
                  <span className="ag-who-text">
                    <strong>{a.name}</strong>
                    <StatusDot tone={a.mode === 'shadow' ? 'practice' : 'live'}>
                      {a.mode === 'shadow' ? c.practice : c.liveMode}
                    </StatusDot>
                  </span>
                </Link>
                <div className="ag-latest">
                  {a.latest ? (
                    <>
                      {a.latest.symbol && <TokenLogo symbol={a.latest.symbol} size={16} />}
                      <span className="ag-latest-text">{a.latest.summary}</span>
                      <span className="ag-latest-when">
                        <When at={a.latest.at} />
                      </span>
                    </>
                  ) : (
                    <span className="ov-muted">{c.noDecision}</span>
                  )}
                </div>
                <div className="ag-money">
                  <Sparkline values={a.spark} width={72} height={24} className="ag-spark" />
                  <span className="ag-money-text">
                    <strong>{usd(a.valueUsdg)}</strong>
                    {a.dayBps !== null && (
                      <span className={cn(a.dayBps > 0 ? 'is-up' : a.dayBps < 0 ? 'is-down' : '')}>
                        {signedPct(a.dayBps)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="ag-record" title={c.recordTitle}>
                  <span>{c.record(a.better, a.graded)}</span>
                  <small>{c.followers(a.followers)}</small>
                </div>
                <div className="ag-cta">
                  <Link href={`/agents/${a.slug}` as Route} className="btn-secondary ov-btn-sm">
                    <Eye aria-hidden="true" className="size-3.5" /> {c.watch}
                  </Link>
                  <Link href={`/agents/${a.slug}?copy=1` as Route} className="btn-primary ov-btn-sm">
                    <Copy aria-hidden="true" className="size-3.5" /> {c.copy}
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
