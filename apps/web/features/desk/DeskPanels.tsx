import type { PublicDecision, RecordRow } from '@desk/db'
import { ago, CASH_LOOK, deskCopy, engineCopy, lookOf, usd } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { Answer } from '@/components/answer'
import { AllocationDonut } from '@/components/ui/allocation-donut'
import { TokenLogo } from '@/components/ui/token-logo'
import { When } from '@/components/when'
import type { DeskView } from '@/lib/desk.server'
import { cn } from '@/lib/utils'
import { type DeskNote, noteLabel, noteText } from './notes'
import { type ChartMarker, PortfolioChart, type ValuePoint } from './PortfolioChart'
import { RecordTimeline, type TimelineItem } from './RecordTimeline'
import { SessionLine } from './SessionLine'

// Holdings moved to its own file on 22 Sep; the desk page still imports it from here.
export { Holdings } from './HoldingsPanel'

const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`
const signedUsd = (raw: bigint) => `${raw < 0n ? '−' : '+'}${usd(raw < 0n ? -raw : raw)}`

function Panel({
  title,
  children,
  aside,
}: {
  title: string
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <section className="desk-panel">
      <header className="desk-panel-head">
        <h2 className="type-label-micro text-ink-muted">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  )
}

export function NeedsYou({ view }: { view: DeskView }) {
  if (!view.isOwner) return null
  return (
    <Panel title={deskCopy.needsYou.title}>
      {view.desk.stateReason && <p className="text-warning type-caption">{view.desk.stateReason}</p>}
      {view.approvals.length === 0
        ? !view.desk.stateReason && (
            <p className="type-body text-ink-secondary">{deskCopy.needsYou.nothing}</p>
          )
        : view.approvals.map((a) => (
            <div key={a.id} className="desk-card">
              <p className="type-body text-ink">{a.summary}</p>
              <p className="type-data text-ink-secondary">
                {deskCopy.needsYou.trade(
                  a.side ?? 'buy',
                  a.preview.amountIn ?? '?',
                  a.preview.expectedOut ?? '?',
                  a.name,
                )}
              </p>
              <p className="type-caption text-ink-muted">{deskCopy.needsYou.asking[a.reason]}</p>
              <Answer deskId={view.desk.id} approvalId={a.id} expiresAt={a.expiresAt} />
            </div>
          ))}
      {view.desk.telegramLinked === false && (
        <p className="type-caption text-ink-muted">
          {deskCopy.telegramOff}{' '}
          <Link href={`/desk/${view.slug}/settings` as Route} className="text-accent hover:underline">
            {deskCopy.settingsLink} →
          </Link>
        </p>
      )}
    </Panel>
  )
}

/** A dollar figure with its sign, green up and red down. */
function Signed({ raw, className }: { raw: bigint; className?: string }) {
  return (
    <span className={cn(raw < 0n ? 'text-[var(--loss)]' : 'text-[var(--profit)]', className)}>
      {signedUsd(raw)}
    </span>
  )
}

/**
 * What the desk is worth, first and large, with how far it has come since the money went in. After 21st's
 * Wallet Card (5214): the balance leads, the parts sit underneath as small tiles.
 */
export function Plate({ view }: { view: DeskView }) {
  const p = view.plate
  const live = BigInt(view.timing.live.usdg)
  const practice = BigInt(view.timing.practice.usdg)
  if (!p) {
    return (
      <Panel title={deskCopy.plate.title}>
        <p className="type-body text-ink-secondary">{deskCopy.plate.notYet}</p>
      </Panel>
    )
  }
  const total = BigInt(p.totalUsdg)
  const base = p.baselineUsdg ? BigInt(p.baselineUsdg) : null
  const change = base !== null ? total - base : null
  const changePct = base && base > 0n && change !== null ? (Number(change) / Number(base)) * 100 : null
  const tiles: { label: string; value: React.ReactNode }[] = [
    {
      label: deskCopy.plate.cash,
      value: `${usd(BigInt(p.cashUsdg) + BigInt(p.vaultUsdg))} · ${pct(p.cashBps)}`,
    },
    ...(p.sinceReopenUsdg !== null
      ? [{ label: deskCopy.plate.sinceReopen, value: <Signed raw={BigInt(p.sinceReopenUsdg)} /> }]
      : []),
    {
      label: deskCopy.plate.timing,
      value: view.timing.live.decisions === 0 ? '—' : <Signed raw={live} />,
    },
  ]
  return (
    <section className="desk-panel">
      <header className="desk-panel-head">
        <h2 className="type-label-micro text-ink-muted">{deskCopy.plate.title}</h2>
        <span className="type-caption text-ink-muted">
          {deskCopy.plate.valuedShort(ago(new Date(p.takenAt)))}
        </span>
      </header>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <div className="font-[family-name:var(--font-data)] text-[44px] leading-none font-semibold tracking-[-0.02em] text-ink tabular-nums">
          {usd(total)}
        </div>
        {change !== null && (
          <div className="pb-1 font-[family-name:var(--font-data)] text-[14px] tabular-nums">
            <Signed raw={change} />
            {changePct !== null && (
              <span className={cn('ml-1.5', change < 0n ? 'text-[var(--loss)]' : 'text-[var(--profit)]')}>
                ({changePct >= 0 ? '+' : '−'}
                {Math.abs(changePct).toFixed(2)}%)
              </span>
            )}
            <span className="ml-2 text-ink-muted">{deskCopy.plate.sinceStartShort}</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-[var(--radius-md)] border border-border bg-[var(--color-surface-2)] px-3 py-2.5"
          >
            <div className="type-caption text-ink-muted">{t.label}</div>
            <div className="mt-0.5 font-[family-name:var(--font-data)] text-[14px] text-ink tabular-nums">
              {t.value}
            </div>
          </div>
        ))}
      </div>
      {BigInt(p.vaultUsdg) > 0n && (
        <p className="type-caption text-ink-muted">
          {usd(BigInt(p.vaultUsdg))} {deskCopy.plate.vault}
          {p.vaultRateBps !== null && ` · ${deskCopy.plate.vaultRate(pct(p.vaultRateBps))}`}.{' '}
          {deskCopy.plate.vaultNote}
        </p>
      )}
      <p className="type-caption text-ink-muted">
        {view.timing.live.decisions === 0 && view.timing.practice.decisions === 0
          ? deskCopy.plate.timingNone
          : deskCopy.plate.timingNote}
        {view.timing.practice.decisions > 0
          ? ` ${deskCopy.plate.practice(signedUsd(practice), view.timing.practice.decisions)}`
          : ''}
      </p>
    </section>
  )
}

/**
 * What it holds against what it was told to hold, as a ring and a list. The ring is now; each row says the
 * target beside it, so drift reads at a glance.
 */
export function Allocation({ view }: { view: DeskView }) {
  const p = view.plate
  if (!p || !view.mandate) return null
  const a = deskCopy.allocation
  const slices = [
    ...view.holdings
      .filter((h) => h.weightBps > 0)
      .map((h) => ({
        symbol: h.symbol,
        label: h.name,
        pct: h.weightBps / 100,
        color: lookOf(h.symbol).color,
      })),
    { symbol: 'CASH', label: deskCopy.plate.cash, pct: p.cashBps / 100, color: CASH_LOOK.color },
  ]
  const rows = [
    ...view.holdings.map((h) => ({ symbol: h.symbol, name: h.name, now: h.weightBps, target: h.targetBps })),
    { symbol: 'CASH', name: deskCopy.plate.cash, now: p.cashBps, target: view.mandate.cashTargetBps },
  ]
  const drift = view.mandate.driftToleranceBps
  const worst = [...rows].sort((x, y) => Math.abs(y.now - y.target) - Math.abs(x.now - x.target))[0]
  return (
    <Panel title={a.title}>
      <div className="flex flex-wrap items-center gap-6">
        <AllocationDonut slices={slices} size={128} center={a.now} caption={a.caption} />
        <ul className="flex min-w-[200px] flex-1 flex-col gap-2.5">
          {rows.map((r) => {
            const off = r.now - r.target
            return (
              <li key={r.symbol} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <TokenLogo symbol={r.symbol} size={18} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{r.name}</span>
                  <span className="font-[family-name:var(--font-data)] text-[12px] text-ink tabular-nums">
                    {pct(r.now)}
                  </span>
                  <span className="w-20 text-right font-[family-name:var(--font-data)] text-[11px] text-ink-muted tabular-nums">
                    {a.target(pct(r.target))}
                  </span>
                </div>
                <div className="relative h-1.5 overflow-hidden rounded-full bg-[var(--color-hairline)]">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${Math.min(100, r.now / 100)}%`,
                      background: r.symbol === 'CASH' ? CASH_LOOK.color : lookOf(r.symbol).color,
                    }}
                  />
                  <span
                    className="absolute inset-y-[-2px] w-0.5 bg-ink"
                    style={{ left: `${Math.min(99.5, r.target / 100)}%` }}
                  />
                </div>
                {Math.abs(off) >= drift && (
                  <span className="text-[11px] text-[var(--color-warning)]">
                    {off > 0 ? a.over(pct(off)) : a.under(pct(-off))}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
      {worst && Math.abs(worst.now - worst.target) >= drift && (
        <p className="type-caption text-ink-secondary">
          {a.sentence(worst.name, pct(Math.abs(worst.now - worst.target)), worst.now < worst.target)}
        </p>
      )}
    </Panel>
  )
}

