import { ago, marketsCopy, PRESETS } from '@desk/shared'
import { MessageCircle } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { MarketSessionChip } from '@/components/shell/MarketSessionChip'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  askHref,
  periodStart,
  RANGES,
  type Range,
  type StrategyView,
  type Viewer,
} from '@/lib/markets.server'
import { cn } from '@/lib/utils'
import { AssetDisc, DiscCluster } from './marks'
import { PriceChart } from './PriceChart'
import { SessionClock } from './SessionClock'

const usd = (v: number) =>
  `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`

const hrefFor = (preset: string, range: Range) => `/markets?s=${preset}&r=${range}` as Route

/** "Ask about this": the owner's own desk, with the question already typed. Signed out, it says how to get one. */
export function AskAbout({ viewer, question }: { viewer: Viewer; question: string }) {
  const href = askHref(viewer, question)
  if (!href) return <span className="type-caption text-ink-muted">{marketsCopy.signInToAsk}</span>
  return (
    <Link href={href} className="mh-room" data-cursor="hover">
      <MessageCircle className="mh-room-icon" aria-hidden />
      {marketsCopy.hero.askAbout}
    </Link>
  )
}

/**
 * Masayume's markets hero, block for block (`MarketsHero` → `HeroAssetChart`): head, canvas and foot on the left,
 * the ticket's panel on the right. The asset is a strategy, a basket of Stock Tokens. The question slot says what
 * $1,000 put in at the start of the period is worth now, the distance slot says how far the basket is from its
 * reference, and the clock counts to the US market's next change. The right panel is facts, never a ticket.
 */
