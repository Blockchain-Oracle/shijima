import type { PublicDecision, RecordRow } from '@desk/db'
import { ago, deskCopy, engineCopy, usd } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { Answer } from '@/components/answer'
import { Outcome } from '@/components/outcome'
import type { DeskView } from '@/lib/desk.server'
import { DeskValueChart } from './DeskValueChart'

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
      {view.approvals.length === 0 ? (
        <p className="type-body text-ink-secondary">{deskCopy.needsYou.nothing}</p>
      ) : (
        view.approvals.map((a) => (
          <div key={a.id} className="desk-card">
            <p className="type-body text-ink">{a.summary}</p>
            <p className="type-data text-ink-secondary">
              {deskCopy.needsYou.trade(
                a.side ?? 'buy',
                a.preview.amountIn ?? '?',
                a.preview.expectedOut ?? '?',
              )}
            </p>
            <p className="type-caption text-ink-muted">{deskCopy.needsYou.asking[a.reason]}</p>
            <Answer deskId={view.desk.id} approvalId={a.id} expiresAt={a.expiresAt} />
          </div>
        ))
      )}
    </Panel>
  )
}

export function Plate({ view }: { view: DeskView }) {
  const p = view.plate
  const live = BigInt(view.timing.live.usdg)
  const practice = BigInt(view.timing.practice.usdg)
  return (
    <Panel title={deskCopy.plate.title}>
      {!p ? (
        <p className="type-body text-ink-secondary">{deskCopy.plate.notYet}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="type-caption text-ink-muted">{deskCopy.plate.total}</div>
              <div className="type-data-hero text-ink">{usd(BigInt(p.totalUsdg))}</div>
            </div>
            {p.baselineUsdg && (
              <div className="text-right">
                <div className="type-caption text-ink-muted">{deskCopy.plate.sinceStart}</div>
                <div className="type-data-lg text-ink">
                  {signedUsd(BigInt(p.totalUsdg) - BigInt(p.baselineUsdg))}
                </div>
              </div>
            )}
          </div>
          <div className="desk-rows">
            <div className="desk-row">
              <span>{deskCopy.plate.cash}</span>
              <span className="type-data">
                {usd(BigInt(p.cashUsdg) + BigInt(p.vaultUsdg))} · {pct(p.cashBps)}
              </span>
            </div>
            {BigInt(p.vaultUsdg) > 0n && (
              <div className="desk-row">
                <span className="text-ink-muted">{deskCopy.plate.vault}</span>
                <span className="type-data">{usd(BigInt(p.vaultUsdg))}</span>
              </div>
            )}
            <div className="desk-row">
              <span>{deskCopy.plate.timing}</span>
              <span className="type-data">{view.timing.live.decisions === 0 ? '—' : signedUsd(live)}</span>
            </div>
          </div>
          <p className="type-caption text-ink-muted">
            {view.timing.live.decisions === 0 && view.timing.practice.decisions === 0
              ? deskCopy.plate.timingNone
              : deskCopy.plate.timingNote}
            {view.timing.practice.decisions > 0
              ? ` ${deskCopy.plate.practice(signedUsd(practice), view.timing.practice.decisions)}`
              : ''}
          </p>
          <p className="type-caption text-ink-muted">{deskCopy.plate.valued(ago(new Date(p.takenAt)))}</p>
        </>
      )}
    </Panel>
  )
}

