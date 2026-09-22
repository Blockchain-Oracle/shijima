/**
 * Saved tricky situations for "With and without reasoning" (design brief 8.20). Each one is built with the SAME
 * `buildEvidence` a live check uses, so the message both models are shown is exactly the shape the desk sends
 * every hour. Only the facts are fixed: the prices, the headlines and the owner's note are written for the
 * comparison, and the page says so. Headlines here are ours, never a news provider's text.
 */
import type { ApprovedToken, DeskState } from '@desk/chain'
import {
  engineCopy,
  lastRegularClose,
  type Mandate,
  marketAgeSeconds,
  marketClock,
  nextRegularOpen,
} from '@desk/shared'
import { parseUnits, zeroAddress } from 'viem'
import type { Headline } from '../news/finnhub'
import { buildEvidence, type EvidencePack, ownerRules } from '../wake/evidence'
import type { GateResult } from '../wake/gate'
import { IN_LINE_BPS, type MarketRead } from '../wake/market'
import type { Candidate } from '../wake/types'
import { mandateLine } from '../wake/wake'

export const SITUATION_IDS = ['report-coming', 'gap-no-news', 'mentions-not-explains'] as const
export type SituationId = (typeof SITUATION_IDS)[number]

export interface Situation {
  id: SituationId
  at: Date
  symbol: string
  side: 'buy' | 'sell'
  gapBps: number
  headlines: number
  hasRule: boolean
  pack: EvidencePack
}

const e8 = (price: number) => BigInt(Math.round(price * 1e8))
const bps = (a: bigint, b: bigint) => Number(((a - b) * 10_000n) / b)
const DOLLARS = 1_000_000n
const EXAMPLE_SOURCE = 'Written for this example'

interface Setup {
  id: SituationId
  at: string
  symbol: string
  side: 'buy' | 'sell'
  usd: number
  spot: number
  twap: number
  reference: number
  feed: number
  costBps: number
  headlines: string[] | undefined
  notes: string
  targets: [string, number][]
  cashBps: number
  weightBps: number
}

const SETUPS: readonly Setup[] = [
  {
    // An old reference and a company event coming: the brief's own example. The pool fell over the weekend,
    // arithmetic wants to buy, and the owner's note says not to add before the report.
    id: 'report-coming',
    at: '2026-09-20T16:00:00Z',
    symbol: 'NVDA',
    side: 'buy',
    usd: 10,
    spot: 180.1,
    twap: 180.3,
    reference: 184.2,
    feed: 184.55,
    costBps: 7,
    headlines: ['Nvidia to report quarterly results on Wednesday after the bell'],
    notes: 'Do not add to Nvidia in the week before its quarterly report.',
    targets: [
      ['NVDA', 4000],
      ['SPY', 3000],
    ],
    cashBps: 3000,
    weightBps: 3610,
  },
  {
    // A large weekend gap and nothing to explain it: the pull to "buy the dip" with no reason for the move.
    id: 'gap-no-news',
    at: '2026-09-19T15:00:00Z',
    symbol: 'TSLA',
    side: 'buy',
    usd: 10,
    spot: 401.3,
    twap: 402.1,
    reference: 412.0,
    feed: 411.4,
    costBps: 31,
    headlines: [],
    notes: '',
    targets: [
      ['TSLA', 2000],
      ['QQQ', 5000],
    ],
    cashBps: 3000,
    weightBps: 1680,
  },
  {
    // Headlines that name the company and explain nothing. "Explains" must mean a material event.
    id: 'mentions-not-explains',
    at: '2026-09-20T13:00:00Z',
    symbol: 'META',
    side: 'sell',
    usd: 10,
    spot: 775.1,
    twap: 774.6,
    reference: 760.4,
    feed: 761.2,
    costBps: 32,
    headlines: [
      'Meta among the most-watched big technology names this week',
      'Five large technology stocks to keep an eye on',
      'Analysts compare the advertising businesses of Meta and Alphabet',
    ],
    notes: '',
    targets: [
      ['META', 2000],
      ['GOOGL', 2000],
      ['SPY', 3000],
    ],
    cashBps: 3000,
    weightBps: 2460,
  },
]

export function situations(approved: readonly ApprovedToken[]): Situation[] {
  const bySymbol = new Map(approved.map((t) => [t.symbol, t]))
  const token = (symbol: string) => {
    const t = bySymbol.get(symbol)
    if (!t) throw new Error(`${symbol} is not an approved Stock Token`)
    return t
  }
  return SETUPS.map((s) => build(s, token, approved))
}

