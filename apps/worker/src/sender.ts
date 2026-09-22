/**
 * The only code that sends an operator transaction, and the only code that settles one.
 *
 *   sendAction        sign -> save hash and nonce -> broadcast -> save "sent" -> wait -> settle
 *   resolveUnsettled  run on every start and before every send. For each action that is not settled it asks
 *                     the chain, never memory: a receipt settles it, and with no receipt the landing rule says
 *                     whether it is dead or may still land.
 *
 * The write-ahead order is the point. When the process dies at ANY line below, the database already holds
 * whatever is needed to find out what happened.
 */
import {
  broadcast,
  type DeskCall,
  type DeskOutcome,
  findOutcome,
  OperatorLowGasError,
  type OperatorWallet,
  revertName,
  signDeskCall,
  waitForOutcome,
} from '@desk/chain'
import {
  type ActionRow,
  appendResult,
  type Db,
  markActionPrepared,
  markActionSent,
  resolveAction,
  unresolvedActions,
} from '@desk/db'
import { errorText } from '@desk/shared'
import type { Hex, PublicClient } from 'viem'
import { judgeMissingReceipt } from './landing'

export interface SenderDeps {
  db: Db
  pub: PublicClient
  wallet: OperatorWallet
}

/** Test hooks for the crash drills. Each one is a point where the process can be killed on purpose. */
export interface SendHooks {
  afterPrepared?: () => void
  afterSent?: () => void
}

export type SendResult =
  | { status: 'confirmed'; outcome: Extract<DeskOutcome, { status: 'confirmed' }> }
  | { status: 'reverted'; outcome: Extract<DeskOutcome, { status: 'reverted' }> }
  /** Refused before signing: the contract's simulation said no, or the operator cannot pay for gas. Nothing was sent. */
  | { status: 'refused'; code: string; detail: string }

/** Writes a confirmed or reverted receipt into the database, with the unhashed result details. */
async function settle(db: Db, action: ActionRow, outcome: DeskOutcome): Promise<void> {
  const common = {
    blockNumber: Number(outcome.blockNumber),
    gasUsed: outcome.gasUsed,
    effectiveGasPrice: outcome.effectiveGasPrice,
  }
  if (outcome.status === 'confirmed') {
    await resolveAction(db, action.id, {
      status: 'confirmed',
      chainSeq: Number(outcome.chainSeq),
      ...common,
      ...(outcome.amountOut === undefined ? {} : { actualOut: outcome.amountOut }),
      ...(outcome.feedPrice === undefined ? {} : { feedPriceE8: outcome.feedPrice }),
    })
  } else {
    await resolveAction(db, action.id, { status: 'reverted', ...common, failureCode: 'reverted_on_chain' })
  }
  await appendResult(db, action.decisionId, {
    [`leg${action.leg}`]: {
      kind: action.kind,
      status: outcome.status,
      txHash: outcome.txHash,
      blockNumber: Number(outcome.blockNumber),
      gasUsed: outcome.gasUsed.toString(),
      effectiveGasPrice: outcome.effectiveGasPrice.toString(),
      ...(outcome.status === 'confirmed'
        ? { chainSeq: Number(outcome.chainSeq), amountOut: outcome.amountOut?.toString() ?? null }
        : {}),
    },
  })
}

