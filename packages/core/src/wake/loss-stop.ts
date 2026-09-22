/**
 * The loss limit's second step. The first breach stops the desk in software and tells the owner. If the NEXT
 * check is still below the limit, the desk pauses itself on the chain: after that not even a stolen operator
 * key could trade it, and only the owner's wallet can lift the pause (decisions after the research, 5).
 *
 * The pause is its own record, so the record says why the desk stopped, and its transaction is sent through
 * the same write-ahead sender as every other action. It carries no decision hash: `pause()` takes none, so
 * the owner can call it from an explorer with no arguments. The next daily seal covers the record.
 */
import type { DeskCall } from '@desk/chain'
import { addDeskEvent, appendRecord, enqueueNotification } from '@desk/db'
import { engineCopy } from '@desk/shared'
import type { Address } from 'viem'
import type { CommitContext } from './commit'
import type { PlannedOutcome } from './plan'
import { buildDecisionBody, RECORD_SCHEMA_VERSION } from './record'
import type { WakeDeps } from './wake'

export interface PauseOnChainInput {
  desk: CommitContext['desk']
  wakeId: string | undefined
  common: CommitContext['common']
  state: CommitContext['state']
  /** The loss-limit sentence, with the numbers. */
  why: string
  breaches: number
  now: Date
  say: (line: string) => void
}

export async function pauseOnChain(
  deps: WakeDeps,
  input: PauseOnChainInput,
): Promise<{ record: { seq: number; outcome: PlannedOutcome; summary: string }; moved: boolean }> {
  const { db } = deps
  const { desk, now } = input
  const summary = engineCopy.lossLimitPausedOnChain
  const saved = await appendRecord(db, desk.id, (slot) => ({
    record: buildDecisionBody({
      ...input.common,
      slot,
      state: input.state,
      need: null,
      candidate: null,
      deferral: null,
      blockers: [{ rule: 'LOSS_LIMIT', text: engineCopy.blocker.lossLimit(input.why) }],
      evidence: [],
      answer: null,
      gate: null,
      override: null,
      outcome: 'BLOCKED_BY_LIMIT',
      ask: null,
      preview: null,
    }),
    schemaVersion: RECORD_SCHEMA_VERSION,
    ...(input.wakeId ? { wakeId: input.wakeId } : {}),
    outcome: 'blocked_by_limit',
    mode: desk.mode,
    summary,
    decidedAt: now,
    actions: [{ kind: 'pause', operator: deps.operator }],
  }))
  const record = { seq: saved.decision.seq, outcome: 'BLOCKED_BY_LIMIT' as const, summary }
  const action = saved.actions[0]
  const call: DeskCall = { kind: 'pause', desk: desk.address as Address, version: desk.contractVersion }
  const sent = action ? await deps.send(action, call) : undefined
  if (sent?.status === 'confirmed') {
    await addDeskEvent(db, {
      deskId: desk.id,
      kind: 'paused',
      actor: 'desk',
      via: 'worker',
      detail: { onChain: true, txHash: sent.txHash, breaches: input.breaches },
    })
    await enqueueNotification(db, {
      deskId: desk.id,
      decisionId: saved.decision.id,
      kind: 'alert',
      payload: { alert: 'loss_limit_paused_on_chain', text: summary },
      dedupeKey: `loss_pause:${saved.decision.id}`,
    })
    input.say(`PAUSED ON THE CHAIN after ${input.breaches} checks below the loss limit: tx ${sent.txHash}`)
    return { record, moved: true }
  }
  const cause = !sent ? 'no action row' : sent.status === 'refused' ? sent.code : 'reverted_on_chain'
  await enqueueNotification(db, {
    deskId: desk.id,
    decisionId: saved.decision.id,
    kind: 'alert',
    payload: { alert: 'action_failed', text: engineCopy.lossLimitPauseFailed(cause), cause },
    dedupeKey: `loss_pause_failed:${now.toISOString().slice(0, 13)}`,
  })
  input.say(`the on-chain pause did not go through: ${cause}`)
  return { record, moved: false }
}
