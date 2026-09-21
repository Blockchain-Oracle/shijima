/**
 * Commits what `consider` decided: the record, every row that must exist with it, and then the action itself.
 *
 * The record and its companions (a remembered wait, an approval request, an outbox message) are written in ONE
 * transaction, so none can exist without the others. Sending happens after that commit, never inside it, so
 * the write-ahead rule holds: whatever happens to the process, the database already knows what was intended.
 * An "acted" message is only queued once the transaction has really confirmed.
 */
import type { readDeskState } from '@desk/chain'
import {
  appendRecord,
  createApproval,
  createDeferral,
  type deskById,
  endDeferral,
  enqueueNotification,
  logServCall,
  markApprovalExecuted,
  setDeskState,
} from '@desk/db'
import { engineCopy, nextRegularOpen } from '@desk/shared'
import type { Address } from 'viem'
import type { Considered } from './consider'
import { OUTCOME_COLUMN } from './plan'
import { type ApprovalOf, buildDecisionBody, RECORD_SCHEMA_VERSION } from './record'
import { PRICE_SOURCE, type Valuation } from './valuation'
import type { WakeDeps, WakeInput } from './wake'

const REVISIT_AFTER_OPEN_MS = 30 * 60 * 1000

/** The value snapshot row for this moment. Pure, so it can be written inside someone else's transaction. */
export function snapshotOf(deskId: string, v: Valuation, now: Date) {
  return {
    deskId,
    kind: 'hourly' as const,
    takenAt: now,
    totalUsdg: v.totalUsdg,
    cashUsdg: v.cashUsdg,
    vaultUsdg: v.vaultUsdg,
    priceSource: PRICE_SOURCE,
    holdings: v.holdings.map((h) => ({
      token: h.token.address,
      amountRaw: h.balance.toString(),
      priceE8: h.twapE8.toString(),
      valueUsdg: h.valueUsdg.toString(),
    })),
  }
}

export interface CommitContext {
  desk: NonNullable<Awaited<ReturnType<typeof deskById>>>
  wakeId: string | undefined
  common: Pick<
    Parameters<typeof buildDecisionBody>[0],
    'chainId' | 'desk' | 'decidedAt' | 'wake' | 'mode' | 'mandate' | 'valuation'
  >
  state: Awaited<ReturnType<typeof readDeskState>>
  input: WakeInput
  /** Set when this record carries out a request the owner approved. */
  approval?: { id: string; of: ApprovalOf } | undefined
}

