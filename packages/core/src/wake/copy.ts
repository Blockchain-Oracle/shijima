/**
 * Copy trading (D4): a follower makes its leader's move, as a share of its own value.
 *
 *   the leader's move, read from its hashed record -> the same share of the follower -> the follower's own limits,
 *   cash and largest holding cut it down -> market -> the follower's pre-gate and gate -> its mode: practice
 *   records "would have", ask first asks, on its own acts through the same sender
 *
 * No model is asked. The leader's decision was the judgment; the follower chose to copy it. Everything that keeps
 * the follower's money safe still runs on the follower's own numbers, and the contract's caps sit under all of it.
 *
 * A move the follower cannot make is recorded as a MISSED copy with its reason. Nothing is ever traded on a guess.
 * Each leader move gets exactly one record per follower: the unique index on (desk, copied_from_decision_id) makes
 * a second attempt fail before anything is planned, so a restart can never copy the same move twice.
 */
import { type ApprovedToken, deadlineIn, readTokenConfig } from '@desk/chain'
import { appendRecord, type Db } from '@desk/db'
import { copyTradeCopy, engineCopy, type Mandate } from '@desk/shared'
import { type Address, formatUnits, parseUnits } from 'viem'
import { type CommitContext, commit } from './commit'
import { type Considered, DEADLINE_SECONDS, SLIPPAGE_BPS } from './consider'
import { buildEvidence, ownerRules, structuredRules } from './evidence'
import { gate } from './gate'
import { type EventSource, readMarket } from './market'
import { MIN_TRADE_USDG, type Need, SELL_HEADROOM_BPS, sellAmountFor, thresholdBps } from './needs'
import { OUTCOME_COLUMN, type PlannedOutcome } from './plan'
import { pregate } from './pregate'
import { buildDecisionBody, RECORD_SCHEMA_VERSION } from './record'
import type { ReferenceSource } from './reference'
import { type Side, TOKEN_DECIMALS, USDG_DECIMALS } from './types'
import type { Valuation } from './valuation'
import type { WakeDeps } from './wake'

const PPM = 1_000_000n
/** A leader that sold at least this share of a holding sold all of it. The follower sells all of its own. */
const ALL_PPM = 999_000n

const usd = (v: bigint) => `$${Number(formatUnits(v, USDG_DECIMALS)).toFixed(2)}`
const min = (a: bigint, b: bigint) => (a < b ? a : b)

/** One leader move, as the follower's copy step needs it. */
export interface CopySource {
  leaderDecisionId: string
  /** "Tech Momentum #41": the leader's name and the record number of the move. */
  leaderLabel: string
  side: Side
  /** Lowercase contract address. */
  token: string
  /** The move as parts per million: of the leader's whole value for a buy, of its holding for a sell. */
  sharePpm: bigint
}

/**
 * The leader's move as a share, from its own hashed record: what it put in, against what it was worth (a buy) or
 * what it held of that token (a sell) when it decided. `amountIn` is the confirmed transaction's own amount, or the
 * record's preview for a practice "would have". Returns why not when the record cannot say.
 */
export function leaderShare(p: {
  side: Side
  token: string
  record: Record<string, unknown>
  amountIn: bigint | null
}): { sharePpm: bigint } | { error: string } {
  const valuation = p.record.valuation as
    | { totalUsdg?: string; holdings?: { token: string; balance: string }[] }
    | null
    | undefined
  const preview = p.record.preview as { amountIn?: string } | null | undefined
  const inDecimals = p.side === 'buy' ? USDG_DECIMALS : TOKEN_DECIMALS
  const amountIn = p.amountIn ?? (preview?.amountIn ? parseUnits(preview.amountIn, inDecimals) : null)
  if (!amountIn || amountIn <= 0n) return { error: 'the leader record has no amount' }
  if (p.side === 'buy') {
    const total = valuation?.totalUsdg ? parseUnits(valuation.totalUsdg, USDG_DECIMALS) : 0n
    if (total <= 0n) return { error: 'the leader record has no value' }
    return { sharePpm: min((amountIn * PPM) / total, PPM) }
  }
  const held = valuation?.holdings?.find((h) => h.token.toLowerCase() === p.token.toLowerCase())
  const balance = held ? parseUnits(held.balance, TOKEN_DECIMALS) : 0n
  if (balance <= 0n) return { error: 'the leader record shows no holding of that token' }
  return { sharePpm: min((amountIn * PPM) / balance, PPM) }
}

