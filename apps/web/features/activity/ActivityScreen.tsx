import { appCopy, marketsCopy } from '@desk/shared'
import { ArrowUpRight, CircleDashed, CircleSlash, Clock, Hand, Zap } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { Answer } from '@/components/answer'
import { TokenLogo } from '@/components/ui/token-logo'
import { When } from '@/components/when'
import { cn } from '@/lib/utils'

interface AgentRef {
  id: string
  name: string
  slug: string
}

export interface ActivityRow {
  agent: AgentRef
  seq: number
  outcome: string
  shadow: boolean
  side: string | null
  symbol: string | null
  summary: string
  at: string
}

export interface NeedRow {
  agent: AgentRef
  approvalId: string
  seq: number
  summary: string
  symbol: string | null
  expiresAt: string
  createdAt: string
}

const ICON: Record<string, typeof Zap> = {
  acted: Zap,
  acted_in_part: Zap,
  acted_by_override: Hand,
  would_have_acted: CircleDashed,
  waited: Clock,
  declined: CircleSlash,
}

const TRADED = new Set(['acted', 'acted_in_part', 'acted_by_override'])

/**
 * Activity, on 21st's Notification Panel (27135): tabs for everything, what needs an answer and the trades,
 * each row an agent's decision with its token and time, and requests answered right in the row.
 */
export function ActivityScreen({
  tab,
  rows,
  needs,
}: {
  tab: 'all' | 'needs' | 'trades'
  rows: ActivityRow[]
  needs: NeedRow[]
}) {
  const c = appCopy.activity
  const trades = rows.filter((r) => TRADED.has(r.outcome) && !r.shadow)
  const shown = tab === 'trades' ? trades : rows
  const tabs = [
    { key: 'all', label: c.tabs.all, count: null },
    { key: 'needs', label: c.tabs.needs, count: needs.length },
    { key: 'trades', label: c.tabs.trades, count: null },
  ] as const

  return (
    <div className="app-container">
      <header className="ov-head">
        <div>
          <p className="ov-kicker">{c.kicker}</p>
          <h1 className="ov-title">{c.title}</h1>
        </div>
      </header>

      <section className="act-panel">
        <nav className="act-tabs" aria-label={c.title}>
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={(t.key === 'all' ? '/activity' : `/activity?tab=${t.key}`) as Route}
              className={cn('act-tab', tab === t.key && 'is-active')}
              aria-current={tab === t.key ? 'page' : undefined}
            >
              {t.label}
              {t.count ? <span className="app-sidebar-count">{t.count}</span> : null}
            </Link>
          ))}
        </nav>

        {tab === 'needs' ? (
          needs.length === 0 ? (
            <p className="act-empty">{c.noneNeeds}</p>
          ) : (
            <ul className="act-list">
              {needs.map((n) => (
                <li key={n.approvalId} className="act-row is-need">
                  <span className="act-mark">
                    {n.symbol ? <TokenLogo symbol={n.symbol} size={28} /> : null}
                  </span>
                  <div className="act-body">
                    <p className="act-line">
                      <strong>{n.agent.name}</strong> {n.summary}
                    </p>
                    <p className="act-meta">
                      <When at={n.createdAt} />
                    </p>
                    <div className="act-answer">
                      <Answer deskId={n.agent.id} approvalId={n.approvalId} expiresAt={n.expiresAt} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : shown.length === 0 ? (
          <p className="act-empty">{tab === 'trades' ? c.noneTrades : c.noneAll}</p>
        ) : (
          <ul className="act-list">
            {shown.map((r) => {
              const Icon = ICON[r.outcome] ?? Clock
              return (
                <li key={`${r.agent.id}-${r.seq}`}>
                  <Link href={`/agents/${r.agent.slug}/decision/${r.seq}` as Route} className="act-row">
                    <span className="act-mark">
                      {r.symbol ? (
                        <TokenLogo symbol={r.symbol} size={28} />
                      ) : (
                        <TokenLogo symbol="CASH" size={28} />
                      )}
                      <span className={cn('act-kind', TRADED.has(r.outcome) && !r.shadow && 'is-trade')}>
                        <Icon aria-hidden="true" className="size-3" />
                      </span>
                    </span>
                    <div className="act-body">
                      <p className="act-line">
                        <strong>{r.agent.name}</strong> {r.summary}
                      </p>
                      <p className="act-meta">
                        <When at={r.at} />
                        <span>· {marketsCopy.outcomes[r.outcome] ?? r.outcome}</span>
                        {r.shadow && <span className="act-chip">{c.practice}</span>}
                        <span>· #{r.seq}</span>
                      </p>
                    </div>
                    <ArrowUpRight aria-hidden="true" className="act-open size-4" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
