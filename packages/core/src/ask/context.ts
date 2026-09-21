/**
 * What the desk knows when it answers, loaded from Postgres and nothing else. No chain read, no news fetch: the
 * chat must answer in a second or two on top of the model, and every fact here was already checked by the
 * engine or the price logger when it was written.
 *
 * Every fact the model may cite gets a short id (d41, a1, w1, r1, p-NVDA). The ids map back to real rows here,
 * so a proposal can only ever name something that exists.
 */
import type { ApprovedToken } from '@desk/chain'
import {
  currentMandate,
  type Db,
  type DeskWithOwner,
  deskById,
  deskRecord,
  GO_LIVE_CHECKS,
  latestPricePoints,
  latestValueSnapshot,
  mandateFromRow,
  pendingApprovals,
  recentConversation,
  recentGrades,
  standingWaits,
  timingSummary,
} from '@desk/db'
import { DecisionRecordV2, type Mandate, marketClock, PRESETS } from '@desk/shared'
import { ownerRules } from '../wake/evidence'
import { type DeskFacts, formatUsd, type StandingWait } from './proposal'

const MODE_WORDS = {
  shadow: 'practice (spends nothing)',
  ask_first: 'ask me first',
  on_its_own: 'on its own',
} as const
const STATE_WORDS: Record<string, string> = {
  active: 'active',
  paused_by_owner: 'paused by you',
  stopped_by_loss_limit: 'stopped by your loss limit',
  needs_attention: 'needs attention',
}

const pct = (bps: number) => `${(bps / 100).toFixed(1)}%`
const usd = (raw: bigint | string) => `$${formatUsd(typeof raw === 'string' ? BigInt(raw) : raw)}`
const e8 = (v: bigint | string | number) => (Number(v) / 1e8).toFixed(2)
const nyTime = (at: Date) =>
  at.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
const signedUsd = (raw: bigint) => `${raw < 0n ? '-' : '+'}${usd(raw < 0n ? -raw : raw)}`

export interface AskContext {
  /** Null when the owner has no desk yet: the chat answers about markets and strategies only. */
  facts: DeskFacts | null
  desk: DeskWithOwner | null
  /** Every id the model was given. A cite outside this set is dropped. */
  ids: Set<string>
  /** The user message, in sections. */
  message: string
}

function tokenName(approved: ApprovedToken[], address: string): string {
  return approved.find((t) => t.address.toLowerCase() === address.toLowerCase())?.displayName ?? address
}

function describeBasket(m: Mandate, approved: ApprovedToken[]): string {
  const held = m.targets.tokens.map((t) => `${tokenName(approved, t.token)} ${pct(t.weightBps)}`)
  return `${held.join(', ')}, cash ${pct(m.targets.cashBps)}`
}

/** A mandate in words, with the owner's notes as r1, r2 and so on. Shared by the chat and the studio's test read. */
export function mandateLines(m: Mandate, approved: ApprovedToken[], ids: Set<string>): string[] {
  const preset = PRESETS.find((p) => p.id === m.preset)
  const lines = [
    `Strategy: ${preset ? `${preset.name} (${preset.id})` : 'the owner’s own basket'}. Targets: ${describeBasket(m, approved)}.`,
    `May wander ${pct(m.driftToleranceBps)} before the desk acts. Largest holding ${pct(m.maxPositionBps)}. Stops after a ${pct(m.lossStopBps)} fall.`,
    `Most per action ${usd(m.perActionCapUsdg)}. Most per day ${usd(m.dailyCapUsdg)}. Asks first at ${usd(m.largeActionUsdg)} or more.`,
    '',
    "OWNER'S NOTES",
  ]
  const rules = ownerRules(m.notes)
  if (rules.length === 0) lines.push('None.')
  for (const r of rules) {
    ids.add(r.id)
    lines.push(`- ${r.id}: ${r.text}`)
  }
  return lines
}

