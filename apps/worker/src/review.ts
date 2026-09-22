/**
 * One pass over every running desk: the hourly check that is due, the grading once the market has reopened,
 * and the daily seal. This is the desk's actual work, and it is deliberately NOT tied to any one clock.
 *
 * Two clocks call it: OpenServ's hourly cron, which is the primary one, and the worker's own timer, which is
 * the safety net behind it. A check is keyed on (desk, the top of the hour), so whichever gets there first
 * does the work and the other finds it already done. Neither needs to know about the other.
 *
 * Desks are done one after another, never in parallel: there is one operator key, so there is one sender. And
 * there is ONE pass at a time in this process, whichever clock asked: `reviewAllDesksExclusive` hands a second
 * caller the pass already running, so two clocks can never sign against the same nonce.
 */
import { APPROVED_TOKENS, type DeskCall } from '@desk/chain'
import {
  chainReferenceSource,
  checkPriceAlerts,
  gradeAtReopen,
  logPrices,
  type SendReport,
  syncEarnings,
  syncMultipliers,
  wakeDesk,
} from '@desk/core'
import {
  type ActionRow,
  finishCheckRequest,
  hasWake,
  lastSealAt,
  pendingCheckRequests,
  planCheckpoint,
  runningDesks,
  type WakeTrigger,
} from '@desk/db'
import { errorText } from '@desk/shared'
import type { Address, Hex } from 'viem'
import type { openCli } from './cli/context'
import { implementationsByVersion } from './cli/context'
import { resolveUnsettled, sendAction } from './sender'

const SEAL_EVERY_MS = 24 * 60 * 60 * 1000
/** Multiplier changes are rare and report dates rarer. Read them now and then, never on every tick. */
const MULTIPLIERS_EVERY_MS = 60 * 60 * 1000
const EARNINGS_EVERY_MS = 12 * 60 * 60 * 1000
const lastRead = { multipliers: 0, earnings: 0, lowGasWarnedAt: 0 }
/**
 * How long the worker's own timer waits before stepping in.
 *
 * OpenServ's cron is the primary clock. The timer runs every 15 seconds and would otherwise win every race by
 * seconds, which would make the platform trigger redundant and untested. So for an ordinary tick the timer
 * holds back until a check is this far overdue. A trigger from the platform, or a person, runs at once.
 */
const TIMER_GRACE_MS = 7 * 60 * 1000
/** The operator should be able to pay for about this many more actions before Abu is told. */
const LOW_GAS_ACTIONS = 20n
const GAS_PER_ACTION = 400_000n

export type Cli = Awaited<ReturnType<typeof openCli>>
export type Log = (event: string, detail?: Record<string, unknown>) => void

export interface ReviewSummary {
  /** True when the timer held back because the hour is young and the platform may still take it. */
  waitingForPrimaryClock?: boolean
  desks: number
  checks: { desk: string; status: string; records: number }[]
  graded: number
  sealed: number
  /** True when an earlier transaction may still land, so nothing new was sent this pass. Reads still ran. */
  held: boolean
  /** The operator wallet cannot pay for many more actions. Status shows it; Abu tops it up. */
  operatorLowGas?: { balanceWei: string; neededWei: string }
}

/** The top of the hour that a check belongs to. Both clocks must agree on this, so it lives here. */
export function hourSlot(now = new Date()): Date {
  const hour = new Date(now)
  hour.setUTCMinutes(0, 0, 0)
  return hour
}

let inFlight: Promise<ReviewSummary> | undefined

/**
 * The one entry point both clocks use. A pass already running is returned to the second caller, never started
 * again beside it: the operator key signs from one place at a time.
 */
export function reviewAllDesksExclusive(
  cli: Cli,
  log: Log,
  options: { trigger?: WakeTrigger; now?: Date } = {},
): Promise<ReviewSummary> {
  if (inFlight) {
    log('review_joined', { trigger: options.trigger ?? 'tick', note: 'a pass is already running' })
    return inFlight
  }
  inFlight = reviewAllDesks(cli, log, options).finally(() => {
    inFlight = undefined
  })
  return inFlight
}

