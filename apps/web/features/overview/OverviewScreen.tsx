import { appCopy, deskCopy } from '@desk/shared'
import { ArrowRight, Bell, Copy, Plus, Send, Workflow } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { LiveBadge } from '@/components/shell/app/LiveBadge'
import { StatusDot } from '@/components/ui/desk-kit'
import { TokenLogo, TokenStack } from '@/components/ui/token-logo'
import { When } from '@/components/when'
import { PortfolioChart } from '@/features/desk/PortfolioChart'
import { GiftCard } from '@/features/gift/GiftCard'
import type { Overview, OverviewAgent } from '@/lib/overview.server'
import { cn } from '@/lib/utils'

const usd = (raw: string | null) =>
  raw === null
    ? null
    : `$${(Number(raw) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const signedUsd = (raw: string) => {
  const n = Number(raw) / 1e6
  return `${n >= 0 ? '+' : '−'}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function tone(a: OverviewAgent) {
  if (a.needsYou > 0) return 'warn' as const
  if (a.state !== 'active') return 'stopped' as const
  return a.mode === 'shadow' ? ('practice' as const) : ('live' as const)
}

/**
 * The Overview, on 21st's Stocks Dashboard (29424): three stat cards, then what the agents hold together, then
 * each agent with its latest real decision beside what waits on the owner and how they are connected.
 */
