/**
 * One check of one desk. Only the worker calls this.
 *
 *   reconcile -> valuation (and the loss limit) -> approved requests -> cash out of the savings vault if the
 *   buys need it -> needs -> for each candidate: consider, record, act -> idle cash into the savings vault
 *
 * With `dry` set it reads, values and asks the model exactly as a real check would, then commits NOTHING and
 * sends NOTHING. It prints what it would have recorded.
 *
 * Non-actions are not sealed here one by one. They join the desk's record chain, and the next action or the
 * daily checkpoint seals every one of them at once, because each record's hash commits to the one before it.
 */
import {
  type ApprovedToken,
  CHAIN_ID,
  type DeskCall,
  isCloneOf,
  readDeskState,
  recordedCallsBetween,
  vaultAssetsOf,
} from '@desk/chain'
import {
  type ActionRow,
  ASSISTANT_REMOVED,
  addDeskEvent,
  appendRecord,
  bumpShadowChecks,
  companyEventsFrom,
  confirmedTradesSince,
  currentMandate,
  type Db,
  deskById,
  didSameTradeSince,
  enqueueNotification,
  ensureDrawdownBaseline,
  expireApprovals,
  finishWake,
  lastConfirmedActionBlock,
  latestDecisionOn,
  latestValueSnapshot,
  mandateFromRow,
  pendingApprovalSince,
  recordDrawdownBreach,
  recordOutsideChanges,
  recordOwnerCalls,
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
import { type CopySource, runCopy } from './copy'
import { pauseOnChain } from './loss-stop'
import { type EventSource, referenceFor } from './market'
import { findNeeds, MAX_CANDIDATES_PER_WAKE, type Need } from './needs'
import { OUTCOME_COLUMN, type PlannedOutcome } from './plan'
import { allPriced, findOutsideChanges, netFlowUsdg, scaledBaseline } from './reconcile'
import { buildDecisionBody, mandateFingerprint, RECORD_SCHEMA_VERSION } from './record'
import { chainReferenceSource } from './reference'
import { USDG_DECIMALS } from './types'
import { readValuation, type Valuation } from './valuation'
import { redeemForBuys, sweepIdleCash, type VaultStepContext } from './vault'

/** The desk will not repeat the same trade on the same token inside this window. A stale read is the usual cause. */
const REPEAT_WINDOW_MS = 10 * 60 * 1000
/** On this many consecutive checks below the loss limit, the desk pauses itself on the chain. */
const ON_CHAIN_PAUSE_AT_BREACH = 2
/**
 * A watching look (trigger `watch`, every five minutes) keeps a value snapshot only this often, unless money moved.
 * The charts and the loss limit need about an hour's resolution, not twelve rows an hour.
 */
const WATCH_SNAPSHOT_MS = 55 * 60 * 1000

/**
 * True for the one watching look each hour that stands for the hour: it counts toward practice and refreshes the
 * pinned Telegram status. Every other look in the hour is silent unless it records something.
 */
const topOfHour = (at: Date) => at.getUTCMinutes() === 0

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
  /**
   * A watching look: it records only what changed. Whichever clock asked (the worker's own `watch`, or OpenServ's
   * `cron` at the top of the hour), a look is watching unless the desk has gone a whole day with no record.
   */
  watch?: boolean
  /**
   * Copy trading (trigger `copy`): the leader's move this check copies. The follower is reconciled and valued as in
   * any check, its approved requests are carried out, and then it makes this one move instead of looking for its own.
   */
  copy?: CopySource
}

export interface WakeReport {
  status: 'completed' | 'skipped' | 'already_ran' | 'failed'
  note?: string
  records: { seq: number | null; outcome: PlannedOutcome; summary: string }[]
}

const usd = (v: bigint) => `$${Number(formatUnits(v, USDG_DECIMALS)).toFixed(2)}`
const pct = (bps: number) => `${(bps / 100).toFixed(1)}%`

export function mandateLine(m: Mandate, version: number, approved: ApprovedToken[]): string {
  const name = (a: string) =>
    approved.find((t) => t.address.toLowerCase() === a.toLowerCase())?.displayName ?? a
  const targets = m.targets.tokens.map((t) => `${name(t.token)} ${pct(t.weightBps)}`).join(', ')
  return `MANDATE v${version}: hold ${targets}, and ${pct(m.targets.cashBps)} cash. A holding may wander ${pct(m.driftToleranceBps)} from its target. No holding above ${pct(m.maxPositionBps)}.`
}

