/**
 * Grades every weekend decision once the US market has reopened.
 *
 * The comparison price is the SAME pool the desk trades in, half an hour after the open, so both sides of the
 * comparison are prices the desk could really have got. The reference is computed from the chain's own swap
 * logs and kept, so a grade can be recomputed by anyone later and cannot drift.
 */
import type { ApprovedToken } from '@desk/chain'
import {
  type Db,
  deskById,
  enqueueNotification,
  recordWithGrades,
  saveGrade,
  ungradedDecisions,
} from '@desk/db'
import { nextRegularOpen, viewRecord } from '@desk/shared'
import type { ReferenceSource } from '../wake/reference'
import { gradeDecision } from './grade'
import { reportWindow, summarise } from './report'

/** Half an hour after the bell, the same moment a remembered wait says it will look again. */
export const AFTER_OPEN_MS = 30 * 60 * 1000

export interface GradeDeps {
  db: Db
  approved: ApprovedToken[]
  reference: ReferenceSource
  log?: (line: string) => void
}

export interface GradeReport {
  graded: { seq: number; verdict: string; differenceBps: number | null }[]
  waiting: number
}

/** The most recent reopen that is already half an hour old, or undefined if none has happened yet. */
export function lastSettledReopen(now: Date): Date | undefined {
  // nextRegularOpen looks forward, so step back a day at a time to find the most recent open behind us.
  for (let days = 0; days < 10; days++) {
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const open = nextRegularOpen(new Date(from.getTime() - 24 * 60 * 60 * 1000))
    const settled = new Date(open.getTime() + AFTER_OPEN_MS)
    if (settled <= now) return settled
  }
  return undefined
}

export async function gradeAtReopen(deps: GradeDeps, deskId: string, now = new Date()): Promise<GradeReport> {
  const settled = lastSettledReopen(now)
  const report: GradeReport = { graded: [], waiting: 0 }
  if (!settled) return report

  // Only decisions made BEFORE that reopen can be graded against it.
  const pending = await ungradedDecisions(deps.db, deskId, settled)
  for (const row of pending) {
    const token = deps.approved.find((t) => t.address.toLowerCase() === row.token?.toLowerCase())
    const view = viewRecord(row.record)
    if (!token || !view) {
      report.waiting++
      continue
    }
    const priceThenE8 = priceAtDecision(view)
    const atReopen = await deps.reference(token, settled, 'open').catch(() => undefined)
    if (!priceThenE8 || !atReopen) {
      report.waiting++
      continue
    }
    const grade = gradeDecision({
      outcome: row.outcome,
      // Only a buy or a sell has an alternative price. A vault move is not a timing call.
      side: row.side === 'buy' || row.side === 'sell' ? row.side : undefined,
      priceThenE8,
      priceAtReopenE8: atReopen.priceE8,
    })
    await saveGrade(deps.db, {
      deskId,
      decisionId: row.id,
      verdict: grade.verdict,
      differenceBps: grade.differenceBps,
      chosen: grade.chosen,
      alternative: grade.alternative,
      decisionPriceE8: priceThenE8,
      reopenPriceE8: atReopen.priceE8,
      detail: { why: grade.why, reopenAt: settled.toISOString(), recordVersion: view.version },
    })
    report.graded.push({ seq: row.seq, verdict: grade.verdict, differenceBps: grade.differenceBps })
    deps.log?.(`record ${row.seq}: ${grade.verdict}. ${grade.why}`)
  }
  if (report.graded.length > 0) await announceReport(deps.db, deskId, settled)
  return report
}

/**
 * The Monday report, in one Telegram message with a link to the page (brief 9.8). Sent once per reopen per
 * desk: the first grading pass after the bell queues it, and the dedupe key stops any later pass repeating it.
 */
async function announceReport(db: Db, deskId: string, settled: Date): Promise<void> {
  const [desk, window] = [await deskById(db, deskId), reportWindow(settled)]
  if (!desk) return
  const rows = await recordWithGrades(db, deskId, window.from, window.to)
  const summary = summarise(
    rows.map((r) => ({ outcome: r.outcome, verdict: r.verdict, differenceBps: r.differenceBps })),
  )
  const slug = desk.shareEnabled && desk.shareSlug ? desk.shareSlug : desk.id
  await enqueueNotification(db, {
    deskId,
    kind: 'monday_report',
    payload: {
      text: summary.sentence,
      path: `/agents/${slug}/report?at=${encodeURIComponent(window.from.toISOString())}`,
      windowFrom: window.from.toISOString(),
    },
    dedupeKey: `report:${window.from.toISOString()}`,
  })
}

const E8 = 10n ** 8n

/**
 * The price the desk was looking at when it decided. Version 2 recorded the pool price directly. Earlier
 * versions recorded only the oracle price and the gap to it, so the price is rebuilt from those two, which is
 * exactly what that gap meant at the time.
 */
function priceAtDecision(view: ReturnType<typeof viewRecord>): bigint | undefined {
  if (!view?.price) return undefined
  if (view.price.poolPrice) return toE8(view.price.poolPrice)
  const official = toE8(view.price.lastOfficialUpdate)
  if (!official) return undefined
  return official + (official * BigInt(view.price.gapBps)) / 10_000n
}

/** A decimal string from a record into an 8 decimal integer, without ever becoming a float. */
function toE8(decimal: string): bigint | undefined {
  const [whole, fraction = ''] = decimal.split('.')
  if (whole === undefined || !/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) return undefined
  return BigInt(whole) * E8 + BigInt(fraction.slice(0, 8).padEnd(8, '0'))
}
