import { appCopy, marketsCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Answer } from '@/components/answer'
import { Pill, Screen, ScreenTitle, StatusPill, type TxStatus } from '@/components/kit'
import { TokenLogo } from '@/components/ui/token-logo'
import { When } from '@/components/when'

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

function Row({ first, children }: { first: boolean; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 18px',
        borderTop: first ? 'none' : '1px solid var(--bd)',
      }}
    >
      {children}
    </div>
  )
}

/**
 * Activity, as the reference wallet lists it (apps/web/src/wallet/ActivityScreen.tsx): a title with its pill, one
 * line of what this is, chip filters, then one bordered panel of rows. Each row: a round mark, the agent and what
 * it did, a quiet detail line, and on the right its status and the way to open it. Requests that wait on you are
 * answered right in their row.
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
    { key: 'all', label: c.tabs.all },
    { key: 'needs', label: needs.length > 0 ? `${c.tabs.needs} · ${needs.length}` : c.tabs.needs },
    { key: 'trades', label: c.tabs.trades },
  ] as const

  const empty = tab === 'needs' ? needs.length === 0 : shown.length === 0

  return (
    <Screen width={760} gap={18}>
      <ScreenTitle
        title={c.title}
        sub={c.sub}
        right={
          <Pill
            label={needs.length > 0 ? `${needs.length} WAITING` : 'UP TO DATE'}
            tone={needs.length > 0 ? 'warn' : 'pos'}
            dot
            pulse={needs.length > 0}
          />
        }
      />

      <nav aria-label={c.title} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabs.map((t) => {
          const active = tab === t.key
          return (
            <Link
              key={t.key}
              href={(t.key === 'all' ? '/activity' : `/activity?tab=${t.key}`) as Route}
              aria-current={active ? 'page' : undefined}
              style={{
                padding: '5px 12px',
                borderRadius: 999,
                border: active ? '1px solid var(--ac)' : '1px solid var(--bd)',
                background: active ? 'color-mix(in srgb, var(--ac) 12%, transparent)' : 'transparent',
                color: active ? 'var(--tx)' : 'var(--tx2)',
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              {t.label}
            </Link>
          )
        })}
      </nav>

      {empty ? (
        <div
          style={{
            padding: 18,
            border: '1px dashed var(--bd2)',
            borderRadius: 13,
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--tx3)',
            lineHeight: 1.5,
          }}
        >
          {tab === 'needs' ? c.noneNeeds : tab === 'trades' ? c.noneTrades : c.noneAll}
        </div>
      ) : (
        <div
          style={{
            border: '1px solid var(--bd)',
            borderRadius: 16,
            background: 'var(--panel)',
            overflow: 'hidden',
          }}
        >
          {tab === 'needs'
            ? needs.map((n, i) => (
                <Row key={n.approvalId} first={i === 0}>
                  <TokenLogo symbol={n.symbol ?? 'CASH'} size={38} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                      {n.agent.name} ·{' '}
                      <span style={{ color: 'var(--warn)' }}>{c.tabs.needs.toLowerCase()}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--tx2)', marginTop: 3, lineHeight: 1.45 }}>
                      {n.summary}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <Answer deskId={n.agent.id} approvalId={n.approvalId} expiresAt={n.expiresAt} />
                    </div>
                  </div>
                  <div
                    style={{
                      alignSelf: 'flex-start',
                      fontSize: 10.5,
                      fontFamily: 'var(--fm)',
                      color: 'var(--tx3)',
                    }}
                  >
                    <When at={n.createdAt} />
                  </div>
                </Row>
              ))
            : shown.map((r, i) => {
                const s = statusOf(r)
                return (
                  <Row key={`${r.agent.id}-${r.seq}`} first={i === 0}>
                    <TokenLogo symbol={r.symbol ?? 'CASH'} size={38} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.agent.name}</div>
                      <div
                        title={r.summary}
                        style={{
                          fontSize: 12.5,
                          color: 'var(--tx2)',
                          marginTop: 3,
                          lineHeight: 1.45,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {r.summary}
                      </div>
                      <div
                        style={{ fontSize: 10.5, color: 'var(--tx3)', fontFamily: 'var(--fm)', marginTop: 4 }}
                      >
                        <When at={r.at} /> · #{r.seq}
                      </div>
                    </div>
                    <div
                      style={{
                        marginLeft: 'auto',
                        textAlign: 'right',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: 6,
                        flex: 'none',
                      }}
                    >
                      <StatusPill status={s.status} label={s.label} />
                      <Link
                        href={`/agents/${r.agent.slug}/decision/${r.seq}` as Route}
                        style={{
                          fontSize: 10.5,
                          color: 'var(--ac2)',
                          fontWeight: 700,
                          fontFamily: 'var(--fm)',
                          textDecoration: 'none',
                        }}
                      >
                        {c.open} ↗
                      </Link>
                    </div>
                  </Row>
                )
              })}
        </div>
      )}
    </Screen>
  )
}
