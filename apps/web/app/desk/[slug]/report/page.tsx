import { previousWindow, reportWindow, summarise } from '@desk/core'
import { deskByShareSlug, recordWithGrades } from '@desk/db'
import { localTime, newYorkTime, percent } from '@desk/shared'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Outcome } from '@/components/outcome'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

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
  const desk = await deskByShareSlug(db(), slug)
  if (!desk) notFound()

  const now = new Date()
  const window = reportWindow(at ? new Date(at) : now)
  const previous = previousWindow(window)
  const rows = await recordWithGrades(db(), desk.id, window.from, window.to)
  const summary = summarise(
    rows.map((r) => ({ outcome: r.outcome, verdict: r.verdict, differenceBps: r.differenceBps })),
  )
  const judged = rows.filter((r) => r.outcome !== 'nothing_to_do')

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href={`/desk/${slug}`} className="text-accent text-sm hover:underline">
          ← {desk.name ?? 'the desk'}
        </Link>
        <h1 className="font-semibold text-2xl tracking-tight">While the market was shut</h1>
        <p className="text-ink-soft text-sm">
          {newYorkTime(window.from)} to {newYorkTime(window.to)} ·{' '}
          {window.settled ? 'the market has reopened' : 'the market has not reopened yet'}
        </p>
      </header>

      <p className="rounded-lg border border-line bg-surface p-4">{summary.sentence}</p>

      {!window.settled && judged.length > 0 ? (
        <p className="text-ink-faint text-sm">
          Each of these is graded once the market reopens, against the price it would really have got then.
        </p>
      ) : null}

      {judged.length > 0 ? (
        <ul className="space-y-2">
          {judged.map((r) => (
            <li key={r.seq} className="rounded-lg border border-line bg-surface p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  href={`/desk/${slug}/decision/${r.seq}`}
                  className="font-medium text-sm hover:underline"
                >
                  <Outcome outcome={r.outcome} shadow={r.shadow} />
                </Link>
                <span className="tabular text-ink-faint text-xs">
                  #{r.seq} · {localTime(r.decidedAt)}
                </span>
              </div>
              <p className="mt-1 text-ink-soft text-sm">{r.summary}</p>
              <p className="mt-1 text-sm">
                {r.verdict === 'better' ? (
                  <span className="text-acted">
                    {capitalise(r.chosen ?? 'this')} came out better than {r.alternative} by{' '}
                    {percent(Math.abs(r.differenceBps ?? 0), 2)}.
                  </span>
                ) : r.verdict === 'worse' ? (
                  <span className="text-blocked">
                    {capitalise(r.alternative ?? 'the alternative')} would have been better by{' '}
                    {percent(Math.abs(r.differenceBps ?? 0), 2)}.
                  </span>
                ) : r.verdict === 'no_real_difference' ? (
                  <span className="text-ink-soft">
                    No real difference either way, inside the cost of trading.
                  </span>
                ) : r.verdict === 'ungradable' ? (
                  <span className="text-ink-faint">This one cannot be graded.</span>
                ) : (
                  <span className="text-ink-faint">Not graded yet.</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <Link
        href={`/desk/${slug}/report?at=${previous.from.toISOString()}`}
        className="inline-block text-accent text-sm hover:underline"
      >
        ← the stretch before this one
      </Link>
    </div>
  )
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
