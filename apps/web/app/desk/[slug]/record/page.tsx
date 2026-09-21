import { deskByShareSlug, deskRecord, groupQuietRuns } from '@desk/db'
import { ago, localTime } from '@desk/shared'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Outcome } from '@/components/outcome'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

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
  searchParams: Promise<{ before?: string }>
}) {
  const [{ slug }, { before }] = await Promise.all([params, searchParams])
  const desk = await deskByShareSlug(db(), slug)
  if (!desk) notFound()

  const page = 60
  const decisions = await deskRecord(db(), desk.id, {
    limit: page,
    ...(before ? { before: Number(before) } : {}),
  })
  const rows = groupQuietRuns(decisions)
  const oldest = decisions.at(-1)
  const now = new Date()

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href={`/desk/${slug}`} className="text-accent text-sm hover:underline">
          ← {desk.name ?? 'the desk'}
        </Link>
        <h1 className="font-semibold text-2xl tracking-tight">Every decision</h1>
        <p className="text-ink-soft text-sm">
          One entry for every check, including the ones that found nothing to do.
        </p>
      </header>

      {decisions.length === 0 ? (
        <p className="text-ink-soft text-sm">Nothing recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) =>
            row.kind === 'entry' ? (
              <li key={row.decision.id}>
                <Link
                  href={`/desk/${slug}/decision/${row.decision.seq}`}
                  className="block rounded-lg border border-line bg-surface p-3 hover:border-accent"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <Outcome outcome={row.decision.outcome} shadow={row.decision.shadow} />
                    <span className="tabular text-ink-faint text-xs">
                      #{row.decision.seq} · {ago(row.decision.decidedAt, now)}
                    </span>
                  </div>
                  <p className="mt-1 text-ink-soft text-sm">{row.decision.summary}</p>
                </Link>
              </li>
            ) : (
              <li key={`quiet-${row.decisions[0]?.id}`}>
                <details className="rounded-lg border border-line border-dashed p-3">
                  <summary className="cursor-pointer text-quiet text-sm">
                    {row.count} checks, nothing new · {localTime(row.from)} to {localTime(row.to)}
                  </summary>
                  <ul className="mt-2 space-y-1 border-line border-t pt-2">
                    {row.decisions.map((d) => (
                      <li key={d.id} className="flex items-baseline justify-between gap-3 text-sm">
                        <Link
                          href={`/desk/${slug}/decision/${d.seq}`}
                          className="text-ink-soft hover:underline"
                        >
                          {d.summary}
                        </Link>
                        <span className="tabular shrink-0 text-ink-faint text-xs">#{d.seq}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ),
          )}
        </ul>
      )}

      {decisions.length === page && oldest ? (
        <Link
          href={`/desk/${slug}/record?before=${oldest.seq}`}
          className="inline-block text-accent text-sm hover:underline"
        >
          Older →
        </Link>
      ) : null}
    </div>
  )
}