export type CopySize =
  | { ok: true; amountIn: bigint; usdg: bigint; sharePpm: bigint; cut: string | null }
  | { ok: false; why: string }

/**
 * The follower's share of the leader's move, cut down to the follower's own per-action and daily limits, its loose
 * cash and its largest-holding limit. Pure. A copy that ends up below the smallest trade is not made.
 */
export function sizeCopy(p: {
  source: Pick<CopySource, 'side' | 'sharePpm'>
  token: ApprovedToken
  valuation: Valuation
  state: { usdg: bigint; perActionCapUsdg: bigint; remainingDailyCap: bigint }
  mandate: Mandate
  spentTodayUsdg: bigint
}): CopySize {
  const { valuation: v, mandate, state, token } = p
  const reason = copyTradeCopy.reason
  const cuts = copyTradeCopy.cut
  const perAction = min(state.perActionCapUsdg, mandate.perActionCapUsdg)
  const leftToday = min(state.remainingDailyCap, mandate.dailyCapUsdg - p.spentTodayUsdg)
  const held = v.holdings.find((h) => h.token.address.toLowerCase() === token.address.toLowerCase())
  // Each limit that may cut the copy down, and the words for it. The smallest one binds.
  const bind = (want: bigint, limits: [bigint, string][]) =>
    limits.reduce<{ usdg: bigint; cut: string | null }>(
      (acc, [limit, why]) => (limit < acc.usdg ? { usdg: limit < 0n ? 0n : limit, cut: why } : acc),
      { usdg: want, cut: null },
    )

  if (p.source.side === 'buy') {
    const want = (v.totalUsdg * p.source.sharePpm) / PPM
    if (want < MIN_TRADE_USDG) return { ok: false, why: reason.tooSmall(usd(want), usd(MIN_TRADE_USDG)) }
    const room = (v.totalUsdg * BigInt(mandate.maxPositionBps)) / 10_000n - (held?.valueUsdg ?? 0n)
    const { usdg, cut } = bind(want, [
      [perAction, cuts.perAction],
      [leftToday, cuts.daily],
      [state.usdg, cuts.cash],
      [room, cuts.position],
    ])
    if (usdg < MIN_TRADE_USDG) {
      const why =
        cut === cuts.cash
          ? reason.noCash
          : cut === cuts.daily
            ? reason.dailyLimitUsed
            : cut === cuts.position
              ? reason.fullPosition(token.displayName)
              : reason.tooSmall(usd(usdg), usd(MIN_TRADE_USDG))
      return { ok: false, why }
    }
    const sharePpm = v.totalUsdg > 0n ? (usdg * PPM) / v.totalUsdg : 0n
    return { ok: true, amountIn: usdg, usdg, sharePpm, cut }
  }

  if (!held || held.balance === 0n || held.twapE8 === 0n)
    return { ok: false, why: reason.noHolding(token.displayName) }
  const all = p.source.sharePpm >= ALL_PPM
  const want = all ? held.valueUsdg : (held.valueUsdg * p.source.sharePpm) / PPM
  if (want < MIN_TRADE_USDG) return { ok: false, why: reason.tooSmall(usd(want), usd(MIN_TRADE_USDG)) }
  // A sell counts at the larger of what comes back and the oracle value, so it keeps the same headroom under a
  // limit that the engine's own sells keep.
  const headroom = (limit: bigint) => (limit * (10_000n - BigInt(SELL_HEADROOM_BPS))) / 10_000n
  const { usdg, cut } = bind(want, [
    [headroom(perAction), cuts.perAction],
    [headroom(leftToday), cuts.daily],
  ])
  if (usdg < MIN_TRADE_USDG) {
    return {
      ok: false,
      why: cut === cuts.daily ? reason.dailyLimitUsed : reason.tooSmall(usd(usdg), usd(MIN_TRADE_USDG)),
    }
  }
  const amountIn = cut
    ? sellAmountFor(held, cut === cuts.perAction ? perAction : leftToday)
    : all
      ? held.balance
      : (held.balance * p.source.sharePpm) / PPM
  if (amountIn === 0n) return { ok: false, why: reason.noHolding(token.displayName) }
  return { ok: true, amountIn, usdg, sharePpm: (amountIn * PPM) / held.balance, cut }
}

