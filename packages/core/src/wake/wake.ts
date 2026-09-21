/**
 * One check of one desk. Only the worker calls this.
 *
 *   reconcile -> valuation (and the loss limit) -> needs -> for each candidate: consider, record, act
 *
 * With `dry` set it reads, values and asks the model exactly as a real check would, then commits NOTHING and
 * sends NOTHING. It prints what it would have recorded.
 *
 * Non-actions are not sealed here one by one. They join the desk's record chain, and the next action or the
 * daily checkpoint seals every one of them at once, because each record's hash commits to the one before it.
 */
import { type ApprovedToken, CHAIN_ID, type DeskCall, isCloneOf, readDeskState } from '@desk/chain'
import {
  type ActionRow,
  addDeskEvent,
  appendRecord,
  bumpShadowChecks,
  confirmedTradesSince,
  currentMandate,
  type Db,
  deskById,
  didSameTradeSince,
  enqueueNotification,
  ensureDrawdownBaseline,
  expireApprovals,
  finishWake,
  latestValueSnapshot,
  mandateFromRow,
  pendingApprovalSince,
  recordDrawdownBreach,
  recordOutsideChanges,
  saveValueSnapshot,
  setDeskState,
  spentSince,
  standingDeferral,
  startWake,
  type WakeTrigger,
} from '@desk/db'
import { engineCopy, errorText, type Mandate } from '@desk/shared'
import { type Address, formatUnits, type Hex, type PublicClient } from 'viem'
import { runApprovedRequests } from './approved'
import { commit, snapshotOf } from './commit'
import { considerCandidate } from './consider'
import { findNeeds } from './needs'
import type { PlannedOutcome } from './plan'
import { allPriced, findOutsideChanges, netFlowUsdg, scaledBaseline } from './reconcile'
import { buildDecisionBody, mandateFingerprint, RECORD_SCHEMA_VERSION } from './record'
import { chainReferenceSource } from './reference'
import { USDG_DECIMALS } from './types'
import { readValuation } from './valuation'

export const MAX_CANDIDATES_PER_WAKE = 3
/** The desk will not repeat the same trade on the same token inside this window. A stale read is the usual cause. */
const REPEAT_WINDOW_MS = 10 * 60 * 1000

/** What the worker's sender reports back. The worker owns the operator key, so sending is injected. */
export type SendReport =
  | { status: 'confirmed'; txHash: Hex; eventHash: Hex; chainSeq: bigint; amountOut?: bigint }
  | { status: 'reverted'; txHash: Hex }
  | { status: 'refused'; code: string; detail: string }

export interface WakeDeps {
  db: Db
  pub: PublicClient
  approved: ApprovedToken[]
  servApiKey: string
  finnhubKey?: string | undefined
  operator: Address
  /** The Desk implementation behind each contract version, from deployments.json. A desk must be a clone of its own. */
  implementations: Record<string, Address>
  send: (action: ActionRow, call: DeskCall) => Promise<SendReport>
  log?: (line: string) => void
}

export interface WakeInput {
  deskId: string
  scheduledFor: Date
  trigger: WakeTrigger
  dry?: boolean
  /** DEVELOPER ONLY. Act even when the model says wait, recorded as an override. */
  force?: boolean
}

export interface WakeReport {
  status: 'completed' | 'skipped' | 'already_ran' | 'failed'
  note?: string
  records: { seq: number | null; outcome: PlannedOutcome; summary: string }[]
}

const usd = (v: bigint) => `$${Number(formatUnits(v, USDG_DECIMALS)).toFixed(2)}`
const pct = (bps: number) => `${(bps / 100).toFixed(1)}%`

function mandateLine(m: Mandate, version: number, approved: ApprovedToken[]): string {
  const name = (a: string) =>
    approved.find((t) => t.address.toLowerCase() === a.toLowerCase())?.displayName ?? a
  const targets = m.targets.tokens.map((t) => `${name(t.token)} ${pct(t.weightBps)}`).join(', ')
  return `MANDATE v${version}: hold ${targets}, and ${pct(m.targets.cashBps)} cash. A holding may wander ${pct(m.driftToleranceBps)} from its target. No holding above ${pct(m.maxPositionBps)}.`
}