/** Hourly checks run at the top of the hour; past two hours without one, the desk has not checked in [8.16]. */
const LATE_MS = 2 * 60 * 60 * 1000

export function NextCheck({ view }: { view: DeskView }) {
  const now = new Date()
  const d = view.desk
  return (
    <Panel title={deskCopy.nextCheck.title}>
      <p className={d.state === 'active' ? 'type-body text-ink' : 'type-body text-warning'}>
        {d.state === 'active' ? (
          <>
            {deskCopy.nextCheck.lead} <When at={d.nextCheckAt} clock />.
          </>
        ) : d.state === 'paused_by_owner' ? (
          deskCopy.nextCheck.paused
        ) : d.state === 'stopped_by_loss_limit' ? (
          deskCopy.nextCheck.lossStop
        ) : (
          deskCopy.nextCheck.stopped
        )}
      </p>
      <CheckState view={view} now={now} />
      <SessionLine className="type-caption text-ink-secondary" />
      <p className="type-caption text-ink-muted">
        {deskCopy.modes[d.mode]}: {deskCopy.modeNote[d.mode]} · {engineCopy.deskState[d.state]}
      </p>
      {d.mode === 'shadow' && (
        <div className="desk-practice">
          <div className="desk-bar" aria-hidden>
            <span
              className="desk-bar-fill"
              style={{ width: `${Math.min(100, (d.shadowChecks / d.goLiveChecks) * 100)}%` }}
            />
          </div>
          <p className="type-caption text-ink-secondary">
            {deskCopy.practice.progress(d.shadowChecks, d.goLiveChecks)}{' '}
            {d.reportOpened ? deskCopy.practice.report.read : deskCopy.practice.report.unread}
            {d.shadowChecks >= d.goLiveChecks && d.reportOpened ? ` ${deskCopy.practice.ready}` : ''}
          </p>
          {view.isOwner && !d.reportOpened && (
            <Link
              href={`/desk/${view.slug}/report` as Route}
              className="type-caption text-accent hover:underline"
            >
              {deskCopy.practice.readReport} →
            </Link>
          )}
        </div>
      )}
    </Panel>
  )
}

