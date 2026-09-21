/**
 * The walking skeleton: the whole money path, end to end, once, for one fixed candidate.
 *
 *   settle anything an earlier run left unfinished -> read the desk -> read the market -> ask SERV Reasoning
 *   -> check limits -> save the record in the database -> sign -> save the hash -> send -> prove the
 *   on-chain fingerprint matches the record
 *
 *   pnpm desk:skeleton                     ask SERV about a $1 Nvidia buy and do what it says
 *   pnpm desk:skeleton --usdg 2            a different buy size
 *   pnpm desk:skeleton --side sell         ask about selling ALL the Nvidia the desk holds
 *   pnpm desk:skeleton --side sell --tokens 0.002
 *   pnpm desk:skeleton --force             if SERV says wait or decline, trade anyway as a recorded developer override
 *   pnpm desk:skeleton --kill-after-send   crash drill: die right after the transaction is broadcast
 *   pnpm desk:skeleton --kill-before-send  crash drill: die after signing, before anything is broadcast
 *
 * After a crash drill, run `pnpm desk:resolve` (or the skeleton again). It settles the action from the chain.
 *
 * If SERV says wait or decline (and --force is absent) the desk does NOT trade. It seals the non-action on-chain
 * with `checkpoint`, which exercises the same key, gas, receipt and fingerprint path for about a cent.
 *
 * Every step lives in packages/core/wake. This file only puts them in order for a fixed candidate. The real
 * engine adds the steps that come before a candidate exists: valuation, needs, the pre-gate and deferrals.
 */
import { APPROVED_TOKENS, type DeskCall, deadlineIn, EXPLORER, quotePinned, readDeskState } from '@desk/chain'
import {
  askTiming,
  buildDecisionBody,
  buildEvidence,
  type Candidate,
  chainReferenceSource,
  describeCandidate,
  gate,
  OUTCOME_COLUMN,
  plainHeadline,
  planOutcome,
  RECORD_SCHEMA_VERSION,
  readMarket,
  sizedAmount,
  TOKEN_DECIMALS,
  USDG_DECIMALS,
  wantsToAct,
} from '@desk/core'
import { appendRecord, appendResult, finishWake, logServCall, startWake } from '@desk/db'
import { chainHead, errorText, verifyRecord } from '@desk/shared'
import { formatUnits, parseUnits } from 'viem'
import { requireLeader } from '../leader'
import { resolveUnsettled, sendAction } from '../sender'
import { assertChainSeqAgrees, openCli, printSettlements, readDevDesk, registerDevDesk } from './context'

const SLIPPAGE_BPS = 50n

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : (process.argv[i + 1] ?? '')
}
const flag = (name: string) => process.argv.includes(`--${name}`)

/** A crash drill exits hard, with no cleanup, the way a killed process would. */
function dieHere(when: string): never {
  console.log(`CRASH DRILL: dying ${when}. Nothing after this line ran. Now run: pnpm desk:resolve`)
  process.exit(137)
}

