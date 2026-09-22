/**
 * The savings vault. Idle cash earns, and nothing the desk needs ever waits on it.
 *
 *   redeem  before the check looks for trades, when the buys arithmetic wants need more cash than the desk
 *           has outside the vault. It refills the cash the desk keeps, so the next buy does not need one too.
 *   sweep   after the check's trades, when part of the owner's cash target sits idle beyond what the desk
 *           keeps, and it would earn well over what the deposit and its later withdrawal cost in network fees.
 *           The operator pays those fees. Cash ABOVE the target is on its way into Stock Tokens, so it is never
 *           swept: parking it would only mean taking it back out, a fee each time, while the desk buys.
 *
 * Plain arithmetic. No model is asked: moving cash between the desk and the vault is not a question of timing,
 * and its value never leaves the desk. It does not count against the owner's limits, exactly as the contract
 * does not count it. Each move is its own record with its own hash on-chain, so "Check it" works the same way.
 *
 * Only a desk acting on its own sweeps. Practice spends nothing, and a desk that asks first is not made to ask
 * about housekeeping. Any desk that holds shares and is not in practice may redeem, because its buys need the cash.
 */
import {
  type DeskState,
  deadlineIn,
  fetchVaultRate,
  isV0Desk,
  previewRedeem,
  previewSweep,
  sharesFor,
  VAULT,
  type VaultRate,
  vaultAssetsOf,
  vaultRoundTripFeeUsdg,
} from '@desk/chain'
import { appendRecord, type deskById, enqueueNotification, setDeskState } from '@desk/db'
import { engineCopy, errorText, type Mandate } from '@desk/shared'
import { type Address, formatUnits } from 'viem'
import type { CommitContext } from './commit'
import { DEADLINE_SECONDS } from './consider'
import { findNeeds, MAX_CANDIDATES_PER_WAKE, MIN_TRADE_USDG } from './needs'
import { buildDecisionBody, RECORD_SCHEMA_VERSION } from './record'
import { USDG_DECIMALS } from './types'
import type { Valuation } from './valuation'
import type { WakeDeps } from './wake'

/** Below this a sweep is never worth a record, whatever the rate. */
export const MIN_SWEEP_USDG = 10_000_000n
/** A sweep must earn, over this many days, several times what it costs. */
export const SWEEP_HORIZON_DAYS = 30
export const SWEEP_FEE_MULTIPLE = 3n
/** Leaving less than this in the vault after a redeem is not worth a second redeem later: take it all. */
const DUST_USDG = 1_000_000n

const usdg = (v: bigint) => formatUnits(v, USDG_DECIMALS)
const usd = (v: bigint) => `$${Number(usdg(v)).toFixed(2)}`
const rateText = (bps: number) => `${(bps / 100).toFixed(2)}%`

/** Cash the desk keeps outside the vault: enough for every buy one check may make. */
export function keepUsdg(state: DeskState, mandate: Mandate): bigint {
  const cap =
    state.perActionCapUsdg < mandate.perActionCapUsdg ? state.perActionCapUsdg : mandate.perActionCapUsdg
  return cap * BigInt(MAX_CANDIDATES_PER_WAKE)
}

/** What the buys arithmetic would want this check if every dollar of cash, in the vault or not, could be spent. */
export function buysWantUsdg(v: Valuation, mandate: Mandate, perActionCapUsdg: bigint): bigint {
  const all = { ...v, cashUsdg: v.cashUsdg + v.vaultUsdg }
  return findNeeds(all, mandate, perActionCapUsdg)
    .slice(0, MAX_CANDIDATES_PER_WAKE)
    .filter((n) => n.candidate.side === 'buy')
    .reduce((sum, n) => sum + n.candidate.amountIn, 0n)
}

export type VaultPlan =
  | { kind: 'sweep' | 'redeem'; usdg: bigint; why: string }
  | { kind: 'none'; why: string }

/** Whether the idle part of the cash target is worth sweeping. Pure. */
export function planSweep(p: {
  looseUsdg: bigint
  vaultUsdg: bigint
  /** The cash the mandate means the desk to hold: its cash weight of what the desk is worth. */
  cashTargetUsdg: bigint
  keepUsdg: bigint
  rate: VaultRate | undefined
  roundTripFeeUsdg: bigint | undefined
}): VaultPlan {
  const loose = p.looseUsdg - p.keepUsdg
  const room = p.cashTargetUsdg - p.keepUsdg - p.vaultUsdg
  const idle = loose < room ? loose : room
  if (idle < MIN_SWEEP_USDG)
    return { kind: 'none', why: `only ${usd(idle > 0n ? idle : 0n)} of the cash target is idle` }
  if (!p.rate || p.roundTripFeeUsdg === undefined)
    return { kind: 'none', why: 'the vault rate or the network fee could not be read' }
  const interest = (idle * BigInt(p.rate.netApyBps) * BigInt(SWEEP_HORIZON_DAYS)) / (10_000n * 365n)
  if (interest < p.roundTripFeeUsdg * SWEEP_FEE_MULTIPLE)
    return {
      kind: 'none',
      why: `${usd(idle)} would earn ${usd(interest)} in ${SWEEP_HORIZON_DAYS} days, against ${usd(p.roundTripFeeUsdg)} in fees`,
    }
  return {
    kind: 'sweep',
    usdg: idle,
    why: engineCopy.vault.sweepWhy(
      usd(idle),
      usd(p.keepUsdg),
      rateText(p.rate.netApyBps),
      usd(interest),
      usd(p.roundTripFeeUsdg),
    ),
  }
}