export async function reviewAllDesks(
  cli: Cli,
  log: Log,
  options: { trigger?: WakeTrigger; now?: Date } = {},
): Promise<ReviewSummary> {
  const now = options.now ?? new Date()
  const hour = hourSlot(now)
  const trigger = options.trigger ?? 'tick'
  const summary: ReviewSummary = { desks: 0, checks: [], graded: 0, sealed: 0, held: false }

  const send = async (action: ActionRow, call: DeskCall): Promise<SendReport> => {
    const sent = await sendAction(cli.deps, action, call)
    if (sent.status === 'refused') return sent
    if (sent.status === 'reverted') return { status: 'reverted', txHash: sent.outcome.txHash }
    const { txHash, eventHash, chainSeq, amountOut } = sent.outcome
    return {
      status: 'confirmed',
      txHash,
      eventHash,
      chainSeq,
      ...(amountOut === undefined ? {} : { amountOut }),
    }
  }

  /**
   * Settles leftovers. False while an earlier transaction may still land: then nothing new is sent this pass,
   * but everything that only reads (grading, prices, alerts) still runs.
   */
  const clearToSend = async () => {
    if (summary.held) return false
    const settled = await resolveUnsettled(cli.deps)
    for (const s of settled) {
      log('settled', { record: s.recordSeq, kind: s.kind, was: s.was, now: s.now, why: s.why })
    }
    if (settled.some((s) => s.now === 'waiting')) {
      log('holding', { note: 'an earlier transaction may still land, so nothing new is sent this pass' })
      summary.held = true
      return false
    }
    return true
  }

  const overdue = now.getTime() - hour.getTime() >= TIMER_GRACE_MS
  const mayCheck = trigger !== 'tick' || overdue
  const wakeDeps = {
    db: cli.db,
    pub: cli.pub,
    approved: APPROVED_TOKENS,
    servApiKey: cli.env.SERV_API_KEY,
    finnhubKey: process.env.FINNHUB_API_KEY,
    operator: cli.wallet.account.address,
    implementations: implementationsByVersion(),
    send,
  }

  // "Check now", from the chat or the website. Each runs at its own request time, never the top of the hour, so
  // it can never take the hourly check's slot. It does not wait for the hourly grace: a person is waiting.
  const running = new Set((await runningDesks(cli.db)).map((d) => d.id))
  for (const request of await pendingCheckRequests(cli.db)) {
    if (!running.has(request.deskId)) {
      await finishCheckRequest(cli.db, request.id, {
        status: 'refused',
        refusedReason: 'the desk is not running',
      })
      continue
    }
    if (!(await clearToSend())) break
    const report = await wakeDesk(wakeDeps, {
      deskId: request.deskId,
      scheduledFor: request.createdAt,
      trigger: 'manual',
    })
    await finishCheckRequest(cli.db, request.id, { status: 'done' })
    log('check_now', {
      desk: request.deskId,
      status: report.status,
      note: report.note,
      records: report.records,
    })
  }

  for (const desk of await runningDesks(cli.db)) {
    summary.desks++
    if (mayCheck && !(await hasWake(cli.db, desk.id, hour)) && (await clearToSend())) {
      const report = await wakeDesk(wakeDeps, { deskId: desk.id, scheduledFor: hour, trigger })
      log('check', {
        desk: desk.address,
        hour: hour.toISOString(),
        status: report.status,
        note: report.note,
        records: report.records,
      })
      summary.checks.push({ desk: desk.address, status: report.status, records: report.records.length })
    }

    // Marking its own homework, once the market has reopened. Reads only: it never trades, so it runs even
    // while a transaction is being waited on.
    try {
      const graded = await gradeAtReopen(
        { db: cli.db, approved: APPROVED_TOKENS, reference: chainReferenceSource(cli.db, cli.pub) },
        desk.id,
        now,
      )
      if (graded.graded.length > 0) {
        log('graded', { desk: desk.address, grades: graded.graded })
        summary.graded += graded.graded.length
      }
    } catch (e) {
      log('grading_failed', { desk: desk.address, error: errorText(e) })
    }

    // The daily seal: one checkpoint carries the newest record's hash, which commits to every record before it.
    const sealedAt = await lastSealAt(cli.db, desk.id)
    if ((!sealedAt || now.getTime() - sealedAt.getTime() >= SEAL_EVERY_MS) && (await clearToSend())) {
      const plan = await planCheckpoint(cli.db, desk.id, cli.wallet.account.address)
      if (plan) {
        const sealed = await send(plan.action, {
          kind: 'checkpoint',
          desk: desk.address as Address,
          version: desk.contractVersion,
          decisionHash: plan.recordHash as Hex,
        })
        log('daily_seal', {
          desk: desk.address,
          status: sealed.status,
          ...(sealed.status === 'refused' ? { code: sealed.code } : { txHash: sealed.txHash }),
        })
        if (sealed.status === 'confirmed') summary.sealed++
      }
    }
  }
  // The price logger: one row per Stock Token every five minutes, for the charts. Reads only, never trades.
  try {
    const priced = await logPrices(
      {
        db: cli.db,
        pub: cli.pub,
        approved: APPROVED_TOKENS,
        reference: chainReferenceSource(cli.db, cli.pub),
        log,
      },
      now,
    )
    if (priced > 0) {
      log('prices', { rows: priced })
      // Alerts are checked against the row just written, so one fires within five minutes of the move.
      const fired = await checkPriceAlerts(cli.db, APPROVED_TOKENS, now)
      if (fired > 0) log('price_alerts', { fired })
    }
  } catch (e) {
    log('prices_failed', { error: errorText(e) })
  }
  await readMarketFacts(cli, log, now)
  await watchOperatorGas(cli, log, now, summary)

  if (!mayCheck) summary.waitingForPrimaryClock = true
  return summary
}

