import { APPROVED_TOKENS } from '@desk/chain'
import { deskRecord, groupQuietRuns, type RecordFilter } from '@desk/db'
import { ago, recordPageCopy as c, deskCopy, recordPagesCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isOutcome, OUTCOME_KEYS, Outcome, outcomeLabel } from '@/components/outcome'
import { When } from '@/components/when'
import { db } from '@/lib/db'
import { deskForViewer } from '@/lib/desk.server'

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

  const decisions = await deskRecord(db(), desk.id, {
    limit: PAGE,
    before: query.before ? Number(query.before) : undefined,
    outcome: filter.outcome,
    token: filter.token,
    shadow: filter.shadow,
    from: filter.from,
    to: filter.to,
  })
  const rows = groupQuietRuns(decisions)
  const oldest = decisions.at(-1)
  const now = new Date()
  const keep = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (k !== 'before' && v) keep.set(k, v)
  const older = oldest
    ? `/desk/${slug}/record?${new URLSearchParams({ ...Object.fromEntries(keep), before: String(oldest.seq) })}`
    : null

  return (
    <div className="container desk-page">
      <header className="desk-hero">
        <Link href={`/desk/${slug}` as Route} className="type-caption text-accent hover:underline">
          {recordPagesCopy.back(desk.name)}
        </Link>
        <h1 className="type-headline text-ink">{c.title}</h1>
        <p className="type-caption text-ink-secondary">{c.intro}</p>
        {!isOwner && <p className="type-caption text-ink-muted">{recordPagesCopy.visitor}</p>}
      </header>

      <form method="get" className="desk-panel" aria-label={c.filters.title}>
        <h2 className="type-label-micro text-ink-muted">{c.filters.title}</h2>
        <div className="record-filters">
          <label className="desk-field">
            <span className="type-caption text-ink-muted">{c.filters.outcome}</span>
            <select name="outcome" defaultValue={filter.outcome ?? ''}>
              <option value="">{c.filters.anyOutcome}</option>
              {OUTCOME_KEYS.map((o) => (
                <option key={o} value={o}>
                  {outcomeLabel(o)}
                </option>
              ))}
            </select>
          </label>
          <label className="desk-field">
            <span className="type-caption text-ink-muted">{c.filters.token}</span>
            <select name="token" defaultValue={filter.symbol ?? ''}>
              <option value="">{c.filters.anyToken}</option>
              {APPROVED_TOKENS.map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="desk-field">
            <span className="type-caption text-ink-muted">{deskCopy.modes.shadow}</span>
            <select name="live" defaultValue={filter.live}>
              {(['all', 'live', 'practice'] as const).map((v) => (
                <option key={v} value={v}>
                  {c.filters.live[v]}
                </option>
              ))}
            </select>
          </label>
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
            <input type="date" name="to" defaultValue={query.to && DAY.test(query.to) ? query.to : ''} />
          </label>
          <div className="record-filters-actions">
            <button type="submit" className="desk-control" data-cursor="hover">
              {c.filters.apply}
            </button>
            {filtered && (
              <Link
                href={`/desk/${slug}/record` as Route}
                className="type-caption text-ink-secondary hover:text-ink"
              >
                {c.filters.clear}
              </Link>
            )}
          </div>
        </div>
      </form>

      <section className="desk-panel">
        {decisions.length === 0 ? (
          <p className="type-body text-ink-secondary">{filtered ? c.emptyFiltered : c.empty}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row) =>
              row.kind === 'entry' ? (
                <Link
                  key={row.decision.id}
                  href={`/desk/${slug}/decision/${row.decision.seq}` as Route}
                  className="desk-entry"
                  data-cursor="hover"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <Outcome outcome={row.decision.outcome} shadow={row.decision.shadow} />
                    <span className="type-caption text-ink-muted">
                      #{row.decision.seq} · {ago(row.decision.decidedAt, now)}
                    </span>
                  </div>
                  <p className="type-body text-ink-secondary">{row.decision.summary}</p>
                </Link>
              ) : (
                <details key={`quiet-${row.decisions[0]?.id}`} className="desk-quiet">
                  <summary className="type-caption text-ink-muted">
                    {row.count} checks, nothing new · <When at={row.from} /> to <When at={row.to} />
                  </summary>
                  <div className="mt-2 flex flex-col gap-1">
                    {row.decisions.map((d) => (
                      <Link
                        key={d.id}
                        href={`/desk/${slug}/decision/${d.seq}` as Route}
                        className="flex items-baseline justify-between gap-3 type-caption text-ink-secondary hover:text-ink"
                      >
                        <span>{d.summary}</span>
                        <span className="shrink-0 text-ink-muted">#{d.seq}</span>
                      </Link>
                    ))}
                  </div>
                </details>
              ),
            )}
          </div>
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