/** Whether this check's buys need cash out of the vault, and how much. Pure. */
export function planRedeem(p: {
  looseUsdg: bigint
  vaultUsdg: bigint
  buysWantUsdg: bigint
  keepUsdg: bigint
  /** What the vault can pay out right now. undefined when it could not be read: the contract will say. */
  liquidityUsdg: bigint | undefined
}): VaultPlan {
  if (p.vaultUsdg === 0n) return { kind: 'none', why: 'nothing is in the vault' }
  if (p.buysWantUsdg <= p.looseUsdg)
    return { kind: 'none', why: 'the cash outside the vault covers the buys' }
  // Refill to what the desk keeps, which covers every buy one check can make, so the next buy needs no redeem.
  const short = p.buysWantUsdg - p.looseUsdg
  const refill = p.keepUsdg - p.looseUsdg
  let amount = refill > short ? refill : short
  if (amount > p.vaultUsdg) amount = p.vaultUsdg
  if (p.liquidityUsdg !== undefined && amount > p.liquidityUsdg) amount = p.liquidityUsdg
  if (amount < MIN_TRADE_USDG) return { kind: 'none', why: 'the vault cannot pay out enough right now' }
  return {
    kind: 'redeem',
    usdg: amount,
    why: engineCopy.vault.redeemWhy(usd(p.buysWantUsdg), usd(p.looseUsdg)),
  }
}

export interface VaultStepContext {
  desk: NonNullable<Awaited<ReturnType<typeof deskById>>>
  common: CommitContext['common']
  wakeId: string | undefined
  state: DeskState
  mandate: Mandate
  valuation: Valuation
  dry: boolean
  say: (line: string) => void
}

/** A v1 desk, running, active, and not in practice. The one gate every vault move shares. */
function mayMove(ctx: VaultStepContext, deskState: string): boolean {
  return !isV0Desk(ctx.desk.contractVersion) && deskState === 'active' && ctx.desk.mode !== 'shadow'
}

/** Before the trades: takes cash out of the vault when the buys need it. True when money moved. */
export async function redeemForBuys(
  deps: WakeDeps,
  ctx: VaultStepContext,
  deskState: string,
): Promise<boolean> {
  if (!mayMove(ctx, deskState) || ctx.state.vaultShares === 0n) return false
  const want = buysWantUsdg(ctx.valuation, ctx.mandate, ctx.state.perActionCapUsdg)
  const keep = keepUsdg(ctx.state, ctx.mandate)
  if (want <= ctx.state.usdg) return false
  const rate = await fetchVaultRate()
  const plan = planRedeem({
    looseUsdg: ctx.state.usdg,
    vaultUsdg: ctx.valuation.vaultUsdg,
    buysWantUsdg: want,
    keepUsdg: keep,
    liquidityUsdg: rate?.liquidityUsdg,
  })
  if (plan.kind === 'none') {
    ctx.say(`vault: no redeem, ${plan.why}`)
    return false
  }
  return move(deps, ctx, plan, rate, undefined, keep)
}

/** After the trades: parks idle cash in the vault when it pays for itself. True when money moved. */
export async function sweepIdleCash(
  deps: WakeDeps,
  ctx: VaultStepContext,
  deskState: string,
): Promise<boolean> {
  if (!mayMove(ctx, deskState) || ctx.desk.mode !== 'on_its_own') return false
  const keep = keepUsdg(ctx.state, ctx.mandate)
  const cashTargetUsdg = (ctx.valuation.totalUsdg * BigInt(ctx.mandate.targets.cashBps)) / 10_000n
  const base = {
    looseUsdg: ctx.state.usdg,
    vaultUsdg: ctx.valuation.vaultUsdg,
    cashTargetUsdg,
    keepUsdg: keep,
  }
  // Nothing is read from outside unless there is enough idle cash to be worth asking about.
  const first = planSweep({ ...base, rate: { netApyBps: 10_000, liquidityUsdg: 0n }, roundTripFeeUsdg: 0n })
  if (first.kind === 'none') return false
  const [rate, fee] = await Promise.all([
    fetchVaultRate(),
    vaultRoundTripFeeUsdg(deps.pub).catch(() => undefined),
  ])
  const plan = planSweep({ ...base, rate, roundTripFeeUsdg: fee })
  if (plan.kind === 'none') {
    ctx.say(`vault: no sweep, ${plan.why}`)
    return false
  }
  return move(deps, ctx, plan, rate, fee, keep)
}

