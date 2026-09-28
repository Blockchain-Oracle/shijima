import { APPROVED_TOKENS } from '@desk/chain'
import { previousWindow, type ReportWindow, reportWindow, summarise } from '@desk/core'
import { currentMandate, mandateFromRow, markShadowReportOpened, recordWithGrades } from '@desk/db'
import { CASH_LOOK, reportCopy as c, lookOf, newYorkTime, percent, recordPagesCopy } from '@desk/shared'
import { ArrowUpRight } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Outcome } from '@/components/outcome'
import { AllocationDonut, type DonutSlice } from '@/components/ui/allocation-donut'
import { TokenLogo, TokenStack } from '@/components/ui/token-logo'
import { When } from '@/components/when'
import { db } from '@/lib/db'
import { deskForViewer } from '@/lib/desk.server'
import '@/features/record/decision.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: c.meta }

const tokenOf = new Map(APPROVED_TOKENS.map((t) => [t.address.toLowerCase(), t]))

/** How many earlier stretches the list of past reports offers. */
const PAST = 8

/**
 * One report per stretch of the market being shut: what the desk decided, and how each call looks now that it
 * has reopened. Nothing is left out to make it read better. A decision that cannot be graded says so. Drawn as
 * the Plan tab is: the stretch as a line with every look on it, the grades as a donut beside bordered number
 * cells and a bar per stock, then each call with its stock's logo and its grade as a bar either side of zero.
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
  const [rows, mandateRow] = await Promise.all([
    recordWithGrades(db(), desk.id, window.from, window.to),
    currentMandate(db(), desk.id),
  ])
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

  // Whether the market has reopened since, as of now: a past report is final even when read by its own date.
  const settled = window.to.getTime() <= now.getTime()
  const token = (addr: string | null) => {
    const t = addr ? tokenOf.get(addr.toLowerCase()) : undefined
    return { symbol: t?.symbol ?? 'USDG', name: t?.displayName ?? 'Cash' }
  }
  const basket = (mandateRow ? mandateFromRow(mandateRow).targets.tokens : []).map(
    (t) => token(t.token).symbol,
  )

  // Where each look falls in the stretch, from the close (0%) to the reopen (100%).
  const span = Math.max(1, window.to.getTime() - window.from.getTime())
  const pos = (d: Date) => Math.min(100, Math.max(0, ((d.getTime() - window.from.getTime()) / span) * 100))
  const nowAt = settled ? null : pos(now)
  // Calls minutes apart would sit on one another: a cluster spreads out 20px apart, centred where it happened.
  const nudge: number[] = []
  const marks = judged.map((r) => pos(r.decidedAt))
  for (let i = 0; i < marks.length; ) {
    let j = i
    while (j + 1 < marks.length && (marks[j + 1] ?? 0) - (marks[j] ?? 0) < 3) j++
    for (let k = i; k <= j; k++) nudge[k] = (k - i - (j - i) / 2) * 20
    i = j + 1
  }

  // A call's grade as one signed number: positive when what it chose beat the alternative.
  const signed = (r: (typeof judged)[number]) =>
    r.verdict === 'better'
      ? Math.abs(r.differenceBps ?? 0)
      : r.verdict === 'worse'
        ? -Math.abs(r.differenceBps ?? 0)
        : r.verdict === 'no_real_difference'
          ? (r.differenceBps ?? 0)
          : null
  const widest = Math.max(10, ...judged.map((r) => Math.abs(signed(r) ?? 0)))
  const TONE: Record<string, string> = {
    better: 'better',
    worse: 'worse',
    no_real_difference: 'same',
    ungradable: 'none',
  }

  const verdicts: DonutSlice[] = [
    { symbol: 'better', label: c.stats.better, pct: summary.better, color: 'var(--color-profit)' },
    { symbol: 'worse', label: c.stats.worse, pct: summary.worse, color: 'var(--color-loss)' },
    { symbol: 'same', label: c.stats.same, pct: summary.noRealDifference, color: CASH_LOOK.color },
    { symbol: 'ungraded', label: c.stats.ungraded, pct: summary.ungraded, color: 'var(--color-ink-muted)' },
  ].map((v) => ({ ...v, pct: summary.decisions > 0 ? (v.pct / summary.decisions) * 100 : 0 }))

  const bySymbol = new Map<string, { name: string; calls: number; better: number; worse: number }>()
  for (const r of judged) {
    const t = token(r.token)
    const row = bySymbol.get(t.symbol) ?? { name: t.name, calls: 0, better: 0, worse: 0 }
    row.calls += 1
    if (r.verdict === 'better') row.better += 1
    if (r.verdict === 'worse') row.worse += 1
    bySymbol.set(t.symbol, row)
  }
  const stocks = [...bySymbol.entries()].sort((a, b) => b[1].calls - a[1].calls)
  const mostCalls = Math.max(1, ...stocks.map(([, v]) => v.calls))

  const stats: [string, number, string][] = [
    [c.stats.decisions, summary.decisions, ''],
    [c.stats.better, summary.better, 'better'],
    [c.stats.worse, summary.worse, 'worse'],
    [c.stats.same, summary.noRealDifference, ''],
    [c.stats.ungraded, summary.ungraded, ''],
    [c.stats.quiet, summary.quiet, ''],
  ]

  return (
    <div className="container desk-page rp-page">
      <header className="rp-head">
        <Link href={`/agents/${slug}` as Route} className="rp-back">
          {recordPagesCopy.back(desk.name)}
        </Link>
        <div className="rp-title-row">
          {basket.length > 0 && <TokenStack symbols={basket} size={36} max={4} />}
          <div className="rp-title-text">
            <span className="rp-kicker">{c.kicker}</span>
            <h1 className="rp-title">{c.title}</h1>
          </div>
          <span className="rp-state" data-settled={settled ? 'true' : undefined}>
            <span aria-hidden="true" />
            <span className="rp-state-text">{settled ? c.reopened : c.notYet}</span>
          </span>
        </div>
        {!isOwner && <p className="rp-visitor">{recordPagesCopy.visitor}</p>}
      </header>

      {/* The stretch as a line from the close to the reopen, logo markers on a track after 21st's Logo Timeline (10424). */}
      <section className="rp-card rp-window" aria-label={c.timeline}>
        <div className="rp-ends">
          <div>
            <span>{c.shut}</span>
            <b>{newYorkTime(window.from)}</b>
          </div>
          <div>
            <span>{settled ? c.reopenedAt : c.reopens}</span>
            <b>{newYorkTime(window.to)}</b>
          </div>
        </div>
        {rows.length > 0 && (
          <>
            <div className="rp-track">
              <span className="rp-track-line" aria-hidden="true" />
              {nowAt !== null && (
                <span className="rp-track-now" style={{ width: `${nowAt}%` }} aria-hidden="true" />
              )}
              {rows
                .filter((r) => r.outcome === 'nothing_to_do')
                .map((r) => (
                  <span
                    key={r.seq}
                    className="rp-tick"
                    style={{ left: `${pos(r.decidedAt)}%` }}
                    aria-hidden="true"
                  />
                ))}
              {judged.map((r, i) => (
                <Link
                  key={r.seq}
                  href={`/agents/${slug}/decision/${r.seq}` as Route}
                  className="rp-mark"
                  data-tone={r.verdict ? (TONE[r.verdict] ?? '') : ''}
                  style={{ left: `${pos(r.decidedAt)}%`, translate: `${nudge[i] ?? 0}px 0` }}
                  title={`#${r.seq} · ${r.summary ?? ''}`}
                >
                  <TokenLogo
                    symbol={token(r.token).symbol}
                    size={22}
                    title={`#${r.seq} ${token(r.token).name}`}
                  />
                </Link>
              ))}
            </div>
            <div className="rp-legend" aria-hidden="true">
              <span>
                <i className="rp-legend-tick" />
                {c.legendQuiet}
              </span>
              <span>
                <i className="rp-legend-mark" />
                {c.legendCall}
              </span>
            </div>
            <p className="rp-sentence">{summary.sentence}</p>
          </>
        )}
      </section>

      {rows.length === 0 || judged.length === 0 ? (
        <section className="rp-card rp-quiet">
          <div className="rp-fan" data-count={Math.min(3, Math.max(1, basket.length))} aria-hidden="true">
            {(basket.length > 0 ? basket : ['USDG']).slice(0, 3).map((sym) => (
              <span key={sym} className="rp-fan-tile">
                <TokenLogo symbol={sym} size={28} />
              </span>
            ))}
          </div>
          <p className="rp-quiet-title">{rows.length === 0 ? c.noneTitle : c.quietTitle}</p>
          <p className="rp-quiet-body">{rows.length === 0 ? c.noneBody : c.quietOnly}</p>
          {summary.quiet > 0 && <p className="rp-quiet-foot">{c.quietFoot(summary.quiet)}</p>}
          <Link href={`/agents/${slug}/record` as Route} className="rp-link">
            {c.everyDecision} <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
        </section>
      ) : (
        <>
          {/* How the calls came out: 21st's Sectors Donut (20086) beside Stats Grid (29195) cells, as the Plan tab. */}
          <section className="rp-card rp-overview" aria-label={c.stats.title}>
            <div className="rp-overview-donut">
              <AllocationDonut
                slices={verdicts}
                size={148}
                center={String(summary.decisions)}
                caption={c.callsCaption(summary.decisions)}
              />
            </div>
            <div className="rp-overview-main">
              <span className="rp-kicker">{c.graded}</span>
              <dl className="rp-stats">
                {stats.map(([label, n, tone]) => (
                  <div key={label} data-tone={n > 0 ? tone : ''}>
                    <dd>{n}</dd>
                    <dt>{label}</dt>
                  </div>
                ))}
              </dl>
              <ul className="rp-stocks" aria-label={c.stocks}>
                {stocks.map(([symbol, v]) => (
                  <li key={symbol}>
                    <TokenLogo symbol={symbol} size={24} />
                    <span className="rp-stock-name">
                      <b>{v.name}</b>
                      <small>{symbol}</small>
                    </span>
                    <span className="rp-stock-bar" aria-hidden="true">
                      <i
                        style={{ width: `${(v.calls / mostCalls) * 100}%`, background: lookOf(symbol).color }}
                      />
                    </span>
                    <span className="rp-stock-n">{c.callsOn(v.calls)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rp-card" aria-labelledby="rp-calls">
            <div className="rp-card-head">
              <h2 id="rp-calls" className="rp-kicker">
                {c.calls}
              </h2>
              {!settled && <p className="rp-pending">{c.pending}</p>}
            </div>
            <ol className="rp-calls">
              {judged.map((r) => {
                const t = token(r.token)
                const d = signed(r)
                const tone = r.verdict ? (TONE[r.verdict] ?? 'none') : 'none'
                return (
                  <li key={r.seq} className="rp-call" data-tone={tone}>
                    <TokenLogo symbol={t.symbol} size={36} />
                    <div className="rp-call-body">
                      <div className="rp-call-top">
                        <Outcome outcome={r.outcome} shadow={r.shadow} />
                        {r.side && c.side[r.side] && <span className="rp-side">{c.side[r.side]}</span>}
                        <span className="rp-call-name">{t.name}</span>
                        <span className="rp-call-when">
                          #{r.seq} · <When at={r.decidedAt} />
                        </span>
                      </div>
                      <p className="rp-call-summary">{r.summary}</p>
                      <div className="rp-grade">
                        <span className="rp-diff" aria-hidden="true">
                          {d !== null && (
                            <i
                              data-side={tone === 'same' ? 'both' : d >= 0 ? 'up' : 'down'}
                              style={{ width: `${(Math.abs(d) / widest) * 50}%` }}
                            />
                          )}
                        </span>
                        <span className="rp-grade-num">
                          {d === null
                            ? '—'
                            : `${tone === 'same' ? '±' : d > 0 ? '+' : d < 0 ? '−' : ''}${percent(Math.abs(d), 2)}`}
                        </span>
                        <span className="rp-grade-text">
                          {r.verdict === 'better'
                            ? c.better(
                                capitalise(r.chosen ?? 'this'),
                                r.alternative ?? 'the alternative',
                                percent(Math.abs(r.differenceBps ?? 0), 2),
                              )
                            : r.verdict === 'worse'
                              ? c.worse(
                                  capitalise(r.alternative ?? 'the alternative'),
                                  percent(Math.abs(r.differenceBps ?? 0), 2),
                                )
                              : r.verdict === 'no_real_difference'
                                ? c.same
                                : r.verdict === 'ungradable'
                                  ? c.ungradable
                                  : c.notGraded}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/agents/${slug}/decision/${r.seq}` as Route}
                      className="rp-open"
                      aria-label={`${c.open} #${r.seq}`}
                    >
                      <ArrowUpRight aria-hidden="true" className="size-4" />
                    </Link>
                  </li>
                )
              })}
            </ol>
          </section>
        </>
      )}

      <nav className="rp-card rp-past" aria-label={c.past}>
        <span className="rp-kicker">{c.past}</span>
        <ul>
          {past.map((w) => {
            const current = w.from.getTime() === window.from.getTime()
            return (
              <li key={w.from.toISOString()}>
                {current ? (
                  <span className="rp-chip is-current" aria-current="page">
                    {newYorkTime(w.from)} · {c.thisOne}
                  </span>
                ) : (
                  <Link
                    href={`/agents/${slug}/report?at=${encodeURIComponent(w.from.toISOString())}` as Route}
                    className="rp-chip"
                  >
                    {newYorkTime(w.from)}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