export function Holdings({ view }: { view: DeskView }) {
  if (view.holdings.length === 0) return null
  return (
    <Panel title={deskCopy.holdings.title}>
      <div className="desk-rows">
        {view.holdings.map((h) => {
          const off = h.weightBps - h.targetBps
          const tone =
            Math.abs(off) < (view.mandate?.driftToleranceBps ?? 300)
              ? deskCopy.holdings.inLine
              : off > 0
                ? deskCopy.holdings.over(pct(off))
                : deskCopy.holdings.under(pct(-off))
          return (
            <div key={h.symbol} className="desk-holding">
              <div className="flex items-baseline justify-between gap-3">
                <span className="type-body-strong text-ink">{h.name}</span>
                <span className="type-data text-ink">{usd(BigInt(h.valueUsdg))}</span>
              </div>
              <div className="desk-bar" aria-hidden>
                <span className="desk-bar-fill" style={{ width: `${Math.min(100, h.weightBps / 100)}%` }} />
                <span className="desk-bar-target" style={{ left: `${Math.min(100, h.targetBps / 100)}%` }} />
              </div>
              <div className="flex items-baseline justify-between gap-3 type-caption text-ink-muted">
                <span>
                  {pct(h.weightBps)} · {deskCopy.holdings.target(pct(h.targetBps))}
                </span>
                <span>{tone}</span>
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

export function NextCheck({ view }: { view: DeskView }) {
  const now = new Date()
  const next = new Date(now)
  next.setUTCMinutes(0, 0, 0)
  next.setUTCHours(next.getUTCHours() + 1)
  const time = next.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const d = view.desk
  return (
    <Panel title={deskCopy.nextCheck.title}>
      <p className="type-body text-ink">
        {d.state === 'active' ? deskCopy.nextCheck.at(time) : deskCopy.nextCheck.stopped}
      </p>
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

export function ValueChart({ view }: { view: DeskView }) {
  return (
    <Panel title={deskCopy.chart.title}>
      <DeskValueChart history={view.history} markers={view.markers} />
    </Panel>
  )
}

export function Limits({ view }: { view: DeskView }) {
  const m = view.mandate
  if (!m) return null
  const rows: [string, string][] = [
    [deskCopy.limits.drift, pct(m.driftToleranceBps)],
    [deskCopy.limits.position, pct(m.maxPositionBps)],
    [deskCopy.limits.loss, pct(m.lossStopBps)],
    [deskCopy.limits.perAction, usd(BigInt(m.perActionCapUsdg))],
    [deskCopy.limits.daily, usd(BigInt(m.dailyCapUsdg))],
    [deskCopy.limits.large, usd(BigInt(m.largeActionUsdg))],
  ]
  return (
    <Panel title={deskCopy.limits.title}>
      <div className="desk-rows">
        {rows.map(([label, value]) => (
          <div key={label} className="desk-row">
            <span>{label}</span>
            <span className="type-data">{value}</span>
          </div>
        ))}
      </div>
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

function Entry({ d, slug }: { d: PublicDecision; slug: string }) {
  return (
    <Link href={`/desk/${slug}/decision/${d.seq}` as Route} className="desk-entry" data-cursor="hover">
      <div className="flex items-baseline justify-between gap-3">
        <Outcome outcome={d.outcome} shadow={d.shadow} />
        <span className="type-caption text-ink-muted">{ago(d.decidedAt)}</span>
      </div>
      <p className="type-body text-ink-secondary">{d.summary}</p>
    </Link>
  )
}

export function Record({ view, limit = 12 }: { view: DeskView; limit?: number }) {
  const rows: RecordRow[] = view.record.slice(0, limit)
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
      {rows.length === 0 ? (
        <p className="type-body text-ink-secondary">{deskCopy.record.empty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) =>
            row.kind === 'entry' ? (
              <Entry key={row.decision.id} d={row.decision} slug={view.slug} />
            ) : (
              <details key={`q-${row.from.toISOString()}`} className="desk-quiet">
                <summary className="type-caption text-ink-muted">
                  {deskCopy.record.quiet(row.count)} · {ago(row.to)}
                </summary>
                <div className="mt-2 flex flex-col gap-2">
                  {row.decisions.map((d) => (
                    <Entry key={d.id} d={d} slug={view.slug} />
                  ))}
                </div>
              </details>
            ),
          )}
        </div>
      )}
    </Panel>
  )
}