/** Saves the record and everything that must exist with it, then acts if the desk is acting. */
export async function commit(
  deps: WakeDeps,
  ctx: CommitContext,
  k: Considered,
): Promise<{ seq: number; moved: boolean; note?: string }> {
  const { db } = deps
  const { desk } = ctx
  const c = k.need.candidate
  const expiresAt = new Date(ctx.input.scheduledFor.getTime() + 60 * 60 * 1000)

  const saved = await appendRecord(db, desk.id, (slot) => ({
    record: buildDecisionBody({
      ...ctx.common,
      slot,
      state: ctx.state,
      need: k.need,
      candidate: c,
      ...(ctx.approval ? { approvalOf: ctx.approval.of } : {}),
      deferral: k.deferral
        ? {
            decisionSeq: k.deferral.baseline.decisionSeq,
            decidedAt: k.deferral.baseline.decidedAt,
            stillStanding: k.deferral.status === 'standing',
            endedBecause: k.deferral.endedBecause,
          }
        : null,
      blockers: k.blockers,
      evidence: k.pack.evidence,
      answer: k.answer,
      gate: k.gate,
      override: k.override ?? null,
      outcome: k.outcome,
      ask: k.ask,
      preview: k.preview,
    }),
    schemaVersion: RECORD_SCHEMA_VERSION,
    // The row mirrors the body, so a listing can filter on it without opening every record.
    kind: ctx.approval ? 'execution' : 'decision',
    ...(ctx.wakeId ? { wakeId: ctx.wakeId } : {}),
    outcome: OUTCOME_COLUMN[k.outcome],
    mode: desk.mode,
    summary: k.summary,
    decidedAt: ctx.common.decidedAt,
    token: c.token.address,
    side: c.side,
    amountUsdg: k.gate.countedUsdg,
    ...(k.answer?.decision ? { confidencePercent: k.answer.decision.confidencePercent } : {}),
    ...(k.outcome === 'FAILED_NO_DECISION' ? { failureCode: 'no_decision' } : {}),
    private: k.pack.privateNotes,
    actions:
      k.willAct && k.preview
        ? [
            {
              kind: c.side,
              operator: deps.operator,
              token: c.token.address,
              amountIn: k.preview.amountIn,
              expectedOut: k.preview.expectedOut,
              minOut: k.gate.minOut,
            },
          ]
        : [],
    // Rows that must exist if and only if this record does. Same transaction.
    alongside: async (tx, decision) => {
      if (ctx.approval) await markApprovalExecuted(tx, ctx.approval.id, decision.id)
      if (k.deferral && k.deferral.status !== 'standing') {
        await endDeferral(tx, k.deferral.row.id, k.deferral.status, k.deferral.endedBecause ?? '')
      }
      if (k.newDeferralBaseline) {
        await createDeferral(tx, {
          deskId: desk.id,
          decisionId: decision.id,
          token: c.token.address,
          side: c.side,
          revisitAt: new Date(nextRegularOpen(ctx.common.decidedAt).getTime() + REVISIT_AFTER_OPEN_MS),
          baseline: { ...k.newDeferralBaseline, decisionSeq: decision.seq },
        })
      }
      const message = {
        token: c.token.address,
        symbol: c.token.symbol,
        side: c.side,
        summary: k.summary,
        decisionId: decision.id,
      }
      if (k.ask) {
        await createApproval(tx, {
          deskId: desk.id,
          decisionId: decision.id,
          reason: k.ask,
          preview: (decision.record.preview ?? {}) as Record<string, unknown>,
          expiresAt,
        })
        await enqueueNotification(tx, {
          deskId: desk.id,
          decisionId: decision.id,
          kind: k.ask === 'large_action' ? 'large_action_request' : 'approval_request',
          payload: { ...message, expiresAt: expiresAt.toISOString() },
        })
      }
      if (k.outcome === 'WOULD_HAVE_ACTED') {
        await enqueueNotification(tx, {
          deskId: desk.id,
          decisionId: decision.id,
          kind: 'would_have',
          payload: message,
        })
      }
      // A notable non-action: waiting while a holding is well off target, or refusing to touch a held token.
      const notable =
        (k.outcome === 'WAITED' && !k.deferral && Math.abs(k.need.driftBps) >= 2 * k.need.thresholdBps) ||
        (k.outcome === 'DECLINED' && k.blockers.length > 0)
      if (notable) {
        const cause = k.blockers[0]?.rule ?? 'WAIT'
        await enqueueNotification(tx, {
          deskId: desk.id,
          decisionId: decision.id,
          kind: 'not_acted',
          payload: message,
          dedupeKey: `${c.token.address.toLowerCase()}:${cause}:${ctx.common.decidedAt.toISOString().slice(0, 10)}`,
        })
      }
    },
  }))

  if (k.answer) {
    const m = k.answer.serv.meta
    await logServCall(db, {
      deskId: desk.id,
      wakeId: ctx.wakeId ?? null,
      decisionId: saved.decision.id,
      purpose: m.purpose,
      promptVersion: m.promptVersion,
      model: m.model,
      mode: m.mode,
      ok: k.answer.serv.ok,
      error: k.answer.serv.ok ? null : k.answer.serv.error,
      rejectedByOurChecks: k.answer.problems,
      latencyMs: m.latencyMs,
      totalTokens: m.totalTokens,
      finishReason: m.finishReason,
    })
  }

  const action = saved.actions[0]
  if (!k.willAct || !action || !k.preview || k.preview.deadline === null)
    return { seq: saved.decision.seq, moved: false }

  const sent = await deps.send(action, {
    kind: c.side,
    desk: desk.address as Address,
    token: c.token.address,
    amountIn: k.preview.amountIn,
    minOut: k.gate.minOut,
    deadline: k.preview.deadline,
    decisionHash: saved.recordHash,
  })
  const message = {
    token: c.token.address,
    symbol: c.token.symbol,
    side: c.side,
    summary: k.summary,
    decisionId: saved.decision.id,
  }
  if (sent.status === 'confirmed') {
    const matches = sent.eventHash.toLowerCase() === saved.recordHash.toLowerCase()
    if (!matches)
      await setDeskState(
        db,
        desk.id,
        'needs_attention',
        engineCopy.trouble.hashMismatch(sent.txHash, saved.decision.seq),
      )
    await enqueueNotification(db, {
      deskId: desk.id,
      decisionId: saved.decision.id,
      kind: 'acted',
      payload: { ...message, txHash: sent.txHash, amountOut: sent.amountOut?.toString() ?? null },
    })
    return {
      seq: saved.decision.seq,
      moved: true,
      note: `tx ${sent.txHash}${matches ? '' : ' HASH MISMATCH'}`,
    }
  }
  const cause = sent.status === 'refused' ? sent.code : 'reverted_on_chain'
  await enqueueNotification(db, {
    deskId: desk.id,
    decisionId: saved.decision.id,
    kind: 'alert',
    payload: { ...message, alert: 'action_failed', cause },
  })
  return { seq: saved.decision.seq, moved: false, note: `FAILED: ${cause}` }
}
