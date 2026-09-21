/**
 * One shape for reading a record of ANY version.
 *
 * Records are append-only and versions accumulate, so without this every screen would grow a branch per
 * version and an old record would quietly render as a blank page. That happened: a version 1 record showed
 * "no model was asked" when a model was asked. So each version is normalised here, once, and the difference
 * is stated rather than hidden. A view never invents anything: where a version did not record something,
 * the field is undefined and the screen says so.
 */
import { ZERO_HASH } from '../hashing'
import { DecisionRecordV0, DecisionRecordV1, DecisionRecordV2 } from './record'

export interface PriceView {
  /** The pool's own price at that moment. Version 1 did not record it. */
  poolPrice: string | undefined
  /** What the gap was measured against, and the number itself. */
  referenceLabel: 'this pool at the last close' | 'the last official update'
  referencePrice: string
  referenceAt: string
  gapBps: number
  inLine: boolean
  /** The oracle price the contract's 8% band is measured against. */
  lastOfficialUpdate: string
  lastOfficialUpdateAt: string
  /** How far the pool was from that oracle price. Version 1 measured only this. */
  gapToLastOfficialUpdateBps: number
}

export interface CostView {
  feeTierBps: number
  /** What this exact trade costs against the pool price. Version 1 recorded a table figure instead. */
  costBps: number
  measured: boolean
  quoteOut: string
  quoteOutUnit: string
}

/** Everything both versions record the same way. The evidence and the extras are normalised below. */
type RecordCommon = Omit<DecisionRecordV1, 'evidence' | 'schemaVersion' | 'kind'>

export type RecordView = RecordCommon & {
  version: number
  kind: 'decision' | 'execution'
  price: PriceView | undefined
  cost: CostView | undefined
  session: { session: string; anchored: boolean; nextRegularOpen: string } | undefined
  status: { tradingHalt: boolean | null; oraclePaused: boolean | null; deskPaused: boolean } | undefined
  limits:
    | {
        perActionCapUsdg: string
        remainingTodayUsdg: string
        deskUsdg: string
        deskHolds: string
        countsAgainstLimitsUsdg: string
      }
    | undefined
  news:
    | {
        available: boolean
        count: number
        items: { id: string; source: string; url: string; publishedAt: string }[]
      }
    | undefined
  position: { weightBps: number; targetBps: number; driftBps: number; thresholdBps: number } | undefined
  /** Set only on an execution record. Version 1 had no such thing. */
  approvalOf: NonNullable<DecisionRecordV2['approvalOf']> | undefined
}

type Evidence = DecisionRecordV1['evidence'] | DecisionRecordV2['evidence']

interface NormalisedEvidence {
  price: PriceView | undefined
  cost: CostView | undefined
  session: RecordView['session']
  status: RecordView['status']
  limits: RecordView['limits']
  news: RecordView['news']
  position: RecordView['position']
}

