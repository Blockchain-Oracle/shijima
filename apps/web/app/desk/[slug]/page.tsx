import { deskByShareSlug, deskRecord, type PublicDesk, valueHistory } from '@desk/db'
import { ago, engineCopy, marketClock, money, newYorkTime, nextRegularOpen, percent } from '@desk/shared'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Outcome } from '@/components/outcome'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const MODES: Record<PublicDesk['mode'], string> = {
  shadow: 'Practice',
  ask_first: 'Ask first',
  on_its_own: 'On its own',
}

/** What a holding looked like in the newest record. The desk's own valuation, not a fresh read. */
interface Holding {
  symbol: string
  balance: string
  priceUsdg: string
  valueUsdg: string
  weightBps: number
  targetBps: number
}

export default async function DeskPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const desk = await deskByShareSlug(db(), slug)
  if (!desk) notFound()

  const [recent, history] = await Promise.all([
    deskRecord(db(), desk.id, { limit: 6 }),
    valueHistory(db(), desk.id, 2),
  ])
  const newest = recent[0]
  const body = newest?.record as
    | { valuation?: { totalUsdg: string; cashUsdg: string; holdings: Holding[] } }
    | undefined
  const valuation = body?.valuation
  const now = new Date()
  const clock = marketClock(now)

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">{desk.name ?? 'A desk'}</h1>
        <p className="text-ink-soft text-sm">
          {MODES[desk.mode]} · {engineCopy.deskState[desk.state]} ·{' '}
          {desk.mode === 'shadow' ? 'spending nothing' : 'trading its own account'}
        </p>
      </header>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="font-medium text-ink-soft text-sm">Is everything okay?</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-ink-faint text-xs">Market right now</dt>
            <dd className="text-sm">
              {clock.session === 'regular' ? 'US market open' : 'US market closed'}
              {clock.session !== 'regular' ? (
                <span className="text-ink-soft"> · reopens {newYorkTime(nextRegularOpen(now))}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-ink-faint text-xs">Last check</dt>
            <dd className="text-sm">
              {newest ? (
                <>
                  {ago(newest.decidedAt, now)} · <Outcome outcome={newest.outcome} shadow={newest.shadow} />
                </>
              ) : (
                'It has not checked yet.'
              )}
            </dd>
          </div>
        </dl>
        {desk.stateReason ? <p className="mt-3 text-blocked text-sm">{desk.stateReason}</p> : null}
      </section>

      {valuation ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium text-ink-soft text-sm uppercase tracking-wide">What it holds</h2>
            <span className="tabular font-semibold text-lg">{money(valuation.totalUsdg)}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-ink-faint text-xs">
              <tr className="border-line border-b">
                <th className="py-2 text-left font-normal">Holding</th>
                <th className="py-2 text-right font-normal">Value</th>
                <th className="py-2 text-right font-normal">Share</th>
                <th className="py-2 text-right font-normal">Target</th>
              </tr>
            </thead>
            <tbody>
              {valuation.holdings.map((h) => (
                <tr key={h.symbol} className="border-line border-b last:border-0">
                  <td className="py-2">{h.symbol}</td>
                  <td className="tabular py-2 text-right">{money(h.valueUsdg)}</td>
                  <td className="tabular py-2 text-right">{percent(h.weightBps)}</td>
                  <td className="tabular py-2 text-right text-ink-soft">{percent(h.targetBps)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2">Cash</td>
                <td className="tabular py-2 text-right">{money(valuation.cashUsdg)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
          <p className="text-ink-faint text-xs">
            Valued on the trading pool's average price over half an hour, never on the last official update,
            which is frozen while the market is shut. {history.length > 0 ? 'Updated every check.' : ''}
          </p>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-medium text-ink-soft text-sm uppercase tracking-wide">Recent decisions</h2>
          <div className="flex gap-4">
            <Link href={`/desk/${slug}/report`} className="text-accent text-sm hover:underline">
              How it did →
            </Link>
            <Link href={`/desk/${slug}/record`} className="text-accent text-sm hover:underline">
              The whole record →
            </Link>
          </div>
        </div>
        <ul className="space-y-2">
          {recent.map((d) => (
            <li key={d.id}>
              <Link
                href={`/desk/${slug}/decision/${d.seq}`}
                className="block rounded-lg border border-line bg-surface p-3 hover:border-accent"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <Outcome outcome={d.outcome} shadow={d.shadow} />
                  <span className="text-ink-faint text-xs">{ago(d.decidedAt, now)}</span>
                </div>
                <p className="mt-1 text-ink-soft text-sm">{d.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