export interface CopyRun {
  source: CopySource
  mandate: Mandate
  mandateLine: string
  deskState: 'active' | 'paused_by_owner' | 'stopped_by_loss_limit' | 'needs_attention'
  stateText: string
  valuation: Valuation
  spent: { usdg: bigint }
  reference: ReferenceSource
  events: EventSource
  now: Date
  say: (line: string) => void
}

export type CopyRecord = { seq: number; outcome: PlannedOutcome; summary: string }

/** Called by the wake when its input carries a copy: the follower's one record for the leader's move. */
export async function runCopy(deps: WakeDeps, ctx: CommitContext, run: CopyRun): Promise<CopyRecord> {
  const { source } = run
  const token = deps.approved.find((t) => t.address.toLowerCase() === source.token)
  const missedEarly = (why: string) => appendMissed(deps, ctx, source, why)
  if (!token) return missedEarly(copyTradeCopy.reason.notApproved(source.token))
  if (run.valuation.unpriced.some((u) => u.token.address.toLowerCase() === source.token)) {
    return missedEarly(
      copyTradeCopy.reason.couldNotCheck(`the price of ${token.displayName} could not be read`),
    )
  }
  const size = sizeCopy({
    source,
    token,
    valuation: run.valuation,
    state: ctx.state,
    mandate: run.mandate,
    spentTodayUsdg: run.spent.usdg,
  })
  if (!size.ok) return missedEarly(size.why)

  const held = run.valuation.holdings.find((h) => h.token.address.toLowerCase() === source.token)
  const candidate = {
    id: 'c1',
    side: source.side,
    token,
    amountIn: size.amountIn,
    why: copyTradeCopy.why(source.leaderLabel, source.side, token.displayName, source.sharePpm),
  }
  const need: Need = {
    candidate,
    driftBps: held?.driftBps ?? 0,
    thresholdBps: held ? thresholdBps(held, run.mandate) : run.mandate.driftToleranceBps,
    limitedByPerAction: size.cut !== null,
  }
  // News is the leader's judgment to make, not the follower's: no model is asked here, so it is not read.
  const [market, onChain] = await Promise.all([
    readMarket(deps.pub, candidate, run.now, {
      finnhubKey: undefined,
      reference: run.reference,
      events: run.events,
    }),
    readTokenConfig(deps.pub, ctx.desk.address as Address, token.address),
  ])
  const checked = gate({
    side: source.side,
    amountIn: size.amountIn,
    quoteOut: market.quoteOut,
    feedPrice: market.feed.price,
    slippageBps: SLIPPAGE_BPS,
    desk: { ...ctx.state, tokenBalance: held?.balance ?? 0n },
    mandate: {
      perActionCapUsdg: run.mandate.perActionCapUsdg,
      dailyCapUsdg: run.mandate.dailyCapUsdg,
      spentTodayUsdg: run.spent.usdg,
    },
    gapBps: market.gapBps,
    costBps: market.costBps,
    protective: false,
    position: {
      holdingUsdg: held?.valueUsdg ?? 0n,
      totalUsdg: run.valuation.totalUsdg,
      maxPositionBps: run.mandate.maxPositionBps,
    },
    tradingHalt: market.halt?.isTradingHalt,
    oraclePaused: market.oraclePaused,
  })
  const blockers = pregate({
    candidate,
    market,
    deskActive: run.deskState === 'active',
    deskStateText: run.stateText,
    beyondBand: checked.reasons.includes(engineCopy.gate.beyondBand),
    onChain,
    // The unique copy key already stops the same move being made twice.
    repeatedWithinMinutes: false,
    protective: false,
  }).filter((b) => b.rule !== 'NEWS_UNAVAILABLE')
  const targetBps = held?.targetBps ?? 0
  const pack = buildEvidence(candidate, market, ctx.state, checked, {
    mandateLine: run.mandateLine,
    rules: [...ownerRules(run.mandate.notes), ...structuredRules(run.mandate.rules, deps.approved)],
    position: {
      weightBps: need.driftBps + targetBps,
      targetBps,
      driftBps: need.driftBps,
      thresholdBps: need.thresholdBps,
    },
  })

  // The follower's own mode ladder, the same one every decision uses, with the leader's move in place of the model's
  // "act now".
  const label = source.leaderLabel
  const name = token.displayName
  const value = usd(source.side === 'buy' ? size.amountIn : checked.countedUsdg)
  const blocked = blockers[0]
  let outcome: PlannedOutcome
  let ask: Considered['ask'] = null
  let summary: string
  if (blocked) {
    outcome = 'DECLINED'
    summary = copyTradeCopy.missed(label, blocked.text)
  } else if (checked.result === 'deny') {
    outcome = 'BLOCKED_BY_LIMIT'
    summary = copyTradeCopy.missed(label, `${checked.reasons.join('; ')}.`)
  } else if (ctx.desk.mode === 'shadow') {
    outcome = 'WOULD_HAVE_ACTED'
    summary = copyTradeCopy.wouldHave(label, source.side, name, value)
  } else if (ctx.desk.mode === 'ask_first' || checked.countedUsdg >= run.mandate.largeActionUsdg) {
    outcome = 'ASKED'
    ask = ctx.desk.mode === 'ask_first' ? 'ask_first' : 'large_action'
    summary = copyTradeCopy.asked(label, source.side, name, value)
  } else {
    outcome = size.cut ? 'ACTED_IN_PART' : 'ACTED'
    summary =
      copyTradeCopy.acted(label, source.side, name, value, size.sharePpm) +
      (size.cut ? copyTradeCopy.inPart(size.cut) : '')
  }
  const willAct = outcome === 'ACTED' || outcome === 'ACTED_IN_PART'
  const wanted = willAct || outcome === 'ASKED' || outcome === 'WOULD_HAVE_ACTED'
  const considered: Considered = {
    need,
    market,
    pack,
    gate: checked,
    blockers,
    answer: null,
    outcome,
    ask,
    willAct,
    override: null,
    summary,
    preview: wanted
      ? {
          amountIn: size.amountIn,
          expectedOut: market.quoteOut,
          slippageBps: SLIPPAGE_BPS,
          deadline: willAct ? await deadlineIn(deps.pub, DEADLINE_SECONDS) : null,
        }
      : null,
    deferral: null,
    newDeferralBaseline: null,
  }
  const done = await commit(deps, { ...ctx, copiedFrom: source.leaderDecisionId }, considered)
  if (done.moved) run.spent.usdg += checked.countedUsdg
  run.say(`copy record ${done.seq}: ${outcome}. ${summary}${done.note ? ` ${done.note}` : ''}`)
  return { seq: done.seq, outcome, summary }
}