/** The stock pages' slow facts: multiplier changes from the chain, report dates from Finnhub. */
async function readMarketFacts(cli: Cli, log: Log, now: Date): Promise<void> {
  if (now.getTime() - lastRead.multipliers >= MULTIPLIERS_EVERY_MS) {
    lastRead.multipliers = now.getTime()
    try {
      const saved = await syncMultipliers(cli.db, cli.pub, APPROVED_TOKENS)
      if (saved > 0) log('multipliers', { saved })
    } catch (e) {
      log('multipliers_failed', { error: errorText(e) })
    }
  }
  const key = process.env.FINNHUB_API_KEY
  if (key && now.getTime() - lastRead.earnings >= EARNINGS_EVERY_MS) {
    lastRead.earnings = now.getTime()
    try {
      const { saved, unreachable } = await syncEarnings(cli.db, APPROVED_TOKENS, key, now)
      log('earnings', { saved, ...(unreachable.length > 0 ? { unreachable } : {}) })
    } catch (e) {
      log('earnings_failed', { error: errorText(e) })
    }
  }
}

/**
 * The operator pays the network fee for every action. When it could not pay for many more, the pass says so
 * once an hour and Status shows it, so it is topped up before a protective sale is refused for want of gas.
 */
async function watchOperatorGas(cli: Cli, log: Log, now: Date, summary: ReviewSummary): Promise<void> {
  try {
    const [balance, gasPrice] = await Promise.all([
      cli.pub.getBalance({ address: cli.wallet.account.address }),
      cli.pub.getGasPrice(),
    ])
    const needed = LOW_GAS_ACTIONS * GAS_PER_ACTION * gasPrice
    if (balance >= needed) return
    summary.operatorLowGas = { balanceWei: balance.toString(), neededWei: needed.toString() }
    if (now.getTime() - lastRead.lowGasWarnedAt >= 60 * 60 * 1000) {
      lastRead.lowGasWarnedAt = now.getTime()
      log('operator_low_gas', { balanceWei: balance.toString(), neededWei: needed.toString() })
    }
  } catch (e) {
    log('operator_gas_unread', { error: errorText(e) })
  }
}

export { resolveUnsettled }
