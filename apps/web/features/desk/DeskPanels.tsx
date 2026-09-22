import type { PublicDecision, RecordRow } from '@desk/db'
import { ago, deskCopy, engineCopy, usd } from '@desk/shared'
import type { Route } from 'next'
import Link from 'next/link'
import { Answer } from '@/components/answer'
import { Outcome } from '@/components/outcome'
import { When } from '@/components/when'
import type { DeskView } from '@/lib/desk.server'
import { DeskValueChart } from './DeskValueChart'
import { type DeskNote, noteLabel, noteText } from './notes'
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
            <div className="flex gap-6 text-right">
              {p.baselineUsdg && (
                <div>
                  <div className="type-caption text-ink-muted">{deskCopy.plate.sinceStart}</div>
                  <div className="type-data-lg text-ink">
                    {signedUsd(BigInt(p.totalUsdg) - BigInt(p.baselineUsdg))}
                  </div>
                </div>
              )}
              {p.sinceReopenUsdg !== null && (
                <div>
                  <div className="type-caption text-ink-muted">{deskCopy.plate.sinceReopen}</div>
                  <div className="type-data-lg text-ink">{signedUsd(BigInt(p.sinceReopenUsdg))}</div>
                </div>
              )}
            </div>
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
                <span className="type-data">
                  {usd(BigInt(p.vaultUsdg))}
                  {p.vaultRateBps !== null && ` · ${deskCopy.plate.vaultRate(pct(p.vaultRateBps))}`}
                </span>
              </div>
            )}
            <div className="desk-row">
              <span>{deskCopy.plate.timing}</span>
              <span className="type-data">{view.timing.live.decisions === 0 ? '—' : signedUsd(live)}</span>
            </div>
          </div>
          {BigInt(p.vaultUsdg) > 0n && (
            <p className="type-caption text-ink-muted">{deskCopy.plate.vaultNote}</p>
          )}
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
  const l = deskCopy.limits
  const stop = view.limitsInUse.lossStop
  const rows: [string, string][] = [
    [l.spentToday, l.spentOf(usd(BigInt(view.limitsInUse.spentTodayUsdg)), usd(BigInt(m.dailyCapUsdg)))],
    [l.lossRoom, stop ? l.lossRoomValue(usd(BigInt(stop.roomUsdg)), pct(stop.roomBps)) : l.lossUnset],
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

function Note({ note }: { note: DeskNote }) {
  return (
    <div className="desk-entry">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-ink-secondary text-sm">{noteLabel(note)}</span>
        <span className="type-caption text-ink-muted">{ago(new Date(note.at))}</span>
      </div>
      <p className="type-body text-ink-secondary">{noteText(note)}</p>
    </div>
  )
}

const rowAt = (row: RecordRow) => (row.kind === 'entry' ? row.decision.decidedAt : row.to).getTime()

export function Record({ view, limit = 12 }: { view: DeskView; limit?: number }) {
  // Decisions and notes in one list, newest first: a deposit belongs between the checks around it.
  const merged = [
    ...view.record.map((row) => ({ at: rowAt(row), row, note: undefined })),
    ...view.notes.map((note) => ({ at: new Date(note.at).getTime(), row: undefined, note })),
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
      {merged.length === 0 ? (
        <p className="type-body text-ink-secondary">{deskCopy.record.empty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {merged.map(({ row, note, at }) =>
            note ? (
              <Note key={`n-${at}-${note.kind}`} note={note} />
            ) : !row ? null : row.kind === 'entry' ? (
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