export async function sendAction(
  deps: SenderDeps,
  action: ActionRow,
  call: DeskCall,
  hooks: SendHooks = {},
): Promise<SendResult> {
  let signed: Awaited<ReturnType<typeof signDeskCall>>
  try {
    signed = await signDeskCall(deps.pub, deps.wallet, call)
  } catch (e) {
    const name = revertName(e)
    const code =
      e instanceof OperatorLowGasError
        ? 'refused:operator_low_gas'
        : name
          ? `refused:${name}`
          : 'refused:simulation_failed'
    // errorText strips the RPC URL: viem puts the whole request, key and all, in its message.
    const detail = errorText(e)
    await resolveAction(deps.db, action.id, {
      status: 'never_landed',
      failureCode: code,
      failureDetail: detail,
    })
    return { status: 'refused', code, detail }
  }

  await markActionPrepared(deps.db, action.id, {
    txHash: signed.txHash,
    nonce: signed.nonce,
    calldataHash: signed.calldataHash,
    ...(signed.deadlineUnix === undefined ? {} : { deadlineUnix: signed.deadlineUnix }),
  })
  hooks.afterPrepared?.()

  await broadcast(deps.pub, signed)
  await markActionSent(deps.db, action.id)
  hooks.afterSent?.()

  const outcome = await waitForOutcome(deps.pub, signed)
  await settle(deps.db, action, outcome)
  return outcome.status === 'confirmed' ? { status: 'confirmed', outcome } : { status: 'reverted', outcome }
}

export interface Settlement {
  actionId: string
  kind: ActionRow['kind']
  recordSeq: number
  txHash: string | null
  was: ActionRow['status']
  now: 'confirmed' | 'reverted' | 'never_landed' | 'waiting'
  why: string
  /** True when a confirmed transaction's on-chain decision hash is not the record's fingerprint. */
  hashMismatch?: boolean
}

/**
 * Settles what it can and reports the rest as `waiting`. The caller must not send anything new for this
 * operator while any action is still waiting: the waiting one may yet land and take its nonce.
 */
export async function resolveUnsettled(deps: SenderDeps, now = new Date()): Promise<Settlement[]> {
  const operator = deps.wallet.account.address.toLowerCase()
  const mine = (await unresolvedActions(deps.db)).filter((u) => u.action.operator === operator)
  if (mine.length === 0) return []

  // Read the chain's clock and the mined nonce FIRST, then look for receipts. In that order, a nonce already
  // counted as mined cannot belong to a receipt that simply had not appeared yet.
  const [block, minedNonce] = await Promise.all([
    deps.pub.getBlock(),
    deps.pub.getTransactionCount({ address: deps.wallet.account.address, blockTag: 'latest' }),
  ])

  const settlements: Settlement[] = []
  for (const { action, recordHash, recordSeq } of mine) {
    const base = {
      actionId: action.id,
      kind: action.kind,
      recordSeq,
      txHash: action.txHash,
      was: action.status,
    }
    const kind = action.kind
    const outcome =
      action.txHash && kind !== 'pause'
        ? await findOutcome(deps.pub, { kind, txHash: action.txHash as Hex })
        : undefined

    if (outcome) {
      await settle(deps.db, action, outcome)
      const hashMismatch =
        outcome.status === 'confirmed' && outcome.eventHash.toLowerCase() !== recordHash.toLowerCase()
      settlements.push({
        ...base,
        now: outcome.status,
        why: `Found on-chain in block ${outcome.blockNumber}.`,
        ...(hashMismatch ? { hashMismatch } : {}),
      })
      continue
    }
    const judged = judgeMissingReceipt({
      status: action.status as 'planned' | 'prepared' | 'sent',
      deadlineUnix: action.deadlineUnix,
      nonce: action.nonce,
      preparedAt: action.preparedAt,
      chainTimeUnix: Number(block.timestamp),
      minedNonce,
      now,
    })
    if (judged.verdict === 'never_landed') {
      await resolveAction(deps.db, action.id, {
        status: 'never_landed',
        failureCode: judged.code,
        failureDetail: judged.why,
      })
      await appendResult(deps.db, action.decisionId, {
        [`leg${action.leg}`]: {
          kind: action.kind,
          status: 'never_landed',
          code: judged.code,
          txHash: action.txHash,
        },
      })
    }
    settlements.push({
      ...base,
      now: judged.verdict === 'wait' ? 'waiting' : 'never_landed',
      why: judged.why,
    })
  }
  return settlements
}
