import { directionOf } from '@desk/core'
import { ago, marketsCopy, newYorkTime, stockCopy } from '@desk/shared'
import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { MarketSessionChip } from '@/components/shell'
import { EmptyState } from '@/components/states'
import { SectionHeader } from '@/components/ui/section-header'
import { DeskMarks } from '@/features/markets/DeskMarks'
import { AssetDisc, FUNDS } from '@/features/markets/marks'
import { PriceAlerts } from '@/features/markets/PriceAlerts'
import { PriceChart } from '@/features/markets/PriceChart'
import { SessionClock } from '@/features/markets/SessionClock'
import { AskAbout } from '@/features/markets/StrategyHero'
import { bySymbol, loadStock, parseRange, RANGES, type Range } from '@/lib/markets.server'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ symbol: string }>
  searchParams: Promise<{ r?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const token = bySymbol((await params).symbol)
  return { title: token ? `${token.displayName} (${token.symbol})` : undefined }
}

/** "Sep 20, 20:20 New York": a history row needs the day, not only the weekday. */
const nyDateTime = (at: Date) =>
  `${at.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} New York`

const usd = (v: number | null) => (v === null ? stockCopy.dash : `$${v.toFixed(2)}`)
const pct = (bps: number) => `${(bps / 100).toFixed(2)}%`

/**
 * One Stock Token, in Agari's ticker hub (`/tickers/[symbol]`): the frame of its news page and the profile's figure
 * bar. What is on it is ours: the pool's price and its reference with their ages, the gap, what trading costs, the
 * chart with what shared desks did marked, price alerts, the multiplier's history, what desks decided, and the
 * company's report dates. `/stock/<SYMBOL>` is the one spelling; any other case redirects to it.
 */