const MARKER_KIND: Record<string, ChartMarker['kind']> = {
  acted: 'acted',
  acted_in_part: 'acted',
  acted_by_override: 'acted',
  would_have_acted: 'would',
  waited: 'waited',
}

export function ValueChart({ view }: { view: DeskView }) {
  const toPoint =
    (earlier: boolean) =>
    (h: { at: string; totalUsdg: string }): ValuePoint => ({
      t: new Date(h.at).getTime(),
      value: Number(h.totalUsdg) / 1e6,
      ...(earlier ? { earlier: true } : {}),
    })
  const points = [...(view.earlier?.history.map(toPoint(true)) ?? []), ...view.history.map(toPoint(false))]
  const markers: ChartMarker[] = view.markers.flatMap((m) => {
    const kind = MARKER_KIND[m.outcome]
    return kind ? [{ t: new Date(m.at).getTime(), kind }] : []
  })
  const baseline = view.plate?.baselineUsdg ? Number(view.plate.baselineUsdg) / 1e6 : null
  return (
    <Panel title={deskCopy.chart.title}>
      <PortfolioChart points={points} baseline={baseline} markers={markers} />
    </Panel>
  )
}

function Gauge({
  label,
  value,
  fill,
  warn = false,
}: {
  label: string
  value: string
  fill: number
  warn?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-ink-secondary">{label}</span>
        <span className="font-[family-name:var(--font-data)] text-[13px] text-ink tabular-nums">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-hairline)]">
        <span
          className={cn(
            'block h-full rounded-full',
            warn ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-accent)]',
          )}
          style={{ width: `${Math.max(2, Math.min(100, fill * 100))}%` }}
        />
      </div>
    </div>
  )
}

