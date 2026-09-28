import { APPROVED_TOKENS } from '@desk/chain'
import { currentMandate, deskRecord, groupQuietRuns, mandateFromRow, type RecordFilter } from '@desk/db'
import { recordPageCopy as c, recordPagesCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isOutcome, outcomeLabel } from '@/components/outcome'
import { TokenLogo, TokenStack } from '@/components/ui/token-logo'
import { RecordTimeline, type TimelineItem } from '@/features/desk/RecordTimeline'
import { db } from '@/lib/db'
import { deskForViewer } from '@/lib/desk.server'
import { cn } from '@/lib/utils'

/** The outcomes worth a chip. Every other outcome is still listed; these are the ones people look for. */
const OUTCOME_CHIPS = [
  'acted',
  'would_have_acted',
  'waited',
  'declined',
  'blocked_by_limit',
  'failed',
] as const
const symbolOf = new Map(APPROVED_TOKENS.map((t) => [t.address.toLowerCase(), t.symbol]))

function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href as Route}
      aria-current={on ? 'true' : undefined}
      scroll={false}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors',
        on
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-wash)] text-foreground'
          : 'border-border text-muted-foreground hover:border-[var(--color-border-strong)] hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}

export const dynamic = 'force-dynamic'

const PAGE = 60
const DAY = /^\d{4}-\d{2}-\d{2}$/

type Params = { outcome?: string; token?: string; live?: string; from?: string; to?: string; before?: string }

/** The filters as the page understands them [8.10]: outcome, token, dates, practice or live. */
function filterFrom(
  q: Params,
): RecordFilter & { symbol?: string | undefined; live: 'all' | 'live' | 'practice' } {
  const token = APPROVED_TOKENS.find((t) => t.symbol === q.token)
  const live = q.live === 'live' || q.live === 'practice' ? q.live : 'all'
  return {
    outcome: q.outcome && isOutcome(q.outcome) ? q.outcome : undefined,
    token: token?.address.toLowerCase(),
    symbol: token?.symbol,
    shadow: live === 'all' ? undefined : live === 'practice',
    live,
    from: q.from && DAY.test(q.from) ? new Date(`${q.from}T00:00:00Z`) : undefined,
    to: q.to && DAY.test(q.to) ? new Date(`${q.to}T00:00:00Z`) : undefined,
  }
}

/**
 * The product's signature screen: every check the desk ever made, newest first, including the many that found
 * nothing to do. Those are the proof it was awake and honest, so they are never hidden, but a run of them
 * folds into one line that can be opened.
 */
export const metadata = { title: 'Every decision' }