export async function wakeDesk(deps: WakeDeps, input: WakeInput): Promise<WakeReport> {
  const { db, pub } = deps
  const dry = input.dry === true
  const say = (line: string) => deps.log?.(line)
  const records: WakeReport['records'] = []
  const reference = chainReferenceSource(db, pub)

  const desk = await deskById(db, input.deskId)
  if (!desk) throw new Error(`desk ${input.deskId} is not registered`)
  const mandateRow = await currentMandate(db, desk.id)
  if (!mandateRow) return { status: 'skipped', note: 'no mandate has been applied yet', records }
  if (desk.lifecycle !== 'running')
    return { status: 'skipped', note: `the desk is ${desk.lifecycle}`, records }
  const mandate = mandateFromRow(mandateRow)
  const mandateRef = { version: mandateRow.version, fingerprint: mandateFingerprint(mandate) }

  const wake = dry
    ? undefined
    : await startWake(db, { deskId: desk.id, scheduledFor: input.scheduledFor, trigger: input.trigger })
  if (!dry && !wake) return { status: 'already_ran', note: 'this check already ran', records }

  try {
    // 1. reconcile: is this still our desk, and does the chain agree with the database?
    const now = new Date()
    let state = await readDeskState(pub, desk.address as Address)
    const implementation = deps.implementations[desk.contractVersion]
    const ours = implementation ? await isCloneOf(pub, desk.address as Address, implementation) : false
    const trouble = !ours
      ? engineCopy.trouble.notOurDesk
      : state.operator.toLowerCase() !== desk.operator
        ? engineCopy.trouble.operatorRemoved
        : state.owner.toLowerCase() !== desk.ownerAddress
          ? engineCopy.trouble.differentOwner
          : Number(state.seq) !== desk.chainSeq
            ? engineCopy.trouble.chainAhead(String(state.seq), desk.chainSeq)
            : null
    if (trouble) {
      if (!dry) await setDeskState(db, desk.id, 'needs_attention', trouble)
      throw new Error(trouble)
    }

    // 2. valuation, on the pool's 30 minute average
    const valuation = await readValuation(pub, state, mandate, deps.approved, now)
    say(
      `worth ${usd(valuation.totalUsdg)}: cash ${usd(valuation.cashUsdg)} (${pct(valuation.cashWeightBps)})${valuation.holdings.map((h) => `, ${h.token.symbol} ${usd(h.valueUsdg)} (${pct(h.weightBps)} of target ${pct(h.targetBps)})`).join('')}`,
    )

    for (const u of valuation.unpriced) say(`NOT VALUED: ${u.why}`)

    // Money that arrived or left without the desk doing it moves the loss-limit baseline, not the loss.
    // True when something moved that could not be valued, so the desk's worth is not fully known.
    let unpricedFlow = false
    const previous = await latestValueSnapshot(db, desk.id)
    const changes = previous
      ? findOutsideChanges(
          {
            cashUsdg: previous.cashUsdg,
            tokens: Object.fromEntries(
              previous.holdings.map((h) => [h.token.toLowerCase(), BigInt(h.amountRaw)]),
            ),
          },
          await confirmedTradesSince(db, desk.id, previous.takenAt),
          { cashUsdg: state.usdg, tokens: state.holdings },
          Object.fromEntries(valuation.holdings.map((h) => [h.token.address.toLowerCase(), h.twapE8])),
        )
      : []
    if (changes.length > 0) {
      unpricedFlow = !allPriced(changes)
      say(
        `balances changed outside the desk: ${changes.map((c) => `${c.asset} ${c.delta > 0n ? '+' : ''}${c.delta}`).join(', ')}`,
      )
    }
    if (!dry) {
      const snapshot = snapshotOf(desk.id, valuation, now)
      if (changes.length > 0) {
        // The baseline, the note of what happened, and the snapshot that stops it being counted again, all
        // in one transaction. Scaled, not added, so the owner's own money moving never changes how far down
        // the desk is.
        await recordOutsideChanges(db, {
          deskId: desk.id,
          baselineUsdg: scaledBaseline(
            desk.drawdownBaselineUsdg ?? valuation.totalUsdg,
            valuation.totalUsdg,
            netFlowUsdg(changes),
          ),
          event: {
            changes: changes.map((c) => ({
              asset: c.asset,
              delta: c.delta.toString(),
              usdgValue: c.priced ? c.usdgValue.toString() : null,
            })),
          },
          snapshot,
        })
      } else {
        await saveValueSnapshot(db, snapshot)
      }
    }

    // The loss limit. A breach stops the desk from acting. The owner restarts it.
    const baseline = dry
      ? (desk.drawdownBaselineUsdg ?? valuation.totalUsdg)
      : await ensureDrawdownBaseline(db, desk.id, valuation.totalUsdg)
    const lossBps =
      baseline > valuation.totalUsdg ? Number(((baseline - valuation.totalUsdg) * 10_000n) / baseline) : 0
    // A price we could not read is not a loss. Judging the limit on a partial valuation could stop the desk
    // over an RPC failure, so while anything is unpriced the limit is not evaluated and the record says so.
    const canJudgeLoss = valuation.unpriced.length === 0 && !unpricedFlow
    const breached = canJudgeLoss && lossBps >= mandate.lossStopBps
    let deskState = desk.state
    if (!dry) await recordDrawdownBreach(db, desk.id, breached)
    if (breached && deskState === 'active') {
      const why = engineCopy.lossLimitReached(
        usd(valuation.totalUsdg),
        lossBps,
        usd(baseline),
        mandate.lossStopBps,
      )
      deskState = 'stopped_by_loss_limit'
      if (!dry) {
        await setDeskState(db, desk.id, deskState, why)
        await addDeskEvent(db, {
          deskId: desk.id,
          kind: 'loss_stop',
          actor: 'desk',
          via: 'worker',
          detail: { lossBps },
        })
        await enqueueNotification(db, {
          deskId: desk.id,
          kind: 'alert',
          payload: { alert: 'loss_limit_reached', text: why },
          dedupeKey: `loss_stop:${now.toISOString().slice(0, 10)}`,
        })
      }
      say(`STOPPED BY THE LOSS LIMIT. ${why}`)
    }

    const stateText = engineCopy.deskState[deskState]
    // The owner's own daily limit is counted over a rolling 24 hours, which is stricter than the chain's window.
    const spentTodayUsdg = await spentSince(db, desk.id, new Date(now.getTime() - 24 * 60 * 60 * 1000))
    const common = {
      chainId: CHAIN_ID,
      desk: desk.address,
      decidedAt: now,
      wake: { scheduledFor: input.scheduledFor, trigger: input.trigger },
      mode: desk.mode,
      mandate: mandateRef,
      valuation,
    }

    // What the owner has approved comes first: an approval is permission to act at about the price they were
    // shown, so every minute it waits makes it less true.
    if (!dry) {
      const carried = await runApprovedRequests(
        deps,
        { desk, wakeId: wake?.id, common, state, input },
        {
          mandate,
          spentTodayUsdg,
          mandateLine: mandateLine(mandate, mandateRow.version, deps.approved),
          deskState,
          stateText,
          valuation,
          now,
          reference,
          say,
        },
      )
      records.push(...carried.records)
      if (carried.moved) state = await readDeskState(pub, desk.address as Address)
    }

    // Requests the owner never answered have lapsed. Nothing was done, and they are told so.

    if (!dry) {
      for (const lapsed of await expireApprovals(db, desk.id, now)) {
        await enqueueNotification(db, {
          deskId: desk.id,

          decisionId: lapsed.decisionId,

          kind: 'alert',

          payload: { alert: 'approval_expired', text: engineCopy.approvalExpired },
        })
      }
    }

    // 3. needs. Arithmetic only. A desk that is not active looks, values, and proposes nothing.
    const priceless = new Set(valuation.unpriced.map((u) => u.token.address.toLowerCase()))
    const needs =
      deskState === 'active'
        ? findNeeds(valuation, mandate, state.perActionCapUsdg)
            .filter((n) => !priceless.has(n.candidate.token.address.toLowerCase()))
            .slice(0, MAX_CANDIDATES_PER_WAKE)
        : []
    if (needs.length === 0) {
      const summary = deskState === 'active' ? engineCopy.nothingToDo : engineCopy.notLooking(stateText)
      const seq = dry
        ? null
        : (
            await appendRecord(db, desk.id, (slot) => ({
              record: buildDecisionBody({
                ...common,
                slot,
                state,
                need: null,
                candidate: null,
                deferral: null,
                blockers: [],
                evidence: [],
                answer: null,
                gate: null,
                override: null,
                outcome: 'NOTHING_TO_DO',
                ask: null,
                preview: null,
              }),
              schemaVersion: RECORD_SCHEMA_VERSION,
              ...(wake ? { wakeId: wake.id } : {}),
              outcome: 'nothing_to_do',
              mode: desk.mode,
              summary,
              decidedAt: now,
            }))
          ).decision.seq
      records.push({ seq, outcome: 'NOTHING_TO_DO', summary })
      say(`record ${seq ?? '(dry)'}: NOTHING_TO_DO. ${summary}`)
    }

    // 4. each candidate: consider, record, act
    for (const need of needs) {
      const standing = await standingDeferral(db, desk.id, need.candidate.token.address)
      const askedAt = await pendingApprovalSince(db, desk.id, need.candidate.token.address)
      const held = valuation.holdings.find((h) => h.token.address === need.candidate.token.address)
      const repeatedWithinMinutes = await didSameTradeSince(
        db,
        desk.id,
        need.candidate.token.address,
        need.candidate.side,
        new Date(now.getTime() - REPEAT_WINDOW_MS),
      )
      let considered = await considerCandidate(
        {
          pub,
          servApiKey: deps.servApiKey,
          finnhubKey: deps.finnhubKey,
          reference,
          state,
          mandate,
          mandateLine: mandateLine(mandate, mandateRow.version, deps.approved),
          mode: desk.mode,
          deskActive: true,
          deskStateText: stateText,
          standing,
          askedAt,
          deskAddress: desk.address as Address,
          holdingUsdg: held?.valueUsdg ?? 0n,
          totalUsdg: valuation.totalUsdg,
          spentTodayUsdg,
          repeatedWithinMinutes,
          ...(input.force ? { force: true } : {}),
          now,
        },
        need,
      )
      say(
        `${need.candidate.id} ${need.candidate.side.toUpperCase()} ${need.candidate.token.symbol}: ${need.candidate.why}`,
      )
      if (considered.answer)
        say(
          `  SERV: ${considered.answer.serv.ok ? `${considered.answer.serv.value.option} (${considered.answer.serv.value.confidencePercent}%)` : `failed, ${considered.answer.serv.error}`}`,
        )
      // The model takes many seconds. The owner may have paused in that time, so the state is read again NOW.
      if (considered.willAct || considered.ask) {
        const fresh = await deskById(db, desk.id)
        if (fresh && fresh.state !== 'active') {
          const text = engineCopy.pausedMeanwhile(engineCopy.deskState[fresh.state])
          considered = {
            ...considered,
            willAct: false,
            ask: null,
            outcome: 'DECLINED',
            summary: text,
            blockers: [{ rule: 'DESK_NOT_ACTIVE', text }],
            preview: null,
            newDeferralBaseline: null,
          }
        }
      }
      if (dry) {
        records.push({ seq: null, outcome: considered.outcome, summary: considered.summary })
        say(`  record (dry): ${considered.outcome}. ${considered.summary}`)
        continue
      }
      const acted = await commit(deps, { desk, wakeId: wake?.id, common, state, input }, considered)
      records.push({ seq: acted.seq, outcome: considered.outcome, summary: considered.summary })
      say(
        `  record ${acted.seq}: ${considered.outcome}. ${considered.summary}${acted.note ? ` ${acted.note}` : ''}`,
      )
      if (acted.moved) state = await readDeskState(pub, desk.address as Address)
    }

    if (wake) {
      await enqueueNotification(db, {
        deskId: desk.id,
        kind: 'status',
        // No wording here on purpose. The pinned message is built from the desk's CURRENT state when it is
        // sent, so it can never be a stale sentence written an hour before anyone read it.
        payload: { lastCheck: now.toISOString() },
      })
      // Going live is earned: 24 completed checks in shadow mode, and the report opened.
      if (desk.mode === 'shadow') await bumpShadowChecks(db, desk.id)
      await finishWake(db, wake.id, { status: 'completed', sourceHealth: { rpc: true } })
    }
    return { status: 'completed', records }
  } catch (e) {
    const message = errorText(e)
    if (wake) await finishWake(db, wake.id, { status: 'failed', error: message })
    return { status: 'failed', note: message, records }
  }
}