export function StrategyHero({
  strategy,
  range,
  asOf,
  viewer,
}: {
  strategy: StrategyView | null
  range: Range
  asOf: Date | null
  viewer: Viewer
}) {
  const h = marketsCopy.hero
  const r = marketsCopy.rail
  return (
    <section className="page-hero markets-hero">
      <span className="crop tl" />
      <span className="crop tr" />
      <span className="crop bl" />
      <span className="crop br" />
      <div className="container">
        <div className="hero-grid hero-grid-mini">
          <div className="hero-chart" data-asset={strategy?.preset.id ?? 'none'}>
            <div className="hero-chart-head">
              <div className="min-w-0">
                <div className="mh-asset-row">
                  {strategy && <DiscCluster symbols={strategy.members.map((m) => m.symbol)} />}
                  <span className="mh-asset-label">
                    {strategy
                      ? `${strategy.preset.name} · ${h.stocks(strategy.members.length)}`
                      : h.strategiesLabel}
                  </span>
                  <nav className="mh-cadence-tabs" aria-label={h.rangeLabel}>
                    {(Object.keys(RANGES) as Range[]).map((key) => (
                      <Link
                        key={key}
                        href={hrefFor(strategy?.preset.id ?? '', key)}
                        scroll={false}
                        className="mh-cadence"
                        aria-current={key === range ? 'true' : undefined}
                        data-cursor="hover"
                      >
                        {h.ranges[key]}
                        {key === range && <span aria-hidden className="mh-cadence-underline" />}
                      </Link>
                    ))}
                  </nav>
                  <MarketSessionChip />
                </div>
                {strategy?.valueNow != null && strategy.startedAt ? (
                  <>
                    <h1 className="mh-question">
                      <span className="mh-question-line">{usd(strategy.valueNow)}</span>
                    </h1>
                    <span className="pair-meta">
                      {h.worth(periodStart(range, strategy.startedAt))}
                      {asOf && <span className="meta-soft"> · {h.asOf(ago(asOf))}</span>}
                    </span>
                    <div className="mh-distance">
                      {strategy.gapBps !== null && (
                        <span
                          className={cn(
                            'mh-distance-value',
                            Math.abs(strategy.gapBps) < 50 ? '' : strategy.gapBps > 0 ? 'above' : 'below',
                          )}
                        >
                          {marketsCopy.fromReference(strategy.gapBps)}
                        </span>
                      )}
                      <span className="mh-since">
                        {h.since(
                          `${strategy.valueNow >= 1000 ? '+' : '−'}${usd(Math.abs(strategy.valueNow - 1000))}`,
                        )}
                      </span>
                    </div>
                  </>
                ) : (
                  <h1 className="mh-question">{strategy?.preset.name ?? marketsCopy.title}</h1>
                )}
              </div>
              <SessionClock />
            </div>

            <div className="mh-asset-pick">
              <nav className="asset-tabs tkp" aria-label={h.strategiesLabel}>
                {PRESETS.map((p) => (
                  <Link
                    key={p.id}
                    href={hrefFor(p.id, range)}
                    scroll={false}
                    className={cn('asset-tab', strategy?.preset.id === p.id && 'active')}
                    aria-current={strategy?.preset.id === p.id ? 'true' : undefined}
                    data-cursor="hover"
                  >
                    {p.name}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="hero-chart-canvas">
              <div className="mh-chart-fill">
                {strategy && strategy.points.length >= 2 ? (
                  <PriceChart
                    points={strategy.points}
                    marks={strategy.marks}
                    referenceLabel={h.legendReference}
                    ariaLabel={h.chartAria(strategy.preset.name)}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-6">
                    <EmptyState why={h.noHistory} />
                  </div>
                )}
              </div>
            </div>

            <div className="hero-chart-foot sj-hero-foot">
              <p className="sj-caption">{strategy?.caption}</p>
              {strategy && (
                <div className="mh-foot-actions">
                  <AskAbout viewer={viewer} question={h.askQuestion(strategy.preset.name)} />
                </div>
              )}
            </div>
          </div>

          <div className="mh-rail">
            <section aria-label={r.label} className="tk-ticket tk-ticket--rail">
              <span className="tk-amount-label">{r.label}</span>
              {strategy && (
                <>
                  <p className="type-caption text-ink-secondary">{strategy.preset.description}</p>
                  <ul className="sj-members">
                    {strategy.members.map((m) => (
                      <li key={m.symbol}>
                        <Link href={`/stock/${m.symbol}` as Route} className="sj-member" data-cursor="hover">
                          <AssetDisc symbol={m.symbol} className="glyph" />
                          <span className="sj-member-name">{m.name}</span>
                          <span className="sj-member-weight">{pct(m.weightBps)}</span>
                          <span
                            className={cn(
                              'sj-member-gap',
                              m.gapBps !== null &&
                                Math.abs(m.gapBps) >= 50 &&
                                (m.gapBps > 0 ? 'text-profit' : 'text-loss'),
                            )}
                          >
                            {m.gapBps === null ? '—' : marketsCopy.gap(m.gapBps)}
                          </span>
                        </Link>
                      </li>
                    ))}
                    <li className="sj-member sj-member-cash">
                      <span className="sj-cash-disc" aria-hidden>
                        $
                      </span>
                      <span className="sj-member-name">
                        {r.cash} <span className="text-ink-muted">· {r.cashNote}</span>
                      </span>
                      <span className="sj-member-weight">{pct(strategy.preset.cashBps)}</span>
                      <span className="sj-member-gap" />
                    </li>
                  </ul>
                  <div className="sj-rail-facts type-caption text-ink-secondary">
                    <p>
                      {strategy.costUsd === null
                        ? r.costUnknown
                        : r.cost(
                            `$${strategy.costUsd.toFixed(2)}`,
                            `${((strategy.costUsd / 500) * 100).toFixed(2)}%`,
                          )}
                    </p>
                    <p>{strategy.halted.length === 0 ? r.nothingHalted : strategy.halted.join(', ')}</p>
                    {strategy.nextReport && <p>{strategy.nextReport}</p>}
                  </div>
                  <Button render={<Link href={`/agents/new?preset=${strategy.preset.id}` as Route} />}>
                    {r.start}
                  </Button>
                  <p className="type-caption text-ink-muted">{r.notAdvice}</p>
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </section>
  )
}