export function OverviewScreen({ overview: o }: { overview: Overview }) {
  const c = appCopy.overview

  if (o.agents.length === 0) {
    return (
      <div className="app-container">
        <header className="ov-head">
          <div>
            <p className="ov-kicker">{c.kicker}</p>
            <h1 className="ov-title">{c.title}</h1>
          </div>
          <LiveBadge />
        </header>
        <section className="ov-empty">
          <h2>{c.empty.title}</h2>
          <p>{c.empty.body}</p>
          <div className="ov-empty-actions">
            <Link href="/agents/new" className="btn-primary ov-btn">
              <Plus aria-hidden="true" className="size-4" /> {c.empty.create}
            </Link>
            <Link href="/agents" className="btn-secondary ov-btn">
              <Copy aria-hidden="true" className="size-4" /> {c.empty.copy}
            </Link>
          </div>
        </section>
        <GiftCard className="ov-gift" />
      </div>
    )
  }

  const trading = o.agents.filter((a) => a.mode !== 'shadow').length
  const practice = o.agents.length - trading
  const day = o.dayChangeUsdg === null ? null : Number(o.dayChangeUsdg)

  return (
    <div className="app-container">
      <header className="ov-head">
        <div>
          <p className="ov-kicker">{c.kicker}</p>
          <h1 className="ov-title">{c.title}</h1>
        </div>
        <LiveBadge />
      </header>

      <section className="ov-stats" aria-label={c.title}>
        <div className="ov-stat">
          <span className="ov-stat-label">{c.stats.total}</span>
          <strong className="ov-stat-value">{usd(o.totalUsdg) ?? c.stats.totalNone}</strong>
          <span
            className={cn('ov-stat-note', day !== null && (day > 0 ? 'is-up' : day < 0 ? 'is-down' : ''))}
          >
            {o.dayChangeUsdg === null
              ? c.stats.dayNone
              : `${signedUsd(o.dayChangeUsdg)} ${c.stats.day.toLowerCase()}`}
          </span>
        </div>
        <div className="ov-stat">
          <span className="ov-stat-label">{c.stats.agents}</span>
          <strong className="ov-stat-value">{o.agents.length}</strong>
          <span className="ov-stat-note">{c.stats.agentsNote(trading, practice)}</span>
        </div>
        <Link
          href={'/activity?tab=needs' as Route}
          className={cn('ov-stat', o.needs.length > 0 && 'is-alert')}
        >
          <span className="ov-stat-label">{c.stats.needs}</span>
          <strong className="ov-stat-value">{o.needs.length}</strong>
          <span className="ov-stat-note">
            {o.needs.length === 0 ? c.stats.needsNone : c.stats.needsSome(o.needs.length)}
          </span>
        </Link>
      </section>

      {o.combined.length > 1 && (
        <section className="ov-card ov-chart">
          <div className="ov-card-head">
            <h2>{c.chart}</h2>
            <p>{c.chartNote}</p>
          </div>
          <PortfolioChart points={o.combined} baseline={o.combined[0]?.value ?? null} height={220} />
        </section>
      )}

      <div className="ov-grid">
        <section className="ov-agents" aria-labelledby="ov-agents">
          <h2 id="ov-agents" className="ov-section-title">
            {c.agentsTitle}
          </h2>
          {o.agents.map((a) => (
            <Link key={a.id} href={`/agents/${a.slug}` as Route} className="ov-agent">
              <div className="ov-agent-top">
                <TokenStack symbols={a.symbols.length > 0 ? a.symbols : ['CASH']} size={26} max={4} />
                <div className="ov-agent-name">
                  <strong>{a.name}</strong>
                  <StatusDot tone={tone(a)}>{deskCopy.modes[a.mode]}</StatusDot>
                </div>
                <div className="ov-agent-money">
                  <strong>{usd(a.valueUsdg) ?? appCopy.sidebar.noValue}</strong>
                  {a.changeBps !== null && (
                    <span className={a.changeBps > 0 ? 'is-up' : a.changeBps < 0 ? 'is-down' : ''}>
                      {a.changeBps > 0 ? '+' : ''}
                      {(a.changeBps / 100).toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
              {a.latest ? (
                <div className="ov-agent-latest">
                  {a.latest.symbol && <TokenLogo symbol={a.latest.symbol} size={18} />}
                  <p>{a.latest.summary}</p>
                  <span className="ov-agent-when">
                    <When at={a.latest.at} />
                  </span>
                </div>
              ) : (
                <p className="ov-agent-none">{c.noDecision}</p>
              )}
              <span className="ov-agent-open">
                {c.open} <ArrowRight aria-hidden="true" className="size-3.5" />
              </span>
            </Link>
          ))}
        </section>

        <aside className="ov-side">
          <GiftCard />
          <section className="ov-card" aria-labelledby="ov-needs">
            <div className="ov-card-head">
              <h2 id="ov-needs">
                <Bell aria-hidden="true" className="size-4" /> {c.needsTitle}
              </h2>
            </div>
            {o.needs.length === 0 ? (
              <p className="ov-muted">{c.needsEmpty}</p>
            ) : (
              <ul className="ov-needs">
                {o.needs.slice(0, 5).map((n) => (
                  <li key={`${n.agentSlug}-${n.seq}`}>
                    <div>
                      <span className="ov-needs-agent">{n.agentName}</span>
                      <p>{n.summary}</p>
                    </div>
                    <Link
                      href={`/agents/${n.agentSlug}/decision/${n.seq}` as Route}
                      className="btn-primary ov-btn-sm"
                    >
                      {c.answer}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ov-card" aria-labelledby="ov-connect">
            <div className="ov-card-head">
              <h2 id="ov-connect">{c.connectTitle}</h2>
              <p>{c.connectBody}</p>
            </div>
            <Link href={'/settings#connections' as Route} className="ov-connect-row">
              <Send aria-hidden="true" className="size-4" />
              <span>{c.telegram}</span>
              <span className={cn('ov-connect-state', o.telegramLinked > 0 && 'is-on')}>
                {o.telegramLinked > 0 ? `✓ ${c.connected}` : `${c.notConnected} →`}
              </span>
            </Link>
            <Link href={'/settings#connections' as Route} className="ov-connect-row">
              <Workflow aria-hidden="true" className="size-4" />
              <span>{c.openserv}</span>
              <span className={cn('ov-connect-state', o.openservLinked > 0 && 'is-on')}>
                {o.openservLinked > 0 ? `✓ ${c.connected}` : `${c.notConnected} →`}
              </span>
            </Link>
          </section>
        </aside>
      </div>
    </div>
  )
}