/** A missed copy, inside a wake that has already valued the desk. */
function appendMissed(
  deps: WakeDeps,
  ctx: CommitContext,
  source: CopySource,
  why: string,
): Promise<CopyRecord> {
  return writeMissed(deps.db, {
    deskId: ctx.desk.id,
    mode: ctx.desk.mode,
    wakeId: ctx.wakeId,
    common: ctx.common,
    state: ctx.state,
    source,
    why,
  })
}

export async function writeMissed(
  db: Db,
  m: {
    deskId: string
    mode: CommitContext['desk']['mode']
    wakeId: string | undefined
    common: CommitContext['common']
    state: CommitContext['state']
    source: CopySource
    why: string
  },
): Promise<CopyRecord> {
  const summary = copyTradeCopy.missed(m.source.leaderLabel, m.why)
  const saved = await appendRecord(db, m.deskId, (slot) => ({
    record: buildDecisionBody({
      ...m.common,
      slot,
      state: m.state,
      need: null,
      candidate: null,
      deferral: null,
      blockers: [{ rule: 'COPY_MISSED', text: m.why }],
      evidence: [],
      answer: null,
      gate: null,
      override: null,
      outcome: 'DECLINED',
      ask: null,
      preview: null,
    }),
    schemaVersion: RECORD_SCHEMA_VERSION,
    ...(m.wakeId ? { wakeId: m.wakeId } : {}),
    copiedFromDecisionId: m.source.leaderDecisionId,
    outcome: OUTCOME_COLUMN.DECLINED,
    mode: m.mode,
    summary,
    decidedAt: m.common.decidedAt,
    token: m.source.token,
    side: m.source.side,
  }))
  return { seq: saved.decision.seq, outcome: 'DECLINED', summary }
}