/**
 * The three limits that move, as gauges: spent today, room left before the loss stop, and the largest holding
 * against the most one stock may take. The fixed ones fold away underneath.
 */
export function Limits({ view }: { view: DeskView }) {
  const m = view.mandate
  if (!m) return null
  const l = deskCopy.limits
  const stop = view.limitsInUse.lossStop
  const spent = BigInt(view.limitsInUse.spentTodayUsdg)
  const cap = BigInt(m.dailyCapUsdg)
  const largest = Math.max(0, ...view.holdings.map((h) => h.weightBps))
  const fixed: [string, string][] = [
    [l.drift, pct(m.driftToleranceBps)],
    [l.loss, pct(m.lossStopBps)],
    [l.perAction, usd(BigInt(m.perActionCapUsdg))],
    [l.daily, usd(cap)],
    [l.large, usd(BigInt(m.largeActionUsdg))],
  ]
  return (
    <Panel title={l.title}>
      <div className="flex flex-col gap-4">
        <Gauge
          label={l.spentToday}
          value={l.spentOf(usd(spent), usd(cap))}
          fill={cap > 0n ? Number(spent) / Number(cap) : 0}
        />
        {stop ? (
          <Gauge
            label={l.lossRoom}
            value={l.lossRoomValue(usd(BigInt(stop.roomUsdg)), pct(stop.roomBps))}
            fill={m.lossStopBps > 0 ? stop.roomBps / m.lossStopBps : 0}
            warn={stop.roomBps < m.lossStopBps / 3}
          />
        ) : (
          <div className="flex justify-between text-[13px]">
            <span className="text-ink-secondary">{l.lossRoom}</span>
            <span className="text-ink-muted">{l.lossUnset}</span>
          </div>
        )}
        <Gauge
          label={l.largestNow}
          value={l.largestOf(pct(largest), pct(m.maxPositionBps))}
          fill={m.maxPositionBps > 0 ? largest / m.maxPositionBps : 0}
          warn={largest > m.maxPositionBps}
        />
      </div>
      <details className="group">
        <summary className="cursor-pointer type-caption text-ink-muted hover:text-ink">{l.all}</summary>
        <div className="desk-rows mt-2">
          {fixed.map(([label, value]) => (
            <div key={label} className="desk-row">
              <span>{label}</span>
              <span className="type-data">{value}</span>
            </div>
          ))}
        </div>
      </details>
    </Panel>
  )
}

export function Mandate({ view }: { view: DeskView }) {
  const m = view.mandate
  if (!m) return null
  return (
    <Panel
      title={deskCopy.mandate.title}
      aside={<span className="type-caption text-ink-muted">{deskCopy.mandate.version(m.version)}</span>}
    >
      <div className="desk-rows">
        <div className="desk-row">
          <span>{deskCopy.mandate.strategy}</span>
          <span>{m.preset ?? deskCopy.mandate.own}</span>
        </div>
        <div className="desk-row">
          <span>{deskCopy.mandate.cashTarget}</span>
          <span className="type-data">{pct(m.cashTargetBps)}</span>
        </div>
      </div>
      {view.isOwner && (
        <div>
          <div className="type-caption text-ink-muted">{deskCopy.mandate.notes}</div>
          <p className="whitespace-pre-line type-body text-ink-secondary">
            {m.notes || deskCopy.mandate.noNotes}
          </p>
        </div>
      )}
      <p className="type-caption text-ink-muted">
        {deskCopy.fee(usd(BigInt(view.feeUsdg)))} {deskCopy.feeNote}
      </p>
    </Panel>
  )
}

