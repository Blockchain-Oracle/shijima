import { ago, deskCopy, marketsCopy } from '@desk/shared'
import { Bot, ChevronRight, Eye } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { MarketSessionChip } from '@/components/shell'
import { ErrorState } from '@/components/states'
import { SectionHeader } from '@/components/ui/section-header'
import { TokenLogo } from '@/components/ui/token-logo'
import { DeskMarks } from '@/features/markets/DeskMarks'
import { EmptyTiles } from '@/features/markets/EmptyTiles'
import { StockCard } from '@/features/markets/StockCard'
import { StrategyHero } from '@/features/markets/StrategyHero'
import { loadMarkets, type MarketsView, parseRange } from '@/lib/markets.server'
import '@/styles/kit/discover.css'

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
              <EmptyTiles
                tiles={[
                  <TokenLogo key="a" symbol="NVDA" size={26} />,
                  <TokenLogo key="b" symbol="SPY" size={26} />,
                  <TokenLogo key="c" symbol="TSLA" size={26} />,
                ]}
                title={marketsCopy.empty}
              />
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
              <EmptyTiles
                tiles={[<Bot key="a" />, <Eye key="b" />, <Bot key="c" />]}
                title={sec.watch.none}
              />
            ) : (
              <div className="dc-desks">
                {view.desks.map((d) => (
                  <Link
                    key={d.id}
                    href={`/agents/${d.shareSlug}` as Route}
                    className="dc-desk"
                    data-cursor="hover"
                  >
                    <span className="dc-avatar" aria-hidden="true">
                      {(d.name ?? 'A').trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="dc-desk-body">
                      <span className="dc-desk-name">
                        <span>{d.name ?? 'An agent'}</span>
                        <span className="dc-tag">{deskCopy.modes[d.mode]}</span>
                      </span>
                      <p>{deskCopy.modeNote[d.mode]}</p>
                      {d.startedAt && (
                        <span className="dc-time">{marketsCopy.running(ago(d.startedAt))}</span>
                      )}
                    </span>
                    <ChevronRight className="dc-chev" aria-hidden="true" />
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