export default async function StockPage({ params, searchParams }: Props) {
  const { symbol } = await params
  const upper = symbol.toUpperCase()
  if (!bySymbol(upper)) notFound()
  if (symbol !== upper) redirect(`/stock/${upper}` as Route)
  const range = parseRange((await searchParams).r)
  const view = await loadStock(upper, range)
  if (!view) notFound()
  const { token, now: t } = view
  const fund = FUNDS.has(token.symbol)
  const s = stockCopy.sections
  const can = !view.viewer.address ? 'signedOut' : !view.viewer.desk ? 'noDesk' : 'ok'

  return (
    <div className="container news-page prf-page tkh-page">
      <div className="news-inner">
        <div className="news-live tkh-live">
          <span className="news-live-label">{stockCopy.eyebrow(fund)}</span>
          <MarketSessionChip />
          <Link href="/markets" className="tkh-link type-caption" data-cursor="hover">
            ← {stockCopy.back}
          </Link>
        </div>
        <h1 className="news-title tkh-title">
          <AssetDisc symbol={token.symbol} className="tkh-mark" />
          <span>
            {token.displayName} <span className="vermilion">${token.symbol}</span>
          </span>
        </h1>
        <div className="page-title-jp" lang="ja">
          {stockCopy.headingJp}
        </div>
        <p className="news-intro">{stockCopy.intro(token.displayName)}</p>

        <div className="prf-bar">
          <dl className="prf-stats">
            <div className="prf-stat">
              <dt>{stockCopy.stats.price}</dt>
              <dd className="big numbers">{usd(t?.price ?? null)}</dd>
              <dd className="sj-stat-note">{t ? stockCopy.priceAge(ago(t.at)) : stockCopy.dash}</dd>
            </div>
            <div className="prf-stat">
              <dt>{stockCopy.stats.reference}</dt>
              <dd className="big numbers">{usd(t?.reference ?? null)}</dd>
              <dd className="sj-stat-note">
                {t?.referenceKind === 'last_regular_close' && t.referenceAt
                  ? stockCopy.referenceWhen(newYorkTime(t.referenceAt))
                  : t?.officialAt
                    ? stockCopy.referenceOfficial(ago(t.officialAt))
                    : stockCopy.dash}
              </dd>
            </div>
            <div className="prf-stat">
              <dt>{stockCopy.stats.gap}</dt>
              <dd
                className={cn(
                  'big numbers',
                  t?.gapBps != null &&
                    Math.abs(t.gapBps) >= 50 &&
                    (t.gapBps > 0 ? 'text-profit' : 'text-loss'),
                )}
              >
                {t?.gapBps == null ? stockCopy.dash : marketsCopy.gap(t.gapBps)}
              </dd>
              <dd className="sj-stat-note">
                {t?.gapBps == null ? stockCopy.dash : marketsCopy.fromReference(t.gapBps)}
              </dd>
            </div>
            <div className="prf-stat">
              <dt>{stockCopy.stats.cost}</dt>
              <dd className="big numbers">{t?.costBps1000 == null ? stockCopy.dash : pct(t.costBps1000)}</dd>
              <dd className="sj-stat-note">
                {t?.costBps100 == null ? stockCopy.dash : stockCopy.costSmall(pct(t.costBps100))}
              </dd>
            </div>
            <div className="prf-stat">
              <dt>{stockCopy.stats.report}</dt>
              <dd className="big sj-stat-text">
                {fund ? stockCopy.fundReport : (view.nextReport ?? stockCopy.noReport)}
              </dd>
            </div>
          </dl>
          <div className="prf-actions">
            <AskAbout viewer={view.viewer} question={stockCopy.askQuestion(token.displayName)} />
            <Link href="/start" className="tkh-link type-caption" data-cursor="hover">
              {stockCopy.startWith} →
            </Link>
          </div>
        </div>

        <section className="sj-stock-section" aria-label={stockCopy.chartTitle}>
          <div className="hero-chart sj-stock-chart" data-asset={token.symbol}>
            <div className="hero-chart-head">
              <div className="min-w-0">
                <div className="mh-asset-row">
                  <AssetDisc symbol={token.symbol} className="mh-asset-badge" />
                  <span className="mh-asset-label">{stockCopy.chartTitle}</span>
                  <nav className="mh-cadence-tabs" aria-label={marketsCopy.hero.rangeLabel}>
                    {(Object.keys(RANGES) as Range[]).map((key) => (
                      <Link
                        key={key}
                        href={`/stock/${token.symbol}?r=${key}` as Route}
                        scroll={false}
                        className="mh-cadence"
                        aria-current={key === range ? 'true' : undefined}
                        data-cursor="hover"
                      >
                        {key}
                        {key === range && <span aria-hidden className="mh-cadence-underline" />}
                      </Link>
                    ))}
                  </nav>
                </div>
              </div>
              <SessionClock />
            </div>
            <div className="hero-chart-canvas">
              <div className="mh-chart-fill">
                {view.points.length >= 2 ? (
                  <PriceChart
                    points={view.points}
                    marks={view.marks}
                    referenceLabel={marketsCopy.hero.legendReference}
                    ariaLabel={`${token.displayName}: ${stockCopy.chartTitle}`}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-6">
                    <EmptyState why={marketsCopy.hero.noHistory} />
                  </div>
                )}
              </div>
            </div>
            <div className="hero-chart-foot sj-hero-foot">
              <p className="sj-caption">{view.caption}</p>
            </div>
          </div>
          {view.stale && t && (
            <p className="mt-3 type-caption text-warning">{marketsCopy.stale(ago(t.at))}</p>
          )}
        </section>

        <section className="sj-stock-section" aria-label={s.alerts.title}>
          <SectionHeader index={s.alerts.index} title={s.alerts.title} desc={s.alerts.desc} />
          <div className="mt-4">
            <PriceAlerts
              symbol={token.symbol}
              name={token.displayName}
              gapBps={t?.gapBps ?? null}
              can={can}
              alerts={view.alerts.map((a) => ({
                id: a.id,
                status: a.status,
                direction: directionOf(a.kind),
                thresholdBps: a.thresholdBps,
                firedAt: a.firedAt?.toISOString() ?? null,
                firedGapBps: a.firedGapBps,
              }))}
            />
          </div>
        </section>

        <section className="sj-stock-section" aria-label={s.multiplier.title}>
          <SectionHeader index={s.multiplier.index} title={s.multiplier.title} desc={s.multiplier.desc} />
          <p className="mt-4 type-body text-ink">{s.multiplier.now(view.multiplier.now)}</p>
          {view.multiplier.pending && (
            <p className="type-caption text-ink-secondary">
              {s.multiplier.pending(view.multiplier.pending.to, nyDateTime(view.multiplier.pending.at))}
            </p>
          )}
          {view.multiplier.changes.length === 0 ? (
            <p className="mt-2 type-caption text-ink-muted">{s.multiplier.none}</p>
          ) : (
            <ul className="sj-rows mt-3">
              {view.multiplier.changes.map((c) => (
                <li key={c.at.toISOString()}>
                  <span className="sj-row-when">{nyDateTime(c.at)}</span>
                  <span className="sj-row-what">{s.multiplier.change(c.pct, c.kind)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sj-stock-section" aria-label={s.decisions.title}>
          <SectionHeader index={s.decisions.index} title={s.decisions.title} desc={s.decisions.desc} />
          <div className="mt-4">
            <DeskMarks marks={view.decisions} empty={s.decisions.none} />
          </div>
        </section>

        <section className="sj-stock-section" aria-label={s.events.title}>
          <SectionHeader index={s.events.index} title={s.events.title} desc={s.events.desc} />
          {fund ? (
            <p className="mt-4 type-caption text-ink-muted">{s.events.fund}</p>
          ) : view.events.length === 0 ? (
            <p className="mt-4 type-caption text-ink-muted">{s.events.none}</p>
          ) : (
            <ul className="sj-rows mt-3">
              {view.events.map((e) => (
                <li key={e.date}>
                  <span className="sj-row-when">{e.when}</span>
                  <span className="sj-row-what">{e.label}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