/** For an active desk, the one line about its clock: late [8.16], or not yet checked. */
function CheckState({ view, now }: { view: DeskView; now: Date }) {
  const d = view.desk
  const c = deskCopy.nextCheck
  if (d.state !== 'active' || d.lifecycle !== 'running') return null
  if (!d.lastCheckAt) return <p className="type-caption text-ink-secondary">{c.first}</p>
  const last = new Date(d.lastCheckAt)
  if (now.getTime() - last.getTime() > LATE_MS)
    return <p className="type-caption text-warning">{c.late(ago(last, now))}</p>
  return null
}

const rowAt = (row: RecordRow) => (row.kind === 'entry' ? row.decision.decidedAt : row.to).getTime()

const symbolOfDecision = (d: PublicDecision, view: DeskView) =>
  d.token ? view.tokenSymbols[d.token.toLowerCase()] : undefined

/**
 * The record as a timeline, after 21st's Activity Timeline (28340): grouped by day, an icon per outcome, a logo
 * for the stock it concerned, and each entry opening its full decision. Quiet runs fold into one line, and a
 * desk moved from an earlier contract ends with that contract's decisions, folded, linking to the explorer.
 */
export function Record({ view, limit = 14 }: { view: DeskView; limit?: number }) {
  const items: TimelineItem[] = [
    ...view.record.map(
      (row): TimelineItem =>
        row.kind === 'entry'
          ? {
              kind: 'decision',
              at: rowAt(row),
              outcome: row.decision.outcome,
              shadow: row.decision.shadow,
              summary: row.decision.summary ?? '',
              href: `/desk/${view.slug}/decision/${row.decision.seq}`,
              symbol: symbolOfDecision(row.decision, view),
            }
          : {
              kind: 'quiet',
              at: rowAt(row),
              count: row.count,
              label: deskCopy.record.quiet(row.count),
              children: row.decisions.map((d) => ({
                kind: 'decision' as const,
                at: d.decidedAt.getTime(),
                outcome: d.outcome,
                shadow: d.shadow,
                summary: d.summary ?? '',
                href: `/desk/${view.slug}/decision/${d.seq}`,
                symbol: symbolOfDecision(d, view),
              })),
            },
    ),
    ...view.notes.map(
      (note: DeskNote): TimelineItem => ({
        kind: 'note',
        at: new Date(note.at).getTime(),
        label: noteLabel(note),
        summary: noteText(note),
      }),
    ),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
  return (
    <Panel
      title={deskCopy.record.title}
      aside={
        <span className="flex gap-3 type-caption">
          <Link href={`/desk/${view.slug}/report` as Route} className="text-ink-secondary hover:text-ink">
            {deskCopy.record.report} →
          </Link>
          <Link href={`/desk/${view.slug}/record` as Route} className="text-ink-secondary hover:text-ink">
            {deskCopy.record.whole} →
          </Link>
        </span>
      }
    >
      <RecordTimeline
        items={items}
        empty={deskCopy.record.empty}
        earlier={
          view.earlier && view.earlier.decisions.length > 0
            ? {
                label: deskCopy.record.earlier(view.earlier.decisions.length),
                explorer: `https://robinhoodchain.blockscout.com/address/${view.earlier.address}`,
                explorerLabel: deskCopy.record.earlierExplorer,
                items: view.earlier.decisions.map((d) => ({
                  kind: 'decision' as const,
                  at: new Date(d.at).getTime(),
                  outcome: d.outcome,
                  shadow: true,
                  summary: d.summary ?? '',
                })),
              }
            : null
        }
      />
    </Panel>
  )
}
