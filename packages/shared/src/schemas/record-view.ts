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
type RecordCommon = Omit<DecisionRecordV1, 'evidence' | 'schemaVersion' | 'kind' | 'candidate' | 'need'>

type VaultEvidence = Extract<DecisionRecordV2['evidence'][number], { kind: 'vault' }>

export type RecordView = RecordCommon & {
  version: number
  kind: 'decision' | 'execution'
  /** Version 2 widened the side to the savings vault's `sweep` and `redeem`. */
  candidate: DecisionRecordV2['candidate']
  /** Version 2 may name the owner's rule that raised the need. */
  need: DecisionRecordV2['need']
  /** What a vault move was decided on. Only vault moves carry it. */
  vault: Omit<VaultEvidence, 'id' | 'kind'> | undefined
  price: PriceView | undefined
  cost: CostView | undefined
  session: { session: string; anchored: boolean; nextRegularOpen: string } | undefined
  status: { tradingHalt: boolean | null; oraclePaused: boolean | null; deskPaused: boolean } | undefined
  limits:
    | {
        perActionCapUsdg: string
        remainingTodayUsdg: string
        deskUsdg: string
        /** Version 0 recorded neither of these. */
        deskHolds: string | undefined
        countsAgainstLimitsUsdg: string | undefined
      }
    | undefined
  /** A company event near the token. Added 22 Sep; older records have none. */
  event:
    | {
        eventKind: 'earnings' | 'dividend' | 'split' | 'other'
        eventDate: string
        timing: 'bmo' | 'amc' | null
        daysAway: number
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

/**
 * Evidence is read loosely, field by field, whatever version wrote it. Version 0's cost item said
 * `quoteTokenOut`, its limits item had three fields, and a future widening may add more. A field a version did
 * not record comes out undefined; nothing is guessed.
 */
type LooseItem = { id: string; kind: string } & Record<string, unknown>
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined)

interface NormalisedEvidence {
  price: PriceView | undefined
  cost: CostView | undefined
  session: RecordView['session']
  status: RecordView['status']
  limits: RecordView['limits']
  news: RecordView['news']
  position: RecordView['position']
  vault: RecordView['vault']
  event: RecordView['event']
}

function normalisePrice(item: LooseItem | undefined): PriceView | undefined {
  if (!item) return undefined
  const gapBps = num(item.gapBps)
  const inLine = bool(item.inLine)
  if (gapBps === undefined || inLine === undefined) return undefined
  const poolPrice = str(item.poolPrice)
  const referencePrice = str(item.referencePrice)
  const referenceAt = str(item.referenceAt)
  const lastOfficialUpdate = str(item.lastOfficialUpdate)
  const lastOfficialUpdateAt = str(item.lastOfficialUpdateAt)
  const gapToLast = num(item.gapToLastOfficialUpdateBps)
  if (
    poolPrice !== undefined &&
    referencePrice !== undefined &&
    referenceAt !== undefined &&
    lastOfficialUpdate !== undefined &&
    lastOfficialUpdateAt !== undefined &&
    gapToLast !== undefined
  ) {
    return {
      poolPrice,
      referenceLabel:
        item.reference === 'last_regular_close' ? 'this pool at the last close' : 'the last official update',
      referencePrice,
      referenceAt,
      gapBps,
      inLine,
      lastOfficialUpdate,
      lastOfficialUpdateAt,
      gapToLastOfficialUpdateBps: gapToLast,
    }
  }
  // Versions 0 and 1 measured the gap against the oracle price and recorded nothing else.
  const feedPrice = str(item.feedPrice)
  const feedUpdatedAt = str(item.feedUpdatedAt)
  if (feedPrice === undefined || feedUpdatedAt === undefined) return undefined
  return {
    poolPrice: undefined,
    referenceLabel: 'the last official update',
    referencePrice: feedPrice,
    referenceAt: feedUpdatedAt,
    gapBps,
    inLine,
    lastOfficialUpdate: feedPrice,
    lastOfficialUpdateAt: feedUpdatedAt,
    gapToLastOfficialUpdateBps: gapBps,
  }
}

function normaliseCost(item: LooseItem | undefined): CostView | undefined {
  if (!item) return undefined
  const feeTierBps = num(item.pinnedFeeTier)
  // Version 0 named the quote by what came out: tokens for a buy, USDG for a sale.
  const quoteOut = str(item.quoteOut) ?? str(item.quoteTokenOut) ?? str(item.quoteUsdgOut)
  const quoteOutUnit =
    str(item.quoteOutUnit) ??
    (str(item.quoteTokenOut) !== undefined ? 'tokens' : str(item.quoteUsdgOut) !== undefined ? 'USDG' : '')
  if (feeTierBps === undefined || quoteOut === undefined) return undefined
  const costBps = num(item.costBps)
  if (costBps !== undefined) return { feeTierBps, costBps, measured: true, quoteOut, quoteOutUnit }
  const roundTrip = num(item.roundTripBpsAt100)
  if (roundTrip === undefined) return undefined
  // Earlier versions recorded a round trip at a standard size, not this trade.
  return { feeTierBps, costBps: Math.round(roundTrip / 2), measured: false, quoteOut, quoteOutUnit }
}

/** Every version's evidence, read the same way. Where a version recorded less, the field is simply missing. */
function normaliseEvidence(evidence: readonly LooseItem[]): NormalisedEvidence {
  const find = (kind: string) => evidence.find((e) => e.kind === kind)
  const session = find('session')
  const status = find('status')
  const limits = find('limits')
  const position = find('position')
  const news = find('news')
  const vault = find('vault')
  const event = find('event')

  const sessionView =
    session && str(session.session) !== undefined && str(session.nextRegularOpen) !== undefined
      ? {
          session: str(session.session) as string,
          anchored: bool(session.anchored) ?? false,
          nextRegularOpen: str(session.nextRegularOpen) as string,
        }
      : undefined
  const statusView = status
    ? {
        tradingHalt: bool(status.tradingHalt) ?? null,
        oraclePaused: bool(status.oraclePaused) ?? null,
        deskPaused: bool(status.deskPaused) ?? false,
      }
    : undefined
  const limitsView =
    limits &&
    str(limits.perActionCapUsdg) !== undefined &&
    str(limits.remainingTodayUsdg) !== undefined &&
    str(limits.deskUsdg) !== undefined
      ? {
          perActionCapUsdg: str(limits.perActionCapUsdg) as string,
          remainingTodayUsdg: str(limits.remainingTodayUsdg) as string,
          deskUsdg: str(limits.deskUsdg) as string,
          deskHolds: str(limits.deskHolds),
          countsAgainstLimitsUsdg: str(limits.countsAgainstLimitsUsdg),
        }
      : undefined
  const positionView =
    position &&
    num(position.weightBps) !== undefined &&
    num(position.targetBps) !== undefined &&
    num(position.driftBps) !== undefined &&
    num(position.thresholdBps) !== undefined
      ? {
          weightBps: num(position.weightBps) as number,
          targetBps: num(position.targetBps) as number,
          driftBps: num(position.driftBps) as number,
          thresholdBps: num(position.thresholdBps) as number,
        }
      : undefined
  const rawItems = news && Array.isArray(news.items) ? (news.items as Record<string, unknown>[]) : []
  const newsItems = rawItems.flatMap((i) => {
    const id = str(i.id)
    const source = str(i.source)
    const url = str(i.url)
    const publishedAt = str(i.publishedAt)
    return id && source && url && publishedAt ? [{ id, source, url, publishedAt }] : []
  })
  const newsView = news
    ? {
        available: bool(news.available) ?? true,
        count: num(news.count) ?? newsItems.length,
        items: newsItems,
      }
    : undefined
  const vaultView =
    vault && str(vault.vault) !== undefined && str(vault.keepUsdg) !== undefined
      ? {
          vault: str(vault.vault) as string,
          netApyBps: num(vault.netApyBps) ?? null,
          liquidityUsdg: str(vault.liquidityUsdg) ?? null,
          roundTripFeeUsdg: str(vault.roundTripFeeUsdg) ?? null,
          deskCashUsdg: str(vault.deskCashUsdg) ?? '0',
          deskVaultUsdg: str(vault.deskVaultUsdg) ?? '0',
          keepUsdg: str(vault.keepUsdg) as string,
        }
      : undefined
  const eventView =
    event && str(event.eventDate) !== undefined && num(event.daysAway) !== undefined
      ? {
          eventKind: (str(event.eventKind) ?? 'other') as 'earnings' | 'dividend' | 'split' | 'other',
          eventDate: str(event.eventDate) as string,
          timing: (str(event.timing) ?? null) as 'bmo' | 'amc' | null,
          daysAway: num(event.daysAway) as number,
        }
      : undefined

  return {
    price: normalisePrice(find('price')),
    cost: normaliseCost(find('cost')),
    session: sessionView,
    status: statusView,
    limits: limitsView,
    news: newsView,
    position: positionView,
    vault: vaultView,
    event: eventView,
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
    ...normaliseEvidence(record.evidence as LooseItem[]),
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
    ...normaliseEvidence(record.evidence as LooseItem[]),
  }
}