/** Records one vault move and sends it. The record is committed first, as for every action. */
async function move(
  deps: WakeDeps,
  ctx: VaultStepContext,
  plan: Extract<VaultPlan, { kind: 'sweep' | 'redeem' }>,
  rate: VaultRate | undefined,
  fee: bigint | undefined,
  keep: bigint,
): Promise<boolean> {
  const { db, pub } = deps
  const { desk, state } = ctx
  // A sweep spends USDG and gets shares. A redeem spends shares and gets USDG; asking for a dollar amount rounds
  // the shares up, so when that is more than the desk has, or would leave dust, it redeems everything.
  let amountIn: bigint
  let expectedOut: bigint
  let usdgMoved = plan.usdg
  if (plan.kind === 'sweep') {
    amountIn = plan.usdg
    expectedOut = await previewSweep(pub, amountIn)
  } else {
    const shares = await sharesFor(pub, plan.usdg)
    const all = shares >= state.vaultShares || ctx.valuation.vaultUsdg - plan.usdg < DUST_USDG
    amountIn = all ? state.vaultShares : shares
    expectedOut = await previewRedeem(pub, amountIn)
    usdgMoved = expectedOut
  }
  const deadline = await deadlineIn(pub, DEADLINE_SECONDS)
  const summary =
    plan.kind === 'sweep'
      ? engineCopy.vault.swept(
          usd(usdgMoved),
          rate ? rateText(rate.netApyBps) : 'its current rate',
          usd(keep),
        )
      : engineCopy.vault.redeemed(usd(usdgMoved))
  const [inUnits, outUnits, inUnit] =
    plan.kind === 'sweep' ? ([USDG_DECIMALS, 18, 'USDG'] as const) : ([18, USDG_DECIMALS, 'shares'] as const)
  ctx.say(`vault: ${plan.kind} ${usd(usdgMoved)}. ${plan.why}`)
  if (ctx.dry) return false

  const vaultUsdgNow = await vaultAssetsOf(pub, state.vaultShares)
  const saved = await appendRecord(db, desk.id, (slot) => ({
    record: {
      ...buildDecisionBody({
        ...ctx.common,
        slot,
        state,
        need: null,
        candidate: null,
        deferral: null,
        blockers: [],
        evidence: [
          {
            id: 'v1',
            kind: 'vault',
            vault: VAULT,
            netApyBps: rate?.netApyBps ?? null,
            liquidityUsdg: rate ? usdg(rate.liquidityUsdg) : null,
            roundTripFeeUsdg: fee === undefined ? null : usdg(fee),
            deskCashUsdg: usdg(state.usdg),
            deskVaultUsdg: usdg(vaultUsdgNow),
            keepUsdg: usdg(keep),
          },
        ],
        answer: null,
        gate: null,
        override: null,
        outcome: 'ACTED',
        ask: null,
        preview: null,
      }),
      candidate: {
        id: 'v1',
        side: plan.kind,
        token: VAULT,
        symbol: 'steakUSDG',
        amountIn: formatUnits(amountIn, inUnits),
        amountInUnit: inUnit,
        why: plan.why,
      },
      // Nothing counts against the limits, and the contract sets no floor beyond "something came back".
      gate: { result: 'allow', reasons: [], countedUsdg: '0', oracleFloor: '0' },
      preview: {
        amountIn: formatUnits(amountIn, inUnits),
        expectedOut: formatUnits(expectedOut, outUnits),
        minOut: '0',
        slippageBps: 0,
        deadline,
      },
    },
    schemaVersion: RECORD_SCHEMA_VERSION,
    kind: 'decision',
    ...(ctx.wakeId ? { wakeId: ctx.wakeId } : {}),
    outcome: 'acted',
    mode: desk.mode,
    summary,
    decidedAt: ctx.common.decidedAt,
    // No token and no amount on the row: a vault move is not a trade in any Stock Token, is never graded, and
    // spends nothing against the owner's daily limit.
    side: plan.kind,
    actions: [{ kind: plan.kind, operator: deps.operator, token: VAULT, amountIn, expectedOut, minOut: 0n }],
  }))

  const action = saved.actions[0]
  if (!action) return false
  const sent = await deps
    .send(action, {
      kind: plan.kind,
      desk: desk.address as Address,
      version: desk.contractVersion,
      amountIn,
      deadline,
      decisionHash: saved.recordHash,
    })
    .catch((e) => ({ status: 'refused' as const, code: 'send_failed', detail: errorText(e) }))
  if (sent.status === 'confirmed') {
    if (sent.eventHash.toLowerCase() !== saved.recordHash.toLowerCase())
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
      payload: { summary, decisionId: saved.decision.id, txHash: sent.txHash },
    })
    ctx.say(`  record ${saved.decision.seq}: ACTED. ${summary} tx ${sent.txHash}`)
    return true
  }
  const cause = sent.status === 'refused' ? sent.code : 'reverted_on_chain'
  await enqueueNotification(db, {
    deskId: desk.id,
    decisionId: saved.decision.id,
    kind: 'alert',
    payload: { alert: 'action_failed', cause, text: engineCopy.vault.failed(cause) },
  })
  ctx.say(`  record ${saved.decision.seq}: FAILED ${cause}`)
  return false
}