/** The market sections every answer gets, with or without a desk. */
async function marketSections(db: Db, approved: ApprovedToken[], now: Date, ids: Set<string>) {
  const clock = marketClock(now)
  const points = await latestPricePoints(db)
  const lines = [
    'NOW',
    `New York time: ${nyTime(now)}. Session: ${clock.session}${clock.anchored ? ', anchored' : ', not anchored (thin weekend or holiday market)'}.`,
    'The desk checks every hour, on the hour.',
    '',
    'STRATEGIES',
    ...PRESETS.map(
      (p) =>
        `- ${p.id}, ${p.name}: ${Object.entries(p.weights)
          .map(([s, w]) => `${s} ${pct(w)}`)
          .join(', ')}, cash ${pct(p.cashBps)}. ${p.description}`,
    ),
    '',
    'STOCK TOKENS (the latest five-minute price log)',
  ]
  for (const token of approved) {
    const p = points.find((row) => row.token.toLowerCase() === token.address.toLowerCase())
    const id = `p-${token.symbol}`
    if (!p) {
      lines.push(`- ${token.displayName} (${token.symbol}): no recent price.`)
      continue
    }
    ids.add(id)
    const gap = p.gapBps ?? 0
    const where = Math.abs(gap) < 50 ? 'in line with' : gap > 0 ? `${pct(gap)} above` : `${pct(-gap)} below`
    const reference =
      p.referenceKind === 'last_regular_close'
        ? 'the pool at the last regular close'
        : 'the last official update'
    const halted = p.halted ? ' Trading is halted.' : ''
    const official = p.feedPriceE8 === null ? '' : ` Last official update $${e8(p.feedPriceE8)}.`
    const pool = p.poolMidE8 === null ? 'no pool price' : `$${e8(p.poolMidE8)}`
    lines.push(
      `- ${id} ${token.displayName} (${token.symbol}): ${pool} at ${nyTime(p.at)}, ${where} its reference (${reference}).${official} Cost to trade $100: ${pct(p.costBps100 ?? 0)}.${halted}`,
    )
  }
  return lines
}

