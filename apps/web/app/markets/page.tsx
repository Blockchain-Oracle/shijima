import { ago, deskCopy, marketsCopy } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { MarketSessionChip } from '@/components/shell'
import { ErrorState } from '@/components/states'
import { SectionHeader } from '@/components/ui/section-header'
import { DeskMarks } from '@/features/markets/DeskMarks'
import { StockCard } from '@/features/markets/StockCard'
import { StrategyHero } from '@/features/markets/StrategyHero'
import { Tutorial } from '@/features/onboarding/Tutorial'
import { loadMarkets, type MarketsView, parseRange } from '@/lib/markets.server'

export const dynamic = 'force-dynamic'
export const metadata = { title: marketsCopy.kicker }

/**
 * Masayume opens on its markets, and so do we: prices moving, a chart for each, and nothing to bet on. A strategy
 * leads, with its chart against its reference and what shared desks did marked on it. Below are the ten Stock
 * Tokens as cards, what desks did in words, and the desks anyone can watch. The strategy and the period are in
 * the address, so a view can be shared.
 */
export default async function Markets({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; r?: string }>
}) {
  const { s, r } = await searchParams
  let view: MarketsView
  try {
    view = await loadMarkets(s, parseRange(r))
  } catch (e) {
    return (
      <div className="container py-12">
        <ErrorState
          diagnosis={{ kind: 'desk-unreachable', technical: e instanceof Error ? e.message : String(e) }}
        />
      </div>
    )
  }
  const sec = marketsCopy.sections
  return (
    <>
      <Tutorial weekendFact={view.weekendFact} signedIn={Boolean(view.viewer.address)} />
      <StrategyHero strategy={view.strategy} range={view.range} asOf={view.asOf} viewer={view.viewer} />
      <div className="markets-main">
        <div className="container">
          {view.stale && view.asOf && (
            <p className="mt-6 type-caption text-warning">{marketsCopy.stale(ago(view.asOf))}</p>
          )}

          <section className="markets-section flex flex-col gap-4" aria-label={sec.tokens.title}>
            <SectionHeader
              index={sec.tokens.index}
              title={sec.tokens.title}
              desc={sec.tokens.desc}
              aside={<MarketSessionChip />}
            />
            {view.tokens.length === 0 ? (
              <p className="type-body text-ink-secondary">{marketsCopy.empty}</p>
            ) : (
              <div className="markets-grid markets-grid-live">
                {view.tokens.map((t) => (
                  <StockCard key={t.symbol} token={t} points={view.sparks[t.symbol] ?? []} />
                ))}
              </div>
            )}
            <p className="max-w-2xl type-caption text-ink-muted">{marketsCopy.footnote}</p>
          </section>

          <section className="markets-section flex flex-col gap-4" aria-label={sec.desks.title}>
            <SectionHeader index={sec.desks.index} title={sec.desks.title} desc={sec.desks.desc} />
            <DeskMarks marks={view.marks.slice(0, 12)} empty={sec.desks.none} />
          </section>

          <section className="markets-section flex flex-col gap-4" aria-label={sec.watch.title}>
            <SectionHeader index={sec.watch.index} title={sec.watch.title} />
            {view.desks.length === 0 ? (
              <p className="type-body text-ink-secondary">{sec.watch.none}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {view.desks.map((d) => (
                  <Link
                    key={d.id}
                    href={`/agents/${d.shareSlug}` as Route}
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
      </div>
    </>
  )
}