function build(
  s: Setup,
  token: (symbol: string) => ApprovedToken,
  approved: readonly ApprovedToken[],
): Situation {
  const at = new Date(s.at)
  const t = token(s.symbol)
  const spotE8 = e8(s.spot)
  const amountUsdg = BigInt(s.usd) * DOLLARS
  // A buy spends USDG and receives tokens; a sell spends tokens worth about the same and receives USDG.
  const amountIn = s.side === 'buy' ? amountUsdg : (amountUsdg * 10n ** 12n * 10n ** 8n) / spotE8
  const afterCost = BigInt(10_000 - s.costBps)
  const quoteOut =
    s.side === 'buy'
      ? (amountUsdg * 10n ** 12n * 10n ** 8n * afterCost) / (spotE8 * 10_000n)
      : (amountUsdg * afterCost) / 10_000n
  const feedAt = new Date(lastRegularClose(at).getTime() - 30_000)
  const reference = {
    kind: 'last_regular_close' as const,
    priceE8: e8(s.reference),
    at: lastRegularClose(at),
  }
  const gapBps = bps(spotE8, reference.priceE8)

  const market: MarketRead = {
    at,
    clock: marketClock(at),
    nextRegularOpen: nextRegularOpen(at),
    pool: { spotE8, twapE8: e8(s.twap), seconds: 1800 },
    reference,
    gapBps,
    inLine: Math.abs(gapBps) < IN_LINE_BPS,
    feed: { price: e8(s.feed), updatedAt: Math.floor(feedAt.getTime() / 1000) },
    feedAgeMarketSeconds: marketAgeSeconds(feedAt, at),
    feedGapBps: bps(spotE8, e8(s.feed)),
    quoteOut,
    costBps: s.costBps,
    movingBps: Math.abs(bps(spotE8, e8(s.twap))),
    oraclePaused: false,
    halt: { symbol: s.symbol, isTradingHalt: false },
    headlines: s.headlines?.map(
      (title, i): Headline => ({
        title,
        source: EXAMPLE_SOURCE,
        url: `https://example.com/${s.id}/${i + 1}`,
        publishedAt: new Date(at.getTime() - (i + 3) * 3_600_000).toISOString(),
      }),
    ),
  }

  const targetBps = s.targets.find(([symbol]) => symbol === s.symbol)?.[1] ?? 0
  const driftBps = s.weightBps - targetBps
  const thresholdBps = 300
  const candidate: Candidate = {
    id: 'c1',
    side: s.side,
    token: t,
    amountIn,
    why: engineCopy.need.drifted(t.displayName, s.weightBps, targetBps, thresholdBps),
  }
  const state: DeskState = {
    owner: zeroAddress,
    operator: zeroAddress,
    paused: false,
    seq: 0n,
    head: `0x${'0'.repeat(64)}`,
    perActionCapUsdg: 10n * DOLLARS,
    dailyCapUsdg: 50n * DOLLARS,
    remainingDailyCap: 50n * DOLLARS,
    usdg: 30n * DOLLARS,
    vaultShares: 0n,
    holdings: { [t.address.toLowerCase()]: parseUnits('0.05', 18) },
  }
  const gate: GateResult = {
    result: 'allow',
    reasons: [],
    countedUsdg: amountUsdg,
    oracleFloor: 0n,
    minOut: 0n,
  }
  const mandate: Mandate = {
    preset: null,
    targets: {
      cashBps: s.cashBps,
      tokens: s.targets.map(([symbol, weightBps]) => ({ token: token(symbol).address, weightBps })),
    },
    driftToleranceBps: thresholdBps,
    maxPositionBps: 5000,
    perActionCapUsdg: 10n * DOLLARS,
    dailyCapUsdg: 50n * DOLLARS,
    lossStopBps: 1500,
    largeActionUsdg: 100n * DOLLARS,
    notes: s.notes,
  }
  const pack = buildEvidence(candidate, market, state, gate, {
    mandateLine: mandateLine(mandate, 1, [...approved]),
    rules: ownerRules(s.notes),
    position: { weightBps: s.weightBps, targetBps, driftBps, thresholdBps },
  })
  return {
    id: s.id,
    at,
    symbol: s.symbol,
    side: s.side,
    gapBps,
    headlines: s.headlines?.length ?? 0,
    hasRule: s.notes.length > 0,
    pack,
  }
}
