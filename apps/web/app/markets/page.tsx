import { APPROVED_TOKENS } from '@desk/chain'
import { latestPricePoints, sharedDesks } from '@desk/db'
import { ago, deskCopy, marketsCopy, newYorkTime } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { ErrorState } from '@/components/states'
import { db } from '@/lib/db'
import { err, ok, type Reading } from '@/lib/kit'

export const dynamic = 'force-dynamic'
export const metadata = { title: marketsCopy.title }

type Row = {
  symbol: string
  name: string
  price: number | null
  gapBps: number | null
  referenceKind: string | null
  referenceAt: Date | null
  officialAt: Date | null
  costBps: number | null
  halted: boolean | null
  at: Date
}

async function readRows(): Promise<Reading<Row[]>> {
  try {
    const points = await latestPricePoints(db())
    const rows = APPROVED_TOKENS.flatMap((t) => {
      const p = points.find((r) => r.token.toLowerCase() === t.address.toLowerCase())
      if (!p) return []
      return [
        {
          symbol: t.symbol,
          name: t.displayName,
          price: p.poolMidE8 === null ? null : Number(p.poolMidE8) / 1e8,
          gapBps: p.referenceE8 === null ? null : p.gapBps,
          referenceKind: p.referenceKind,
          referenceAt: p.referenceAt,
          officialAt: p.feedUpdatedAt,
          costBps: p.costBps1000,
          halted: p.halted,
          at: p.at,
        },
      ]
    })
    const newest = rows.reduce((m, r) => Math.max(m, r.at.getTime()), 0)
    // The logger writes every five minutes. Older than fifteen means it has stopped, so the prices are stale.
    return ok(rows, newest, newest > 0 && Date.now() - newest > 15 * 60 * 1000)
  } catch (e) {
    return err('desk-unreachable', e instanceof Error ? e.message : String(e))
  }
}

/**
 * The ten Stock Tokens, each price with its source and its age, and its distance from the reference. Every
 * figure is a row the price logger wrote. The charts and the strategies arrive on this page next.
 */
export default async function Markets() {
  const [reading, desks] = await Promise.all([readRows(), sharedDesks(db()).catch(() => [])])
  return (
    <div className="container py-8">
      <header className="mb-8 flex flex-col gap-2">
        <span className="type-label-micro text-ink-muted">{marketsCopy.kicker}</span>
        <h1 className="type-headline text-ink">{marketsCopy.title}</h1>
        <p className="max-w-2xl type-body text-ink-secondary">{marketsCopy.intro}</p>
      </header>
      {!reading.ok ? (
        <ErrorState diagnosis={reading.error} />
      ) : reading.value.length === 0 ? (
        <p className="type-body text-ink-secondary">{marketsCopy.empty}</p>
      ) : (
        <>
          {reading.stale && (
            <p className="mb-4 text-warning type-caption">
              {marketsCopy.stale(ago(new Date(reading.asOfMs)))}
            </p>
          )}
          <div className="overflow-x-auto rounded-lg border border-hairline">
            <table className="w-full text-left">
              <thead className="type-label-micro text-ink-muted">
                <tr className="border-hairline border-b">
                  <th className="px-4 py-3 font-medium">{marketsCopy.columns.token}</th>
                  <th className="px-4 py-3 text-right font-medium">{marketsCopy.columns.price}</th>
                  <th className="px-4 py-3 text-right font-medium">{marketsCopy.columns.gap}</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    {marketsCopy.columns.reference}
                  </th>
                  <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">
                    {marketsCopy.columns.cost}
                  </th>
                </tr>
              </thead>
              <tbody>
                {reading.value.map((r) => (
                  <tr key={r.symbol} className="border-hairline border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="type-body-strong text-ink">{r.name}</div>
                      <div className="type-caption text-ink-muted">
                        {r.symbol}
                        {r.halted ? ` · ${marketsCopy.halted}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="type-data text-ink">
                        {r.price === null ? '—' : `$${r.price.toFixed(2)}`}
                      </div>
                      <div className="type-caption text-ink-muted">{marketsCopy.priceSource(ago(r.at))}</div>
                    </td>
                    <td className="px-4 py-3 text-right type-data">
                      {r.gapBps === null ? (
                        <span className="text-ink-muted">—</span>
                      ) : Math.abs(r.gapBps) < 50 ? (
                        <span className="text-ink-secondary">{marketsCopy.inLine}</span>
                      ) : (
                        <span className={r.gapBps > 0 ? 'text-profit' : 'text-loss'}>
                          {marketsCopy.gap(r.gapBps)}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 type-caption text-ink-secondary md:table-cell">
                      {r.referenceKind === 'last_regular_close' && r.referenceAt
                        ? marketsCopy.referenceClose(newYorkTime(r.referenceAt))
                        : r.officialAt
                          ? marketsCopy.referenceOfficial(ago(r.officialAt))
                          : '—'}
                    </td>
                    <td className="hidden px-4 py-3 text-right type-data text-ink-secondary sm:table-cell">
                      {r.costBps === null ? '—' : `${(r.costBps / 100).toFixed(2)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-2xl type-caption text-ink-muted">{marketsCopy.footnote}</p>
        </>
      )}
      <section className="mt-12 flex flex-col gap-3">
        <h2 className="type-label-micro text-ink-muted">{marketsCopy.watch}</h2>
        {desks.length === 0 ? (
          <p className="type-body text-ink-secondary">{marketsCopy.noneShared}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {desks.map((d) => (
              <Link
                key={d.id}
                href={`/desk/${d.shareSlug}` as Route}
                className="desk-entry"
                data-cursor="hover"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="type-body-strong text-ink">{d.name ?? 'A desk'}</span>
                  <span className="type-caption text-ink-muted">
                    {d.startedAt ? marketsCopy.running(ago(d.startedAt)) : ''}
                  </span>
                </div>
                <p className="type-caption text-ink-secondary">
                  {deskCopy.modes[d.mode]}: {deskCopy.modeNote[d.mode]}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
