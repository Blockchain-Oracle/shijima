import { previousWindow, type ReportWindow, reportWindow, summarise } from '@desk/core'
import { markShadowReportOpened, recordWithGrades } from '@desk/db'
import { reportCopy as c, newYorkTime, percent, recordPagesCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Outcome } from '@/components/outcome'
import { When } from '@/components/when'
import { db } from '@/lib/db'
import { deskForViewer } from '@/lib/desk.server'

export const dynamic = 'force-dynamic'

/** How many earlier stretches the list of past reports offers. */
const PAST = 8

/**
 * One report per stretch of the market being shut: what the desk decided, and how each call looks now that it
 * has reopened. Nothing is left out to make it read better. A decision that cannot be graded says so.
 */
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ at?: string }>
}) {
  const [{ slug }, { at }] = await Promise.all([params, searchParams])
  const resolved = await deskForViewer(slug)
  if (!resolved) notFound()
  const { face: desk, isOwner } = resolved
  // Reading the report is half of what going live needs, so it counts only when the OWNER reads it. A visitor
  // on a shared link never moves it.
  if (isOwner && desk.mode === 'shadow') await markShadowReportOpened(db(), desk.id)

  const now = new Date()
  const asked = at ? new Date(at) : now
  const window = reportWindow(Number.isNaN(asked.getTime()) ? now : asked)
  const rows = await recordWithGrades(db(), desk.id, window.from, window.to)
  const summary = summarise(
    rows.map((r) => ({ outcome: r.outcome, verdict: r.verdict, differenceBps: r.differenceBps })),
  )
  const judged = rows.filter((r) => r.outcome !== 'nothing_to_do')
  const past: ReportWindow[] = []
  let cursor = reportWindow(now)
  for (let i = 0; i < PAST; i++) {
    past.push(cursor)
    cursor = previousWindow(cursor)
  }

  return (
    <div className="container desk-page">
      <header className="desk-hero">
        <Link href={`/desk/${slug}` as Route} className="type-caption text-accent hover:underline">
          {recordPagesCopy.back(desk.name)}
        </Link>
        <h1 className="type-headline text-ink">{c.title}</h1>
        <p className="type-caption text-ink-secondary">
          {newYorkTime(window.from)} to {newYorkTime(window.to)} · {window.settled ? c.reopened : c.notYet}
        </p>
        {!isOwner && <p className="type-caption text-ink-muted">{recordPagesCopy.visitor}</p>}
      </header>

      <section className="desk-panel">
        <p className="type-body text-ink">{summary.sentence}</p>
        {!window.settled && judged.length > 0 ? (
          <p className="type-caption text-ink-muted">{c.pending}</p>
        ) : null}
      </section>

      {judged.length > 0 ? (
        <section className="desk-panel">
          <div className="flex flex-col gap-2">
            {judged.map((r) => (
              <div key={r.seq} className="desk-entry">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/desk/${slug}/decision/${r.seq}` as Route} className="hover:underline">
                    <Outcome outcome={r.outcome} shadow={r.shadow} />
                  </Link>
                  <span className="type-caption text-ink-muted">
                    #{r.seq} · <When at={r.decidedAt} />
                  </span>
                </div>
                <p className="type-body text-ink-secondary">{r.summary}</p>
                <p className="type-caption">
                  {r.verdict === 'better' ? (
                    <span className="text-acted">
                      {c.better(
                        capitalise(r.chosen ?? 'this'),
                        r.alternative ?? 'the alternative',
                        percent(Math.abs(r.differenceBps ?? 0), 2),
                      )}
                    </span>
                  ) : r.verdict === 'worse' ? (
                    <span className="text-blocked">
                      {c.worse(
                        capitalise(r.alternative ?? 'the alternative'),
                        percent(Math.abs(r.differenceBps ?? 0), 2),
                      )}
                    </span>
                  ) : r.verdict === 'no_real_difference' ? (
                    <span className="text-ink-secondary">{c.same}</span>
                  ) : r.verdict === 'ungradable' ? (
                    <span className="text-ink-muted">{c.ungradable}</span>
                  ) : (
                    <span className="text-ink-muted">{c.notGraded}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="desk-panel">
          <p className="type-body text-ink-secondary">{c.quietOnly}</p>
        </section>
      )}

      <section className="desk-panel">
        <h2 className="type-label-micro text-ink-muted">{c.past}</h2>
        <ul className="report-list">
          {past.map((w) => {
            const current = w.from.getTime() === window.from.getTime()
            return (
              <li key={w.from.toISOString()}>
                {current ? (
                  <span className="type-caption text-ink">
                    {newYorkTime(w.from)} · {c.thisOne}
                  </span>
                ) : (
                  <Link
                    href={`/desk/${slug}/report?at=${encodeURIComponent(w.from.toISOString())}` as Route}
                    className="type-caption text-accent hover:underline"
                  >
                    {newYorkTime(w.from)}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