/** The company calendar the worker keeps, as the engine reads it: the soonest event for a token, or nothing. */
export function companyEventSource(db: Db): EventSource {
  return async (token, now) => {
    const today = now.toISOString().slice(0, 10)
    const [next] = await companyEventsFrom(db, today, [token.address])
    if (!next) return undefined
    const daysAway = Math.round(
      (new Date(`${next.eventDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) /
        86_400_000,
    )
    return {
      eventKind: next.kind,
      eventDate: next.eventDate,
      timing: next.timing === 'bmo' || next.timing === 'amc' ? next.timing : null,
      daysAway,
    }
  }
}

/**
 * Explains a chain that is ahead of the database, or says why it cannot be explained. Every call between the
 * database's `chain_seq` and the chain's `seq` must be present, and none may have come from the operator: an
 * operator call the database has no record of is exactly what this check exists to catch.
 */
async function absorbOwnerCalls(
  deps: WakeDeps,
  desk: NonNullable<Awaited<ReturnType<typeof deskById>>>,
  chainSeq: bigint,
  dry: boolean,
  say: (line: string) => void,
): Promise<string | null> {
  const unexplained = engineCopy.trouble.chainAhead(String(chainSeq), desk.chainSeq)
  const fromBlock = BigInt((await lastConfirmedActionBlock(deps.db, desk.id)) ?? 0)
  const calls = await recordedCallsBetween(
    deps.pub,
    desk.address as Address,
    BigInt(desk.chainSeq),
    chainSeq,
    fromBlock,
  )
  const operator = desk.operator.toLowerCase()
  if (BigInt(calls.length) !== chainSeq - BigInt(desk.chainSeq)) return unexplained
  if (calls.some((c) => c.from.toLowerCase() === operator)) return unexplained
  const owner = desk.ownerAddress.toLowerCase()
  say(
    `the owner made ${calls.length} recorded call(s) of their own: ${calls.map((c) => `${c.event} #${c.seq}`).join(', ')}`,
  )
  if (dry) return null
  const absorbed = await recordOwnerCalls(
    deps.db,
    desk.id,
    desk.chainSeq,
    Number(chainSeq),
    calls.map((c) => ({
      seq: Number(c.seq),
      event: c.event,
      txHash: c.txHash.toLowerCase(),
      blockNumber: Number(c.blockNumber),
      by: c.from.toLowerCase() === owner ? ('owner' as const) : ('session' as const),
      from: c.from.toLowerCase(),
      decisionHash: c.decisionHash.toLowerCase(),
      detail: c.detail,
    })),
  )
  return absorbed ? null : unexplained
}

/**
 * The reference price for every token the owner's standing rules name, from the same source every decision
 * uses. Only rule tokens are read: a desk with no rules costs nothing here.
 */
async function ruleReferences(
  pub: PublicClient,
  mandate: Mandate,
  valuation: Valuation,
  now: Date,
  reference: ReturnType<typeof chainReferenceSource>,
): Promise<Record<string, bigint>> {
  const out: Record<string, bigint> = {}
  for (const rule of mandate.rules ?? []) {
    const h = valuation.holdings.find((x) => x.token.address.toLowerCase() === rule.token.toLowerCase())
    if (!h || h.balance === 0n) continue
    try {
      out[rule.token.toLowerCase()] = await referenceFor(
        pub,
        h.token,
        { price: h.feedE8, updatedAt: h.feedUpdatedAt },
        now,
        reference,
      )
    } catch {
      // No reference, no judgment: the rule stays quiet this check rather than firing on a guess.
    }
  }
  return out
}

export async function wakeDesk(deps: WakeDeps, input: WakeInput): Promise<WakeReport> {
  const { db, pub } = deps
  const dry = input.dry === true
  const say = (line: string) => deps.log?.(line)
  const records: WakeReport['records'] = []
  const reference = chainReferenceSource(db, pub)
  const events = companyEventSource(db)

  // A watching look records only what changed. Everything else about a check is the same.
  const watching = input.watch === true || input.trigger === 'watch'
  const desk = await deskById(db, input.deskId)
  if (!desk) throw new Error(`desk ${input.deskId} is not registered`)
  const mandateRow = await currentMandate(db, desk.id)
  if (!mandateRow) return { status: 'skipped', note: 'no mandate has been applied yet', records }
  if (desk.lifecycle !== 'running')
    return { status: 'skipped', note: `the desk is ${desk.lifecycle}`, records }
  // The owner took the assistant away on purpose. There is nothing it may do until they bring it back, so the
  // desk waits quietly instead of recording a failed check every hour.
  if (desk.state === 'needs_attention' && desk.stateReason === ASSISTANT_REMOVED)
    return { status: 'skipped', note: 'the owner removed the assistant', records }
  const mandate = mandateFromRow(mandateRow)
  const mandateRef = { version: mandateRow.version, fingerprint: mandateFingerprint(mandate) }
  const line = mandateLine(mandate, mandateRow.version, deps.approved)

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
    let trouble: string | null = !ours
      ? engineCopy.trouble.notOurDesk
      : state.operator.toLowerCase() !== desk.operator
        ? engineCopy.trouble.operatorRemoved
        : state.owner.toLowerCase() !== desk.ownerAddress
          ? engineCopy.trouble.differentOwner
          : null
    // The chain is ahead of the database. If every call in between came from the owner or the owner's session
    // key, those were the owner's own actions: note them and carry on. Anything else stops the desk as before.
    if (!trouble && Number(state.seq) > desk.chainSeq) {
      trouble = await absorbOwnerCalls(deps, desk, state.seq, dry, say)
    } else if (!trouble && Number(state.seq) !== desk.chainSeq) {
      trouble = engineCopy.trouble.chainAhead(String(state.seq), desk.chainSeq)
    }
    if (trouble) {
      if (!dry) await setDeskState(db, desk.id, 'needs_attention', trouble)
      throw new Error(trouble)
    }

    // 2. valuation, on the pool's 30 minute average
    let valuation = await readValuation(pub, state, mandate, deps.approved, now)
    say(
      `worth ${usd(valuation.totalUsdg)}: cash ${usd(valuation.cashUsdg)} (${pct(valuation.cashWeightBps)})${valuation.holdings.map((h) => `, ${h.token.symbol} ${usd(h.valueUsdg)} (${pct(h.weightBps)} of target ${pct(h.targetBps)})`).join('')}`,
    )

    for (const u of valuation.unpriced) say(`NOT VALUED: ${u.why}`)

    // Money that arrived or left without the desk doing it moves the loss-limit baseline, not the loss.
    // True when something moved that could not be valued, so the desk's worth is not fully known.
    let unpricedFlow = false
    const previous = await latestValueSnapshot(db, desk.id)
    // Priced only when some vault shares are involved, then or now: it is one more read.
    const usdgPerShareE18 =
      previous && (previous.vaultShares > 0n || state.vaultShares > 0n)
        ? await vaultAssetsOf(pub, 10n ** 18n)
        : 0n
    const changes = previous
      ? findOutsideChanges(
          {
            cashUsdg: previous.cashUsdg,
            tokens: Object.fromEntries(
              previous.holdings.map((h) => [h.token.toLowerCase(), BigInt(h.amountRaw)]),
            ),
            vaultShares: previous.vaultShares,
          },
          await confirmedTradesSince(db, desk.id, previous.takenAt),
          { cashUsdg: state.usdg, tokens: state.holdings, vaultShares: state.vaultShares },
          Object.fromEntries(valuation.holdings.map((h) => [h.token.address.toLowerCase(), h.twapE8])),
          usdgPerShareE18,
          // A token nothing values any more is priced at what it was last valued at, so a withdrawal of it
          // never reads as a loss.
          Object.fromEntries(previous.holdings.map((h) => [h.token.toLowerCase(), BigInt(h.priceE8)])),
        )
      : []
    if (changes.length > 0) {
      unpricedFlow = !allPriced(changes)
      say(
        `balances changed outside the desk: ${changes.map((c) => `${c.asset} ${c.delta > 0n ? '+' : ''}${c.delta}`).join(', ')}`,
      )
    }
    if (!dry) {
      const snapshot = snapshotOf(desk.id, valuation, now, state.vaultShares)
      if (changes.length > 0) {
        // The baseline, the note of what happened, and the snapshot that stops it being counted again, all
        // in one transaction. Scaled, not added, so the owner's own money moving never changes how far down
        // the desk is. A change that could not be priced at all makes the baseline UNKNOWN: it is set afresh
        // from the next fully priced valuation instead of being scaled by a number that is not real.
        await recordOutsideChanges(db, {
          deskId: desk.id,
          baselineUsdg: unpricedFlow
            ? null
            : scaledBaseline(
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
      } else if (!watching || !previous || now.getTime() - previous.takenAt.getTime() >= WATCH_SNAPSHOT_MS) {
        await saveValueSnapshot(db, snapshot)
      }
    }

    // The loss limit. A breach stops the desk from acting. The owner restarts it. A baseline made unknown by an
    // unpriced change is only set again once every holding has a price, so it is never a guess.
    const baseline = dry
      ? (desk.drawdownBaselineUsdg ?? valuation.totalUsdg)
      : unpricedFlow || valuation.unpriced.length > 0
        ? (desk.drawdownBaselineUsdg ?? valuation.totalUsdg)
        : await ensureDrawdownBaseline(db, desk.id, valuation.totalUsdg)
    const lossBps =
      baseline > valuation.totalUsdg ? Number(((baseline - valuation.totalUsdg) * 10_000n) / baseline) : 0
    // A price we could not read is not a loss. Judging the limit on a partial valuation could stop the desk
    // over an RPC failure, so while anything is unpriced the limit is not evaluated and the record says so.
    const canJudgeLoss = valuation.unpriced.length === 0 && !unpricedFlow && !dry
    const breached = canJudgeLoss && lossBps >= mandate.lossStopBps
    let deskState = desk.state
    const breaches = dry ? 0 : await recordDrawdownBreach(db, desk.id, breached)
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
    let common = {
      chainId: CHAIN_ID,
      desk: desk.address,
      decidedAt: now,
      wake: { scheduledFor: input.scheduledFor, trigger: input.trigger },
      mode: desk.mode,
      mandate: mandateRef,
      valuation,
    }

    // The second consecutive check still below the loss limit: the desk pauses itself ON THE CHAIN, so even a
    // stolen operator key could not trade it. Only the owner's wallet can lift that.
    if (breached && breaches >= ON_CHAIN_PAUSE_AT_BREACH && deskState !== 'active' && !state.paused && !dry) {
      const paused = await pauseOnChain(deps, {
        desk,
        wakeId: wake?.id,
        common,
        state,
        why: engineCopy.lossLimitReached(
          usd(valuation.totalUsdg),
          lossBps,
          usd(baseline),
          mandate.lossStopBps,
        ),
        breaches,
        now,
        say,
      })
      records.push(paused.record)
      if (paused.moved) state = await readDeskState(pub, desk.address as Address)
    }

    // The owner's own daily limit is counted over a rolling 24 hours, which is stricter than the chain's window.
    // Every action this check confirms is added, so several candidates can never add up past it in one pass.
    const spent = { usdg: await spentSince(db, desk.id, new Date(now.getTime() - 24 * 60 * 60 * 1000)) }

    /** Reads the desk and values it again after money moved, so nothing later in the check works on a stale picture. */
    const refresh = async () => {
      state = await readDeskState(pub, desk.address as Address)
      valuation = await readValuation(pub, state, mandate, deps.approved, now)
      common = { ...common, valuation }
    }

    // What the owner has approved comes first: an approval is permission to act at about the price they were
    // shown, so every minute it waits makes it less true.
    if (!dry) {
      const carried = await runApprovedRequests(
        deps,
        { desk, wakeId: wake?.id, common, state, input },
        {
          mandate,
          spent,
          mandateLine: line,
          deskState,
          stateText,
          valuation,
          now,
          reference,
          events,
          say,
        },
      )
      records.push(...carried.records)
      if (carried.moved) await refresh()
    }

    // Requests the owner never answered have lapsed. Nothing was done, and they are told so. The Telegram
    // message that asked is edited too, so it never keeps live buttons.
    if (!dry) {
      for (const lapsed of await expireApprovals(db, desk.id, now)) {
        await enqueueNotification(db, {
          deskId: desk.id,
          decisionId: lapsed.decisionId,
          kind: 'alert',
          payload: { alert: 'approval_expired', text: engineCopy.approvalExpired },
        })
        await enqueueNotification(db, {
          deskId: desk.id,
          decisionId: lapsed.decisionId,
          kind: 'approval_answered',
          payload: { approvalId: lapsed.id, answer: 'expired' },
        })
      }
    }

    // A copy check makes the leader's one move, and nothing of its own: no vault moves, no needs, no status message.
    if (input.copy) {
      records.push(
        await runCopy(
          deps,
          { desk, wakeId: wake?.id, common, state, input },
          {
            source: input.copy,
            mandate,
            mandateLine: line,
            deskState,
            stateText,
            valuation,
            spent,
            reference,
            events,
            now,
            say,
          },
        ),
      )
      if (wake) await finishWake(db, wake.id, { status: 'completed', sourceHealth: { rpc: true } })
      return { status: 'completed', records }
    }

    // Cash out of the savings vault, when the buys arithmetic wants need more than the desk holds outside it.
    const vaultStep = (): VaultStepContext => ({
      desk,
      common,
      wakeId: wake?.id,
      state,
      mandate,
      valuation,
      dry,
      say,
    })
    if (await redeemForBuys(deps, vaultStep(), deskState)) {
      state = await readDeskState(pub, desk.address as Address)
      // Only cash moved between the desk and the vault, so the valuation is the same apart from where it sits.
      valuation = {
        ...valuation,
        cashUsdg: state.usdg,
        vaultUsdg: await vaultAssetsOf(pub, state.vaultShares),
      }
      common = { ...common, valuation }
    }

    // 3. needs. Arithmetic only. A desk that is not active looks, values, and proposes nothing.
    const references =
      deskState === 'active' ? await ruleReferences(pub, mandate, valuation, now, reference) : {}
    const priceless = () => new Set(valuation.unpriced.map((u) => u.token.address.toLowerCase()))
    const currentNeeds = () =>
      deskState === 'active'
        ? findNeeds(valuation, mandate, state.perActionCapUsdg, references).filter(
            (n) => !priceless().has(n.candidate.token.address.toLowerCase()),
          )
        : []
    let needs = currentNeeds().slice(0, MAX_CANDIDATES_PER_WAKE)
    if (needs.length === 0 && watching) {
      say('nothing to do: a watching look, so nothing is recorded')
    } else if (needs.length === 0) {
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

    // 4. each candidate: consider, record, act. After money moves, the desk is valued again and the remaining
    // candidates are sized on the fresh picture: a sale's freed cash is usable, a just-bought token is not
    // proposed twice. One failing candidate is recorded as such and the rest still get their turn.
    const done = new Set<string>()
    let considered_ = 0
    while (needs.length > 0 && considered_ < MAX_CANDIDATES_PER_WAKE) {
      const need = needs[0] as Need
      needs = needs.slice(1)
      const key = `${need.candidate.side}:${need.candidate.token.address.toLowerCase()}`
      if (done.has(key)) continue
      done.add(key)
      considered_++
      say(
        `${need.candidate.id} ${need.candidate.side.toUpperCase()} ${need.candidate.token.symbol}: ${need.candidate.why}`,
      )
      let moved = false
      try {
        moved = await runCandidate(deps, { desk, wakeId: wake?.id, common, state, input }, need, {
          mandate,
          line,
          deskState,
          stateText,
          valuation,
          spent,
          reference,
          events,
          now,
          dry,
          watching,
          say,
          records,
        })
      } catch (e) {
        const message = errorText(e)
        say(`  ${need.candidate.id} failed: ${message}`)
        if (!dry) {
          const seq = (
            await appendRecord(db, desk.id, (slot) => ({
              record: buildDecisionBody({
                ...common,
                slot,
                state,
                need,
                candidate: need.candidate,
                deferral: null,
                blockers: [],
                evidence: [],
                answer: null,
                gate: null,
                override: null,
                outcome: 'FAILED_NO_DECISION',
                ask: null,
                preview: null,
              }),
              schemaVersion: RECORD_SCHEMA_VERSION,
              ...(wake ? { wakeId: wake.id } : {}),
              outcome: 'failed',
              mode: desk.mode,
              summary: engineCopy.noUsableDecision(message),
              decidedAt: now,
              token: need.candidate.token.address,
              side: need.candidate.side,
              failureCode: 'read_failed',
            }))
          ).decision.seq
          records.push({ seq, outcome: 'FAILED_NO_DECISION', summary: engineCopy.noUsableDecision(message) })
        }
      }
      if (moved) {
        await refresh()
        needs = currentNeeds().filter(
          (n) => !done.has(`${n.candidate.side}:${n.candidate.token.address.toLowerCase()}`),
        )
      }
    }

    // Idle cash into the savings vault, after the trades have taken what they need. Read the state again first:
    // the owner may have paused while the model was thinking.
    const fresh = dry ? desk : await deskById(db, desk.id)
    await sweepIdleCash(deps, vaultStep(), fresh ? (dry ? deskState : fresh.state) : 'needs_attention')

    const recordedSomething = records.some((r) => r.seq !== null)
    if (wake && (!watching || recordedSomething || topOfHour(input.scheduledFor))) {
      await enqueueNotification(db, {
        deskId: desk.id,
        kind: 'status',
        // No wording here on purpose. The pinned message is built from the desk's CURRENT state when it is
        // sent, so it can never be a stale sentence written an hour before anyone read it.
        payload: { lastCheck: now.toISOString() },
      })
      // Going live is earned: 24 hours watched in practice, and the report opened. One look an hour counts, so
      // watching every five minutes cannot shorten it, and a check the owner asked for by hand never counts.
      if (
        desk.mode === 'shadow' &&
        input.trigger !== 'manual' &&
        (!watching || topOfHour(input.scheduledFor))
      )
        await bumpShadowChecks(db, desk.id)
    }
    if (wake) await finishWake(db, wake.id, { status: 'completed', sourceHealth: { rpc: true } })
    return { status: 'completed', records }
  } catch (e) {
    const message = errorText(e)
    if (wake) await finishWake(db, wake.id, { status: 'failed', error: message })
    return { status: 'failed', note: message, records }
  }
}

interface CandidateRun {
  mandate: Mandate
  line: string
  deskState: 'active' | 'paused_by_owner' | 'stopped_by_loss_limit' | 'needs_attention'
  stateText: string
  valuation: Valuation
  spent: { usdg: bigint }
  reference: ReturnType<typeof chainReferenceSource>
  events: EventSource
  now: Date
  dry: boolean
  /** A watching look: an outcome with no model call that only repeats the newest record on this token is not written. */
  watching: boolean
  say: (line: string) => void
  records: WakeReport['records']
}

/** One candidate through consider, record and act. True when money moved. Throws on a read the check could not make. */
async function runCandidate(
  deps: WakeDeps,
  ctx: Parameters<typeof commit>[1],
  need: Need,
  run: CandidateRun,
): Promise<boolean> {
  const { db, pub } = deps
  const { desk } = ctx
  const standing = await standingDeferral(db, desk.id, need.candidate.token.address)
  const askedAt = await pendingApprovalSince(db, desk.id, need.candidate.token.address)
  const held = run.valuation.holdings.find((h) => h.token.address === need.candidate.token.address)
  const repeatedWithinMinutes = await didSameTradeSince(
    db,
    desk.id,
    need.candidate.token.address,
    need.candidate.side,
    new Date(run.now.getTime() - REPEAT_WINDOW_MS),
  )
  let considered = await considerCandidate(
    {
      pub,
      servApiKey: deps.servApiKey,
      finnhubKey: deps.finnhubKey,
      reference: run.reference,
      events: run.events,
      approved: deps.approved,
      state: ctx.state,
      mandate: run.mandate,
      mandateLine: run.line,
      mode: desk.mode,
      deskActive: true,
      deskStateText: run.stateText,
      standing,
      askedAt,
      deskAddress: desk.address as Address,
      holdingUsdg: held?.valueUsdg ?? 0n,
      totalUsdg: run.valuation.totalUsdg,
      spentTodayUsdg: run.spent.usdg,
      cashUsdg: run.valuation.cashUsdg + run.valuation.vaultUsdg,
      repeatedWithinMinutes,
      ...(ctx.input.force ? { force: true } : {}),
      now: run.now,
    },
    need,
  )
  if (considered.answer)
    run.say(
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
  // Watching every five minutes, "still waiting" or "trading is paused" would be written twelve times an hour. When
  // nothing was asked of the model, nothing is being sent or asked, and the newest record on this token already
  // says exactly this, the look leaves the record alone.
  if (run.watching && !considered.answer && !considered.willAct && !considered.ask) {
    // A remembered decision that still stands is itself the record: the wait, or the practice call, already says it.
    const standing = considered.deferral?.status === 'standing'
    const latest = standing ? undefined : await latestDecisionOn(db, desk.id, need.candidate.token.address)
    if (
      standing ||
      (latest &&
        latest.outcome === OUTCOME_COLUMN[considered.outcome] &&
        latest.summary === considered.summary)
    ) {
      run.say(`  unchanged since the last record (${considered.outcome}): nothing written`)
      return false
    }
  }
  if (run.dry) {
    run.records.push({ seq: null, outcome: considered.outcome, summary: considered.summary })
    run.say(`  record (dry): ${considered.outcome}. ${considered.summary}`)
    return false
  }
  const acted = await commit(deps, ctx, considered)
  run.records.push({ seq: acted.seq, outcome: considered.outcome, summary: considered.summary })
  run.say(
    `  record ${acted.seq}: ${considered.outcome}. ${considered.summary}${acted.note ? ` ${acted.note}` : ''}`,
  )
  if (acted.moved) run.spent.usdg += considered.gate.countedUsdg
  return acted.moved
}