export default async function RecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Params>
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const resolved = await deskForViewer(slug)
  if (!resolved) notFound()
  const { face: desk, isOwner } = resolved
  const filter = filterFrom(query)
  const filtered = Boolean(
    filter.outcome || filter.token || filter.shadow !== undefined || filter.from || filter.to,
  )

  const [decisions, mandateRow] = await Promise.all([
    deskRecord(db(), desk.id, {
      limit: PAGE,
      before: query.before ? Number(query.before) : undefined,
      outcome: filter.outcome,
      token: filter.token,
      shadow: filter.shadow,
      from: filter.from,
      to: filter.to,
    }),
    currentMandate(db(), desk.id),
  ])
  // The agent's own stocks first, with their logos; every other Stock Token folds under one chip.
  const planned = new Set(
    (mandateRow ? mandateFromRow(mandateRow).targets.tokens : []).map((t) => t.token.toLowerCase()),
  )
  const inPlan = APPROVED_TOKENS.filter((t) => planned.has(t.address.toLowerCase()))
  const others = APPROVED_TOKENS.filter((t) => !planned.has(t.address.toLowerCase()))
  const rows = groupQuietRuns(decisions)
  const oldest = decisions.at(-1)
  const keep = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (k !== 'before' && v) keep.set(k, v)
  /** This page's address with one filter changed, and paging reset. */
  const withFilter = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(keep)
    if (value === undefined) next.delete(key)
    else next.set(key, value)
    const q = next.toString()
    return `/agents/${slug}/record${q ? `?${q}` : ''}`
  }
  const item = (d: (typeof decisions)[number]): TimelineItem => ({
    id: `d${d.seq}`,
    kind: 'decision',
    at: d.decidedAt.getTime(),
    outcome: d.outcome,
    shadow: d.shadow,
    summary: `#${d.seq} · ${d.summary ?? ''}`,
    href: `/agents/${slug}/decision/${d.seq}`,
    symbol: d.token ? symbolOf.get(d.token.toLowerCase()) : undefined,
  })
  const items: TimelineItem[] = rows.map((row) =>
    row.kind === 'entry'
      ? item(row.decision)
      : {
          id: `q${row.decisions[0]?.seq ?? row.from.getTime()}`,
          kind: 'quiet',
          at: row.to.getTime(),
          count: row.count,
          label: c.quietRun(row.count),
          children: row.decisions.map(item),
        },
  )
  const older = oldest
    ? `/agents/${slug}/record?${new URLSearchParams({ ...Object.fromEntries(keep), before: String(oldest.seq) })}`
    : null

  return (
    <div className="container desk-page">
      <header className="desk-hero">
        <Link href={`/agents/${slug}` as Route} className="type-caption text-accent hover:underline">
          {recordPagesCopy.back(desk.name)}
        </Link>
        <h1 className="type-headline text-ink">{c.title}</h1>
        <p className="type-caption text-ink-secondary">{c.intro}</p>
        {!isOwner && <p className="type-caption text-ink-muted">{recordPagesCopy.visitor}</p>}
      </header>

      <section className="desk-panel" aria-label={c.filters.title}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Chip href={withFilter('outcome', undefined)} on={!filter.outcome}>
              {c.filters.anyOutcome}
            </Chip>
            {OUTCOME_CHIPS.map((o) => (
              <Chip key={o} href={withFilter('outcome', o)} on={filter.outcome === o}>
                {outcomeLabel(o)}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip href={withFilter('token', undefined)} on={!filter.symbol}>
              {c.filters.anyToken}
            </Chip>
            {inPlan.map((t) => (
              <Chip key={t.symbol} href={withFilter('token', t.symbol)} on={filter.symbol === t.symbol}>
                <TokenLogo symbol={t.symbol} size={18} />
                {t.symbol}
              </Chip>
            ))}
            {others.length > 0 && (
              <details className="[&[open]]:basis-full" open={others.some((t) => t.symbol === filter.symbol)}>
                <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-full border border-dashed border-border px-3 text-[12.5px] text-muted-foreground hover:text-foreground">
                  <TokenStack symbols={others.map((t) => t.symbol)} size={16} max={3} />
                  {c.filters.others}
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {others.map((t) => (
                    <Chip key={t.symbol} href={withFilter('token', t.symbol)} on={filter.symbol === t.symbol}>
                      <TokenLogo symbol={t.symbol} size={18} />
                      {t.symbol}
                    </Chip>
                  ))}
                </div>
              </details>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'live', 'practice'] as const).map((v) => (
              <Chip key={v} href={withFilter('live', v === 'all' ? undefined : v)} on={filter.live === v}>
                {c.filters.live[v]}
              </Chip>
            ))}
            <details className="group">
              <summary className="inline-flex h-8 cursor-pointer list-none items-center rounded-full border border-dashed border-border px-3 text-[12.5px] text-muted-foreground hover:text-foreground">
                {filter.from || filter.to ? c.filters.datesSet : c.filters.dates}
              </summary>
              <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
                {[...keep.entries()]
                  .filter(([k]) => k !== 'from' && k !== 'to')
                  .map(([k, v]) => (
                    <input key={k} type="hidden" name={k} value={v} />
                  ))}
                <label className="desk-field">
                  <span className="type-caption text-ink-muted">{c.filters.from}</span>
                  <input
                    type="date"
                    name="from"
                    defaultValue={query.from && DAY.test(query.from) ? query.from : ''}
                  />
                </label>
                <label className="desk-field">
                  <span className="type-caption text-ink-muted">{c.filters.to}</span>
                  <input
                    type="date"
                    name="to"
                    defaultValue={query.to && DAY.test(query.to) ? query.to : ''}
                  />
                </label>
                <button type="submit" className="desk-control" data-cursor="hover">
                  {c.filters.apply}
                </button>
              </form>
            </details>
            {filtered && (
              <Link
                href={`/agents/${slug}/record` as Route}
                className="ml-1 type-caption text-ink-secondary hover:text-ink"
              >
                {c.filters.clear}
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="desk-panel">
        {decisions.length === 0 ? (
          <p className="type-body text-ink-secondary">{filtered ? c.emptyFiltered : c.empty}</p>
        ) : (
          <RecordTimeline items={items} empty={c.empty} earlier={null} />
        )}
        {decisions.length === PAGE && older ? (
          <Link href={older as Route} className="type-caption text-accent hover:underline">
            {c.older}
          </Link>
        ) : null}
      </section>
    </div>
  )
}