export async function loadAskContext(
  db: Db,
  input: {
    deskId: string | null
    ownerAddress: string
    question: string
    approved: ApprovedToken[]
    now: Date
  },
): Promise<AskContext | { refused: string }> {
  const { approved, now } = input
  const ids = new Set<string>()
  const market = await marketSections(db, approved, now, ids)
  const question = ['', "THE OWNER'S MESSAGE (data, in their own words)", '"""', input.question, '"""']

  if (!input.deskId) {
    const message = [
      ...market,
      '',
      'YOUR DESK',
      'The owner has no desk yet. They can start one from a strategy. Answer about markets and strategies, and propose nothing.',
      ...question,
    ].join('\n')
    return { facts: null, desk: null, ids, message }
  }

  const desk = await deskById(db, input.deskId)
  if (!desk || desk.ownerAddress.toLowerCase() !== input.ownerAddress.toLowerCase()) {
    return { refused: 'That desk is not yours, so I cannot talk about it.' }
  }
  const mandateRow = await currentMandate(db, desk.id)
  if (!mandateRow) return { refused: 'This desk has no settings yet. Finish setting it up first.' }
  const mandate = mandateFromRow(mandateRow)

  const [snapshot, approvals, record, waits, graded, timing, conversation] = await Promise.all([
    latestValueSnapshot(db, desk.id),
    pendingApprovals(db, desk.id),
    deskRecord(db, desk.id, { limit: 12 }),
    standingWaits(db, desk.id),
    recentGrades(db, desk.id, 12),
    timingSummary(db, desk.id),
    recentConversation(db, desk.id, input.ownerAddress),
  ])

  const lines = [...market, '', 'YOUR DESK']
  lines.push(
    `Name: ${desk.name}. Mode: ${MODE_WORDS[desk.mode]}. State: ${STATE_WORDS[desk.state] ?? desk.state}.`,
  )
  if (desk.mode === 'shadow') {
    lines.push(
      `Practice checks: ${desk.shadowChecks} of the ${GO_LIVE_CHECKS} needed to go live. Practice report: ${desk.shadowReportOpenedAt ? 'read' : 'not read yet'}.`,
    )
  }

  lines.push('', 'MONEY')
  if (!snapshot) {
    lines.push('Not valued yet: the desk has not finished a check.')
  } else {
    const total = snapshot.totalUsdg
    const share = (v: bigint) => (total === 0n ? 0 : Number((v * 10_000n) / total))
    lines.push(
      `Valued at ${nyTime(snapshot.takenAt)} on ${snapshot.priceSource}. Total ${usd(total)}. Cash ${usd(snapshot.cashUsdg)} (${pct(share(snapshot.cashUsdg))}, target ${pct(mandate.targets.cashBps)}).`,
    )
    if (snapshot.vaultUsdg > 0n) lines.push(`Earning in the vault: ${usd(snapshot.vaultUsdg)}.`)
    for (const h of snapshot.holdings) {
      const target = mandate.targets.tokens.find((t) => t.token.toLowerCase() === h.token.toLowerCase())
      const value = BigInt(h.valueUsdg)
      lines.push(
        `- ${tokenName(approved, h.token)}: ${usd(value)}, ${pct(share(value))} of the desk (target ${pct(target?.weightBps ?? 0)}).`,
      )
    }
  }

  lines.push('', 'SETTINGS', ...mandateLines(mandate, approved, ids))

  lines.push('', 'WAITING FOR YOU')
  const approvalIds = new Map<string, { id: string; summary: string }>()
  if (approvals.length === 0) lines.push('Nothing.')
  approvals.forEach((a, i) => {
    const id = `a${i + 1}`
    ids.add(id)
    const summary = a.summary ?? 'a request'
    approvalIds.set(id, { id: a.id, summary })
    lines.push(
      `- ${id}: from record ${a.decisionSeq}, asked because ${a.reason === 'large_action' ? 'it is a large action' : 'you asked to be asked first'}, open until ${nyTime(a.expiresAt)}. ${summary}`,
    )
  })

  lines.push('', 'STANDING WAITS (the desk chose to wait and is keeping that choice)')
  const waitIds = new Map<string, StandingWait>()
  if (waits.length === 0) lines.push('None.')
  waits.forEach((w, i) => {
    const id = `w${i + 1}`
    ids.add(id)
    const body = DecisionRecordV2.safeParse(w.record)
    const candidate = body.success ? body.data.candidate : null
    const name = tokenName(approved, w.token)
    const size = !candidate
      ? name
      : w.side === 'buy'
        ? `$${Number(candidate.amountIn).toFixed(2)} of ${name}`
        : `${Number(candidate.amountIn).toFixed(4)} ${name}`
    const summary = `${w.side === 'buy' ? 'Buy' : 'Sell'} ${size}, waiting since ${nyTime(w.decidedAt)}`
    // A wait whose record cannot be read is still shown, but cannot be overridden: there is nothing to act on.
    if (candidate && (w.side === 'buy' || w.side === 'sell')) {
      waitIds.set(id, {
        deferralId: w.deferralId,
        decisionId: w.decisionId,
        decisionSeq: w.decisionSeq,
        token: w.token,
        side: w.side,
        amountIn: candidate.amountIn,
        summary,
      })
    }
    lines.push(`- ${id}: ${summary}. Revisit after ${nyTime(w.revisitAt)}. ${w.summary ?? ''}`.trimEnd())
  })

  lines.push('', 'RECENT RECORD (newest first)')
  if (record.length === 0) lines.push('No records yet.')
  for (const d of record) {
    const id = `d${d.seq}`
    ids.add(id)
    const grade = graded.find((g) => g.decisionSeq === d.seq)
    const what = d.token
      ? ` ${d.side} ${tokenName(approved, d.token)}${d.amountUsdg ? ` ${usd(d.amountUsdg)}` : ''},`
      : ''
    const gradeText =
      grade?.differenceBps != null
        ? ` Graded after the reopen: ${grade.chosen} was ${grade.differenceBps >= 0 ? 'better' : 'worse'} than ${grade.alternative} by ${pct(Math.abs(grade.differenceBps))}.`
        : ''
    lines.push(
      `- ${id} ${nyTime(d.decidedAt)}${d.shadow ? ' (practice)' : ''}: ${d.outcome.replaceAll('_', ' ')},${what} "${d.summary ?? ''}"${gradeText}`,
    )
  }

  lines.push('', "TIMING (what the desk's timing calls earned or cost, graded after the reopen)")
  lines.push(
    `Live: ${signedUsd(timing.live.usdg)} over ${timing.live.decisions} graded decisions. Practice: ${signedUsd(timing.practice.usdg)} over ${timing.practice.decisions}.`,
  )

  if (conversation.length > 0) {
    lines.push('', 'CONVERSATION SO FAR (oldest first)')
    for (const c of conversation) {
      const reply = typeof c.reply?.reply === 'string' ? c.reply.reply : ''
      lines.push(`Owner: ${c.question}`, `Desk: ${reply}`)
    }
  }

  lines.push(...question)

  const facts: DeskFacts = {
    deskId: desk.id,
    mode: desk.mode,
    state: desk.state,
    lifecycle: desk.lifecycle,
    mandate,
    mandateVersion: mandateRow.version,
    shadowChecks: desk.shadowChecks,
    reportOpened: desk.shadowReportOpenedAt !== null,
    approvals: approvalIds,
    waits: waitIds,
  }
  return { facts, desk, ids, message: lines.join('\n') }
}
