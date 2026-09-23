/**
 * The copy pass: every leader move an active follower has not yet answered, run through the follower's own check
 * with trigger `copy` (copy.ts does the copying itself). The worker calls it inside its one pass, after the desks'
 * own checks, so the operator key still signs from one place at a time.
 */
import { readDeskState } from '@desk/chain'
import {
  copyAnswer,
  currentMandate,
  deskById,
  mandateFromRow,
  type PendingCopy,
  pendingCopies,
} from '@desk/db'
import { copyTradeCopy, errorText } from '@desk/shared'
import type { Address } from 'viem'
import { type CopyRecord, type CopySource, leaderShare, writeMissed } from './copy'
import type { PlannedOutcome } from './plan'
import { mandateFingerprint } from './record'
import { type WakeDeps, wakeDesk } from './wake'

/** A leader move older than this is not copied: the price the follower would get is not the leader's price. */
export const COPY_MAX_AGE_MS = 30 * 60 * 1000

/**
 * A missed copy when the follower's own check could not run at all: too late, an unreadable leader record, or a
 * check that failed. Only the chain's counter and head are read, so the record still sits in the chain properly.
 */
async function recordMissedWithoutWake(
  deps: WakeDeps,
  followerDeskId: string,
  source: CopySource,
  why: string,
  now: Date,
): Promise<CopyRecord> {
  const desk = await deskById(deps.db, followerDeskId)
  if (!desk) throw new Error(`desk ${followerDeskId} is not registered`)
  const state = await readDeskState(deps.pub, desk.address as Address)
  const row = await currentMandate(deps.db, desk.id)
  return writeMissed(deps.db, {
    deskId: desk.id,
    mode: desk.mode,
    wakeId: undefined,
    common: {
      chainId: desk.chainId,
      desk: desk.address,
      decidedAt: now,
      wake: { scheduledFor: now, trigger: 'copy' },
      mode: desk.mode,
      mandate: row ? { version: row.version, fingerprint: mandateFingerprint(mandateFromRow(row)) } : null,
      valuation: null,
    },
    state,
    source,
    why,
  })
}

/** The leader as a follower's owner knows it. */
function leaderLabel(p: PendingCopy): string {
  const name =
    p.leader.name ?? p.leader.shareSlug ?? `${p.leader.address.slice(0, 6)}…${p.leader.address.slice(-4)}`
  return copyTradeCopy.leader(name, p.decision.seq)
}

export interface CopyPassResult {
  follower: string
  leaderDecision: string
  seq: number | null
  outcome: PlannedOutcome | 'NOT_ANSWERED'
  summary: string
}

/**
 * Every leader move an active follower has not yet answered, one at a time, oldest first. The worker calls this
 * inside its one pass, so it signs from the same place as everything else. Each move ends as the follower's copy,
 * or its missed copy. If even the missed copy cannot be written (the chain cannot be read), the move stays pending
 * and the next pass tries again: it is never answered with a trade made on a guess.
 */
export async function copyLeaderMoves(
  deps: WakeDeps,
  options: { now?: Date; say?: (line: string) => void } = {},
): Promise<CopyPassResult[]> {
  const say = options.say ?? (() => undefined)
  const results: CopyPassResult[] = []
  for (const p of await pendingCopies(deps.db)) {
    const now = options.now ?? new Date()
    const label = leaderLabel(p)
    const side = p.decision.side === 'sell' ? 'sell' : 'buy'
    const token = (p.decision.token ?? '').toLowerCase()
    const share = leaderShare({ side, token, record: p.decision.record, amountIn: p.actionAmountIn })
    const source: CopySource = {
      leaderDecisionId: p.decision.id,
      leaderLabel: label,
      side,
      token,
      sharePpm: 'sharePpm' in share ? share.sharePpm : 0n,
    }
    const done = (r: CopyRecord | undefined, note?: string) =>
      results.push({
        follower: p.followerDeskId,
        leaderDecision: p.decision.id,
        seq: r?.seq ?? null,
        outcome: r?.outcome ?? 'NOT_ANSWERED',
        summary: r?.summary ?? note ?? '',
      })
    const miss = async (why: string) => {
      try {
        done(await recordMissedWithoutWake(deps, p.followerDeskId, source, why, now))
      } catch (e) {
        done(undefined, `could not record the missed copy yet: ${errorText(e)}`)
      }
    }

    const ageMs = now.getTime() - p.decision.decidedAt.getTime()
    if (ageMs > COPY_MAX_AGE_MS) {
      await miss(copyTradeCopy.reason.tooLate(Math.round(ageMs / 60_000)))
      continue
    }
    if ('error' in share) {
      await miss(copyTradeCopy.reason.couldNotCheck(share.error))
      continue
    }
    say(`copy ${label} to ${p.followerDeskId}: ${side} ${share.sharePpm} ppm`)
    const report = await wakeDesk(deps, {
      deskId: p.followerDeskId,
      // The copy's own moment, never the hour, so it can never take an hourly check's place. Not the leader's
      // decision time: one leader check can make several moves at the same instant, and each is its own copy.
      // Copying the same move twice is stopped by the record's unique (desk, copied_from) key, not by this.
      scheduledFor: new Date(),
      trigger: 'copy',
      copy: source,
    })
    const answer = await copyAnswer(deps.db, p.followerDeskId, p.decision.id)
    if (answer) {
      const r = report.records.find((x) => x.seq === answer.seq)
      done({ seq: answer.seq, outcome: r?.outcome ?? 'DECLINED', summary: answer.summary })
      continue
    }
    await miss(
      report.status === 'skipped' && report.note === 'no mandate has been applied yet'
        ? copyTradeCopy.reason.noMandate
        : copyTradeCopy.reason.couldNotCheck(report.note ?? report.status),
    )
  }
  return results
}
