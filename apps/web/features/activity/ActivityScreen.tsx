import { appCopy, marketsCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { Answer } from '@/components/answer'
import { Pill, Screen, ScreenTitle, StatusPill, type TxStatus } from '@/components/kit'
import { TokenLogo } from '@/components/ui/token-logo'
import { When } from '@/components/when'
import { MoneyEmpty, StatGrid } from '@/features/money/MoneyParts'

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

const TRADED = new Set(['acted', 'acted_in_part', 'acted_by_override'])

/** Each decision's outcome as the reference's status pill: done trades are green, the rest quiet. */
function statusOf(r: ActivityRow): { status: TxStatus; label: string } {
  const label = (marketsCopy.outcomes[r.outcome] ?? r.outcome).toUpperCase()
  if (r.shadow) return { status: 'confirmed', label: `${label} · PRACTICE` }
  if (TRADED.has(r.outcome)) return { status: 'done', label }
  if (r.outcome === 'failed' || r.outcome === 'blocked') return { status: 'failed', label }
  return { status: 'confirmed', label }
}

/**
 * Activity, as the reference wallet lists it (apps/web/src/wallet/ActivityScreen.tsx): a title with its pill, the
 * counts as 21st's Stats Grid (29195), tabs, then one bordered feed after 21st's Audit Log With Icon Tiles (28483).
 * Each row: the stock's real logo in its tile, the agent with a BUY/SELL tag, what it did, when, and on the right
 * its status and the way to open it. Requests that wait on you are answered right in their row. Nothing yet is
 * 21st's Empty State (1435), with real logos in its tiles.
 */
export function ActivityScreen({
  tab,
  rows,
  needs,
  agents,
}: {
  tab: 'all' | 'needs' | 'trades'
  rows: ActivityRow[]
  needs: NeedRow[]
  /** How many agents the owner has: with none, the empty state offers to create one. */
  agents: number
}) {
  const c = appCopy.activity
  const trades = rows.filter((r) => TRADED.has(r.outcome) && !r.shadow)
  const practice = rows.filter((r) => r.shadow).length
  const shown = tab === 'trades' ? trades : rows
  const tabs = [
    { key: 'all', label: c.tabs.all, count: null },
    { key: 'needs', label: c.tabs.needs, count: needs.length > 0 ? needs.length : null },
    { key: 'trades', label: c.tabs.trades, count: null },
  ] as const

  const empty = tab === 'needs' ? needs.length === 0 : shown.length === 0
  const n = (v: number) => v.toLocaleString('en-US')

  return (
    <Screen width={1024} gap={18}>
      <ScreenTitle
        title={c.title}
        sub={c.sub}
        right={
          <Pill
            label={needs.length > 0 ? c.waiting(needs.length) : c.upToDate}
            tone={needs.length > 0 ? 'warn' : 'pos'}
            dot
            pulse={needs.length > 0}
          />
        }
      />

      <StatGrid
        label={c.title}
        cells={[
          { key: 'decisions', value: n(rows.length), label: c.stats.decisions, note: c.stats.decisionsNote },
          {
            key: 'trades',
            value: n(trades.length),
            label: c.stats.trades,
            note: c.stats.tradesNote,
            ...(trades.length > 0 ? { tone: 'pos' as const } : {}),
          },
          { key: 'practice', value: n(practice), label: c.stats.practice, note: c.stats.practiceNote },
          {
            key: 'needs',
            value: n(needs.length),
            label: c.stats.needs,
            note: c.stats.needsNote,
            ...(needs.length > 0 ? { tone: 'warn' as const } : {}),
          },
        ]}
      />

      <nav aria-label={c.title} className="mn-tabs">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={(t.key === 'all' ? '/activity' : `/activity?tab=${t.key}`) as Route}
            aria-current={tab === t.key ? 'page' : undefined}
          >
            {t.label}
            {t.count !== null ? <b>{t.count}</b> : null}
          </Link>
        ))}
      </nav>

      {empty ? (
        <MoneyEmpty
          marks={
            tab === 'trades'
              ? [{ token: 'NVDA' }, { token: 'USDG' }, { token: 'AAPL' }]
              : [{ token: 'USDG' }, { chain: 4663 }, { token: 'SPY' }]
          }
          title={c.emptyTitles[tab]}
          body={c.emptyBodies[tab]}
        >
          {tab === 'all' ? (
            agents === 0 ? (
              <Link href={'/agents/new' as Route} className="mn-btn" data-primary>
                {c.emptyCta}
              </Link>
            ) : null
          ) : (
            <Link href={'/activity' as Route} className="mn-btn">
              {c.emptyAll}
            </Link>
          )}
        </MoneyEmpty>
      ) : (
        <div className="mn-feed">
          {tab === 'needs'
            ? needs.map((r) => (
                <div key={r.approvalId} className="mn-feed-row">
                  <span className="mn-feed-mark">
                    <TokenLogo symbol={r.symbol ?? 'CASH'} size={30} />
                  </span>
                  <div className="mn-feed-body">
                    <div className="mn-feed-title">
                      <span className="mn-feed-name">{r.agent.name}</span>
                      <StatusPill status="pending" label={c.tabs.needs.toUpperCase()} />
                    </div>
                    <div className="mn-feed-text">{r.summary}</div>
                    <div style={{ marginTop: 8 }}>
                      <Answer deskId={r.agent.id} approvalId={r.approvalId} expiresAt={r.expiresAt} />
                    </div>
                  </div>
                  <div className="mn-feed-right">
                    <span className="mn-feed-meta">
                      <When at={r.createdAt} />
                    </span>
                  </div>
                </div>
              ))
            : shown.map((r) => {
                const s = statusOf(r)
                const side = r.side ? c.sides[r.side] : undefined
                return (
                  <div key={`${r.agent.id}-${r.seq}`} className="mn-feed-row">
                    <span className="mn-feed-mark">
                      <TokenLogo symbol={r.symbol ?? 'CASH'} size={30} />
                    </span>
                    <div className="mn-feed-body">
                      <div className="mn-feed-title">
                        <span className="mn-feed-name">{r.agent.name}</span>
                        {side && r.symbol ? (
                          <span className="mn-side" data-side={r.side}>
                            {side} {r.symbol}
                          </span>
                        ) : null}
                      </div>
                      <div className="mn-feed-text" title={r.summary}>
                        {r.summary}
                      </div>
                      <div className="mn-feed-meta">
                        <When at={r.at} /> · #{r.seq}
                      </div>
                    </div>
                    <div className="mn-feed-right">
                      <StatusPill status={s.status} label={s.label} />
                      <Link href={`/agents/${r.agent.slug}/decision/${r.seq}` as Route}>{c.open} ↗</Link>
                    </div>
                  </div>
                )
              })}
        </div>
      )}
    </Screen>
  )
}