async function main() {
  const cli = await openCli()
  const { env, db, pub, deps } = cli
  // One operator key means one sender. The worker holds this lock while it runs.
  const leader = await requireLeader(cli.pool, 'the skeleton')

  // 0. Boot rule: settle what an earlier run left behind BEFORE sending anything new.
  const settled = await resolveUnsettled(deps)
  printSettlements(settled)
  if (settled.some((s) => s.now === 'waiting')) {
    throw new Error('An earlier transaction may still land. Nothing new is sent until it is settled.')
  }

  // 1. reconcile
  const { deployment, state } = await readDevDesk(deps)
  const desk = deployment.devDesk
  const deskRow = await registerDevDesk(db, deployment, state)
  assertChainSeqAgrees(deskRow, state, env.isRehearsal)

  // The fixed candidate. In the engine this comes from `needs`, which is arithmetic over the mandate.
  const token = APPROVED_TOKENS.find((t) => t.symbol === 'NVDA')
  if (!token) throw new Error('NVDA is not on the approved list')
  const held = state.holdings[token.address.toLowerCase()] ?? 0n
  const side = arg('side') === 'sell' ? 'sell' : 'buy'
  const tokensArg = arg('tokens')
  const candidate: Candidate = {
    id: 'c1',
    side,
    token,
    amountIn:
      side === 'buy'
        ? parseUnits(arg('usdg') ?? '1', USDG_DECIMALS)
        : tokensArg
          ? parseUnits(tokensArg, TOKEN_DECIMALS)
          : held,
    why:
      side === 'buy'
        ? 'It moves the desk toward the target weight.'
        : 'It returns the test position to cash.',
  }
  if (candidate.amountIn === 0n) throw new Error(`the desk holds no ${token.symbol} to sell`)

  const now = new Date()
  const wake = await startWake(db, { deskId: deskRow.id, scheduledFor: now, trigger: 'skeleton' })
  if (!wake) throw new Error('a wake for this exact moment already exists')

  // 2. market, 3. evidence
  const market = await readMarket(pub, candidate, now, {
    finnhubKey: process.env.FINNHUB_API_KEY,
    reference: chainReferenceSource(db, pub),
  })
  const gateFor = (amountIn: bigint, quoteOut: bigint) =>
    gate({
      side,
      amountIn,
      quoteOut,
      feedPrice: market.feed.price,
      slippageBps: SLIPPAGE_BPS,
      desk: { ...state, tokenBalance: held },
      gapBps: market.gapBps,
      costBps: market.costBps,
      protective: false,
      tradingHalt: market.halt?.isTradingHalt,
      oraclePaused: market.oraclePaused,
    })
  const fullGate = gateFor(candidate.amountIn, market.quoteOut)
  const pack = buildEvidence(candidate, market, state, fullGate, {
    mandateLine: `MANDATE (skeleton fixture): hold some ${token.displayName}. No owner rules.`,
  })
  console.log(`candidate: ${describeCandidate(candidate, market.quoteOut)}`)

  // 4. decide
  const answer = await askTiming({
    apiKey: env.SERV_API_KEY,
    userMessage: pack.userMessage,
    evidenceIds: pack.evidenceIds,
    ruleIds: [],
  })
  const { serv, problems, decision } = answer
  console.log(
    serv.ok
      ? `SERV: ${serv.value.option} (${serv.value.confidencePercent}%) in ${serv.meta.latencyMs} ms`
      : `SERV failed: ${serv.error}`,
  )
  if (problems.length > 0) console.log(`SERV answer rejected by our checks: ${problems.join('; ')}`)

  // 5. size, then gate the size that would really be sent. A part gets its own fresh quote.
  const override =
    !wantsToAct(decision) && flag('force')
      ? { by: 'developer', reason: 'skeleton test trade forced with --force to prove the trade path' }
      : null
  const amountIn = sizedAmount(candidate.amountIn, decision, override)
  const isPart = amountIn < candidate.amountIn
  const expectedOut = isPart ? await quotePinned(pub, token, side, amountIn) : market.quoteOut
  const finalGate = isPart ? gateFor(amountIn, expectedOut) : fullGate

  // 6. what will actually happen
  // The skeleton always runs as "on its own", with no large-action size, so it never asks.
  const { willAct, outcome } = planOutcome({
    decision,
    gate: finalGate,
    override,
    isPart,
    mode: 'on_its_own',
    largeActionUsdg: 2n ** 128n,
  })
  const deadline = await deadlineIn(pub, 120)
  const summary =
    outcome === 'BLOCKED_BY_LIMIT'
      ? finalGate.reasons.join('; ')
      : (plainHeadline(decision) ?? `No usable decision: ${serv.ok ? problems.join('; ') : serv.error}`)

  // 7 and 8. The record, saved BEFORE anything is signed. The database gives it its place in the desk's chain
  // while holding the desk lock, so this callback only assembles facts that were gathered above.
  const operator = deps.wallet.account.address
  const saved = await appendRecord(db, deskRow.id, (slot) => ({
    record: buildDecisionBody({
      chainId: 4663,
      desk,
      slot,
      state,
      decidedAt: now,
      wake: { scheduledFor: now, trigger: 'skeleton' },
      mode: 'on_its_own',
      // The skeleton has a fixed candidate, so there is no mandate, valuation or need behind it.
      mandate: null,
      valuation: null,
      need: null,
      candidate,
      deferral: null,
      blockers: [],
      evidence: pack.evidence,
      answer,
      gate: finalGate,
      override,
      outcome,
      ask: null,
      preview: willAct ? { amountIn, expectedOut, slippageBps: SLIPPAGE_BPS, deadline } : null,
    }),
    schemaVersion: RECORD_SCHEMA_VERSION,
    wakeId: wake.id,
    outcome: OUTCOME_COLUMN[outcome],
    mode: 'on_its_own',
    summary,
    decidedAt: now,
    token: token.address,
    side,
    amountUsdg: finalGate.countedUsdg,
    ...(decision ? { confidencePercent: decision.confidencePercent } : {}),
    ...(outcome === 'FAILED_NO_DECISION' ? { failureCode: 'no_decision' } : {}),
    private: pack.privateNotes,
    actions: [
      willAct
        ? { kind: side, operator, token: token.address, amountIn, expectedOut, minOut: finalGate.minOut }
        : { kind: 'checkpoint', operator },
    ],
  }))
  const { recordHash } = saved
  const action = saved.actions[0]
  if (!action) throw new Error('the record was saved without its action')
  await logServCall(db, {
    deskId: deskRow.id,
    wakeId: wake.id,
    decisionId: saved.decision.id,
    purpose: serv.meta.purpose,
    promptVersion: serv.meta.promptVersion,
    model: serv.meta.model,
    mode: serv.meta.mode,
    ok: serv.ok,
    error: serv.ok ? null : serv.error,
    rejectedByOurChecks: problems,
    latencyMs: serv.meta.latencyMs,
    totalTokens: serv.meta.totalTokens,
    finishReason: serv.meta.finishReason,
  })
  console.log(`outcome ${outcome}. record ${saved.decision.seq} saved, fingerprint ${recordHash}`)
  if (outcome === 'BLOCKED_BY_LIMIT') console.log(`  blocked: ${finalGate.reasons.join('; ')}`)

  // 9. act: sign, save the hash, broadcast, save "sent", wait, settle
  const call: DeskCall = willAct
    ? {
        kind: side,
        desk,
        version: deskRow.contractVersion,
        token: token.address,
        amountIn,
        minOut: finalGate.minOut,
        deadline,
        decisionHash: recordHash,
      }
    : { kind: 'checkpoint', desk, version: deskRow.contractVersion, decisionHash: recordHash }
  const sent = await sendAction(deps, action, call, {
    ...(flag('kill-before-send') ? { afterPrepared: () => dieHere('after signing, before broadcast') } : {}),
    ...(flag('kill-after-send') ? { afterSent: () => dieHere('right after broadcast') } : {}),
  })
  if (sent.status !== 'confirmed') {
    await finishWake(db, wake.id, {
      status: 'failed',
      error: sent.status === 'refused' ? sent.code : sent.status,
    })
    throw new Error(
      sent.status === 'refused'
        ? `refused before signing, nothing was sent: ${sent.code}. ${sent.detail}`
        : `the transaction reverted on-chain: ${sent.outcome.txHash}`,
    )
  }

  // 10. prove it
  const { outcome: landed } = sent
  const after = await readDeskState(pub, desk)
  const checks = {
    eventHashMatchesRecord: landed.eventHash.toLowerCase() === recordHash.toLowerCase(),
    chainSeqAdvancedByOne: landed.chainSeq === state.seq + 1n,
    headMatches:
      after.head.toLowerCase() === chainHead(state.head, landed.chainSeq, recordHash).toLowerCase(),
    recordInDatabaseVerifies: verifyRecord(saved.decision.record, landed.eventHash),
  }
  await appendResult(db, saved.decision.id, { headAfter: after.head, checks })
  await finishWake(db, wake.id, {
    status: 'completed',
    sourceHealth: { halt: market.halt !== undefined, news: market.headlines !== undefined, serv: serv.ok },
  })

  console.log(
    `${willAct ? (side === 'buy' ? 'BOUGHT' : 'SOLD') : 'SEALED A NON-ACTION'} in tx ${landed.txHash}`,
  )
  if (willAct && landed.amountOut !== undefined) {
    const [gave, got] =
      side === 'buy'
        ? [
            `${formatUnits(amountIn, USDG_DECIMALS)} USDG`,
            `${formatUnits(landed.amountOut, TOKEN_DECIMALS)} ${token.symbol}`,
          ]
        : [
            `${formatUnits(amountIn, TOKEN_DECIMALS)} ${token.symbol}`,
            `${formatUnits(landed.amountOut, USDG_DECIMALS)} USDG`,
          ]
    console.log(`  gave ${gave}, received ${got}`)
  }
  console.log(`  ${EXPLORER}/tx/${landed.txHash}`)
  for (const [name, ok] of Object.entries(checks)) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`)
  await leader.release()
  await cli.close()
  if (Object.values(checks).some((ok) => !ok)) throw new Error('a verification check failed')
}

main().catch((e) => {
  console.error(errorText(e))
  process.exit(1)
})