/** Every version's evidence, read the same way. Where a version recorded less, the field is simply missing. */
function normaliseEvidence(evidence: Evidence): NormalisedEvidence {
  const find = <K extends string>(kind: K) =>
    evidence.find((e) => e.kind === kind) as Extract<Evidence[number], { kind: K }> | undefined
  const priceItem = find('price')
  const costItem = find('cost')
  const news = find('news')

  const price: PriceView | undefined = !priceItem
    ? undefined
    : 'poolPrice' in priceItem
      ? {
          poolPrice: priceItem.poolPrice,
          referenceLabel:
            priceItem.reference === 'last_regular_close'
              ? 'this pool at the last close'
              : 'the last official update',
          referencePrice: priceItem.referencePrice,
          referenceAt: priceItem.referenceAt,
          gapBps: priceItem.gapBps,
          inLine: priceItem.inLine,
          lastOfficialUpdate: priceItem.lastOfficialUpdate,
          lastOfficialUpdateAt: priceItem.lastOfficialUpdateAt,
          gapToLastOfficialUpdateBps: priceItem.gapToLastOfficialUpdateBps,
        }
      : {
          // Versions 0 and 1 measured the gap against the oracle price and recorded nothing else.
          poolPrice: undefined,
          referenceLabel: 'the last official update',
          referencePrice: priceItem.feedPrice,
          referenceAt: priceItem.feedUpdatedAt,
          gapBps: priceItem.gapBps,
          inLine: priceItem.inLine,
          lastOfficialUpdate: priceItem.feedPrice,
          lastOfficialUpdateAt: priceItem.feedUpdatedAt,
          gapToLastOfficialUpdateBps: priceItem.gapBps,
        }

  const cost: CostView | undefined = !costItem
    ? undefined
    : 'costBps' in costItem
      ? {
          feeTierBps: costItem.pinnedFeeTier,
          costBps: costItem.costBps,
          measured: true,
          quoteOut: costItem.quoteOut,
          quoteOutUnit: costItem.quoteOutUnit,
        }
      : {
          feeTierBps: costItem.pinnedFeeTier,
          // Earlier versions recorded a round trip at a standard size, not this trade.
          costBps: Math.round(costItem.roundTripBpsAt100 / 2),
          measured: false,
          quoteOut: costItem.quoteOut,
          quoteOutUnit: costItem.quoteOutUnit,
        }

  return {
    price,
    cost,
    session: find('session'),
    status: find('status'),
    limits: find('limits'),
    news: news
      ? {
          available: news.available,
          count: news.count,
          items: news.items.map((i) => ({
            id: i.id,
            source: i.source,
            url: i.url,
            publishedAt: i.publishedAt,
          })),
        }
      : undefined,
    position: find('position'),
  }
}

/** undefined when the body matches no version we know, which is itself worth showing as "cannot be read". */
export function viewRecord(body: unknown): RecordView | undefined {
  const version = (body as { schemaVersion?: unknown } | null)?.schemaVersion
  // Version 0 predates the frozen format and is reshaped into the same view, so early records stay readable.
  if (version === 0) {
    const v0 = DecisionRecordV0.safeParse(body)
    return v0.success ? viewVersionZero(v0.data) : undefined
  }
  const v2 = DecisionRecordV2.safeParse(body)
  const v1 = v2.success ? undefined : DecisionRecordV1.safeParse(body)
  const record = v2.success ? v2.data : v1?.success ? v1.data : undefined
  if (!record) return undefined
  return {
    ...record,
    version: record.schemaVersion,
    ...normaliseEvidence(record.evidence),
    approvalOf: ('approvalOf' in record ? record.approvalOf : undefined) ?? undefined,
  }
}

/** The skeleton's shape, restated in today's words. Everything it never recorded is left empty, not invented. */
function viewVersionZero(record: DecisionRecordV0): RecordView {
  const loose = record as unknown as {
    prevHash?: string
    chain?: { seqBefore: number; headBefore: string }
    candidate?: { amountIn?: unknown; amountInUnit?: unknown; why?: unknown }
    serv?: RecordView['serv']
    gate?: RecordView['gate']
    preview?: RecordView['preview']
  }
  return {
    version: 0,
    kind: 'decision',
    chainId: record.chainId,
    desk: record.desk,
    seq: record.seq,
    prevHash: loose.prevHash ?? ZERO_HASH,
    chain: loose.chain ?? { seqBefore: record.seq - 1, headBefore: ZERO_HASH },
    decidedAt: record.createdAt,
    wake: { scheduledFor: record.createdAt, trigger: record.trigger },
    mode: record.mode as RecordView['mode'],
    // The skeleton ran a fixed candidate, so there was no mandate, no valuation and no drift behind it.
    mandate: null,
    valuation: null,
    need: null,
    deferral: null,
    blockers: [],
    ask: null,
    candidate: record.candidate
      ? {
          id: record.candidate.id,
          side: record.candidate.side,
          token: record.candidate.token,
          symbol: record.candidate.symbol,
          amountIn: String(loose.candidate?.amountIn ?? ''),
          amountInUnit: String(loose.candidate?.amountInUnit ?? ''),
          why: String(loose.candidate?.why ?? ''),
        }
      : null,
    serv: loose.serv ?? null,
    gate: loose.gate ?? null,
    override: record.override ?? null,
    outcome: record.outcome as RecordView['outcome'],
    preview: loose.preview ?? null,
    approvalOf: undefined,
    ...normaliseEvidence(record.evidence),
  }
}
