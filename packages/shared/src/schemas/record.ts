/**
 * The decision record. Versions are APPEND ONLY.
 *
 * This is the body that gets hashed and fixed on-chain, so its shape is a public promise: anyone must be able
 * to read an old record years from now. Every object is strict, so an extra or missing field fails here,
 * BEFORE the record is hashed or anything is sent. To change the shape, add a new version beside the others.
 * Never edit a version in place: records already made with it must always parse against it. WIDENING is
 * therefore allowed at any time, such as adding a value to an enum or a new nullable field, because every old
 * record still parses. Narrowing, renaming or removing is not, and needs a new version.
 *
 *   version 0  2026-09-20  the walking skeleton, never frozen. Two real records exist in it.
 *   version 1  2026-09-20  the engine's first shape. The gap was measured against the Chainlink feed.
 *   version 2  2026-09-20  the gap is measured against the pool's own price at the last regular close, the feed
 *                          is shown beside it as the last official update, cost is measured for the exact trade
 *                          instead of read from a table, and a record can be an `execution`: what the desk did
 *                          when the owner approved a request, carrying `approvalOf`. Widened once on the same
 *                          day, before any real desk had made a version 2 record. Nothing was rewritten.
 *                          Widened 22 Sep for the savings vault: a candidate can be a `sweep` or a `redeem`, and
 *                          the evidence can hold a `vault` item. Every earlier record still parses.
 *
 * A field that does not apply is null, never absent, so its absence is visible. Amounts are decimal strings.
 * Basis points, counts and seconds are integers. There are no floats anywhere in a record.
 */
import { z } from 'zod'
import { TimingDecision } from './timing'

const Hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/)
const Address = z.string().regex(/^0x[0-9a-fA-F]{40}$/)
const Decimal = z.string().regex(/^\d+(\.\d+)?$/, 'must be a plain decimal string')
const Iso = z.iso.datetime()
const Int = z.number().int()

export const RecordOutcome = z.enum([
  'ACTED',
  'ACTED_IN_PART',
  'ACTED_BY_OVERRIDE',
  'WOULD_HAVE_ACTED',
  'ASKED',
  'WAITED',
  'DECLINED',
  'NOTHING_TO_DO',
  'BLOCKED_BY_LIMIT',
  'FAILED_NO_DECISION',
  /** The owner approved a request, but by the time the desk looked again it no longer stood. */
  'NOT_EXECUTED',
])

const Session = z.strictObject({
  id: z.string(),
  kind: z.literal('session'),
  session: z.string(),
  anchored: z.boolean(),
  nextRegularOpen: Iso,
})
const Status = z.strictObject({
  id: z.string(),
  kind: z.literal('status'),
  tradingHalt: z.boolean().nullable(),
  oraclePaused: z.boolean().nullable(),
  deskPaused: z.boolean(),
})
const News = z.strictObject({
  id: z.string(),
  kind: z.literal('news'),
  available: z.boolean(),
  count: Int,
  // Licence: a hash of each headline, never its text. Source, time and link are public.
  items: z.array(
    z.strictObject({
      id: z.string(),
      source: z.string(),
      url: z.string(),
      publishedAt: z.string(),
      titleHash: Hash,
    }),
  ),
})
const Limits = z.strictObject({
  id: z.string(),
  kind: z.literal('limits'),
  perActionCapUsdg: Decimal,
  remainingTodayUsdg: Decimal,
  deskUsdg: Decimal,
  deskHolds: Decimal,
  countsAgainstLimitsUsdg: Decimal,
})
const Position = z.strictObject({
  id: z.string(),
  kind: z.literal('position'),
  weightBps: Int,
  targetBps: Int,
  driftBps: Int,
  thresholdBps: Int,
})
const PriceV1 = z.strictObject({
  id: z.string(),
  kind: z.literal('price'),
  gapBps: Int,
  inLine: z.boolean(),
  feedPrice: Decimal,
  feedUpdatedAt: Iso,
  feedAgeMarketSeconds: Int,
})
const CostV1 = z.strictObject({
  id: z.string(),
  kind: z.literal('cost'),
  pinnedFeeTier: Int,
  roundTripBpsAt100: Int,
  quoteOut: Decimal,
  quoteOutUnit: z.string(),
})
const PriceV2 = z.strictObject({
  id: z.string(),
  kind: z.literal('price'),
  poolPrice: Decimal,
  poolAverage30m: Decimal,
  /** What the gap is measured against: the pool's own price at the last regular close, or the feed while the market is open. */
  reference: z.enum(['last_regular_close', 'last_official_update']),
  referencePrice: Decimal,
  referenceAt: Iso,
  gapBps: Int,
  inLine: z.boolean(),
  lastOfficialUpdate: Decimal,
  lastOfficialUpdateAt: Iso,
  lastOfficialUpdateAgeMarketSeconds: Int,
  gapToLastOfficialUpdateBps: Int,
})
const CostV2 = z.strictObject({
  id: z.string(),
  kind: z.literal('cost'),
  pinnedFeeTier: Int,
  /** Measured for this exact trade against the pool's own price: the fee plus what its size moves the price. */
  costBps: Int,
  quoteOut: Decimal,
  quoteOutUnit: z.string(),
})

/** What the desk saw. The model is shown exactly these items and may cite only their ids. */
export const EvidenceItemV1 = z.discriminatedUnion('kind', [
  Session,
  PriceV1,
  CostV1,
  Status,
  News,
  Limits,
  Position,
])
/**
 * What a vault move was decided on: the rate and the cash that can be taken out, both from Morpho's API, the
 * network fee a round trip costs, and the cash the desk keeps loose for its own buys. Added 22 Sep.
 */
const Vault = z.strictObject({
  id: z.string(),
  kind: z.literal('vault'),
  vault: Address,
  /** What the vault pays a year after its fees. null when Morpho's API could not be read. */
  netApyBps: Int.nullable(),
  liquidityUsdg: Decimal.nullable(),
  /** One deposit and one later redeem, in network fees, at today's gas price. */
  roundTripFeeUsdg: Decimal.nullable(),
  deskCashUsdg: Decimal,
  deskVaultUsdg: Decimal,
  /** Cash kept outside the vault so the desk's own buys never wait on it. */
  keepUsdg: Decimal,
})

/** A company event near this token: a report date, a dividend or a split. Added 22 Sep. Only the date, never Finnhub's text. */
const Event = z.strictObject({
  id: z.string(),
  kind: z.literal('event'),
  eventKind: z.enum(['earnings', 'dividend', 'split', 'other']),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timing: z.enum(['bmo', 'amc']).nullable(),
  daysAway: Int,
})

export const EvidenceItemV2 = z.discriminatedUnion('kind', [
  Session,
  PriceV2,
  CostV2,
  Status,
  News,
  Limits,
  Position,
  Vault,
  Event,
])

/**
 * Version 0: the walking skeleton's shape, from before the format was frozen. It is DESCRIBED here rather
 * than prescribed, so it is deliberately not strict: nothing new is ever written in this shape, and the two
 * records that exist in it are real trades on mainnet whose fingerprints are already on-chain. They must stay
 * readable for ever. It has `createdAt` and `trigger` where later versions have `decidedAt` and `wake`, and it
 * predates the mandate, the valuation and the blockers.
 */
/** Version 0's evidence, described loosely: its cost item said `quoteTokenOut` and its limits item had fewer fields. */
const EvidenceItemV0 = z.looseObject({ id: z.string(), kind: z.string() })

export const DecisionRecordV0 = z.looseObject({
  schemaVersion: z.literal(0),
  kind: z.literal('decision'),
  chainId: Int,
  desk: Address,
  seq: Int.min(1),
  createdAt: Iso,
  trigger: z.string(),
  mode: z.string(),
  candidate: z
    .looseObject({ id: z.string(), side: z.enum(['buy', 'sell']), token: Address, symbol: z.string() })
    .nullable()
    .optional(),
  evidence: z.array(EvidenceItemV0),
  serv: z.looseObject({}).nullable().optional(),
  gate: z
    .looseObject({ result: z.enum(['allow', 'deny']), reasons: z.array(z.string()) })
    .nullable()
    .optional(),
  override: z.looseObject({ by: z.string(), reason: z.string() }).nullable().optional(),
  outcome: z.string(),
  preview: z.looseObject({}).nullable().optional(),
})
export type DecisionRecordV0 = z.infer<typeof DecisionRecordV0>

export const DecisionRecordV1 = z.strictObject({
  schemaVersion: z.literal(1),
  kind: z.literal('decision'),
  // The desk and chain are inside the hash, so a fingerprint belongs to exactly one desk.
  chainId: Int,
  desk: Address,
  seq: Int.min(1),
  prevHash: Hash,
  /** The contract's own counter and head as they stood when this was decided. */
  chain: z.strictObject({ seqBefore: Int, headBefore: Hash }),
  decidedAt: Iso,
  wake: z.strictObject({ scheduledFor: Iso, trigger: z.string() }),
  mode: z.enum(['shadow', 'ask_first', 'on_its_own']),
  mandate: z.strictObject({ version: Int, fingerprint: Hash }).nullable(),
  valuation: z
    .strictObject({
      priceSource: z.string(),
      totalUsdg: Decimal,
      cashUsdg: Decimal,
      vaultUsdg: Decimal,
      holdings: z.array(
        z.strictObject({
          token: Address,
          symbol: z.string(),
          balance: Decimal,
          priceUsdg: Decimal,
          lastOfficialUpdate: Decimal,
          valueUsdg: Decimal,
          weightBps: Int,
          targetBps: Int,
        }),
      ),
    })
    .nullable(),
  need: z.strictObject({ driftBps: Int, thresholdBps: Int, limitedByPerActionLimit: z.boolean() }).nullable(),
  candidate: z
    .strictObject({
      id: z.string(),
      side: z.enum(['buy', 'sell']),
      token: Address,
      symbol: z.string(),
      amountIn: Decimal,
      amountInUnit: z.string(),
      why: z.string(),
    })
    .nullable(),
  deferral: z
    .strictObject({
      decisionSeq: Int,
      decidedAt: Iso,
      stillStanding: z.boolean(),
      endedBecause: z.string().nullable(),
    })
    .nullable(),
  blockers: z.array(z.strictObject({ rule: z.string(), text: z.string() })),
  evidence: z.array(EvidenceItemV1),
  serv: z
    .strictObject({
      promptVersion: z.string(),
      model: z.string(),
      mode: z.enum(['serv', 'raw']),
      latencyMs: Int,
      totalTokens: Int.nullable(),
      finishReason: z.string().nullable(),
      error: z.string().nullable(),
      rejectedByOurChecks: z.array(z.string()),
      /** Words from the product's voice list that the model used anyway. Recorded, never a reason to refuse. */
      styleWordsUsed: z.array(z.string()).optional(),
      // `headline` arrived with timing.v2. Records made under timing.v1 do not have it.
      decision: TimingDecision.extend({ headline: z.string().optional() }).strict().nullable(),
    })
    .nullable(),
  gate: z
    .strictObject({
      result: z.enum(['allow', 'deny']),
      reasons: z.array(z.string()),
      countedUsdg: Decimal,
      oracleFloor: Decimal,
    })
    .nullable(),
  override: z.strictObject({ by: z.string(), reason: z.string() }).nullable(),
  outcome: RecordOutcome,
  ask: z.enum(['ask_first', 'large_action']).nullable(),
  preview: z
    .strictObject({
      amountIn: Decimal,
      expectedOut: Decimal,
      minOut: Decimal,
      slippageBps: Int,
      deadline: Int.nullable(),
    })
    .nullable(),
})
export type DecisionRecordV1 = z.infer<typeof DecisionRecordV1>

export const DecisionRecordV2 = DecisionRecordV1.extend({
  schemaVersion: z.literal(2),
  /** `execution` is what the desk did after the owner approved a request. It carries `approvalOf`. */
  kind: z.enum(['decision', 'execution']),
  evidence: z.array(EvidenceItemV2),
  /** Widened 22 Sep: `sweep` parks idle cash in the savings vault and `redeem` takes it back out. */
  candidate: z
    .strictObject({
      id: z.string(),
      side: z.enum(['buy', 'sell', 'sweep', 'redeem']),
      token: Address,
      symbol: z.string(),
      amountIn: Decimal,
      amountInUnit: z.string(),
      why: z.string(),
    })
    .nullable(),
  /** Set only on an execution: the request being carried out, and who answered it, when and where. */
  approvalOf: z
    .strictObject({
      decisionSeq: Int,
      /** Widened 21 Sep: `owner_override` is "do it anyway" from the chat. Every older record still parses. */
      askedBecause: z.enum(['ask_first', 'large_action', 'owner_override']),
      answeredAt: Iso,
      answeredVia: z.enum(['telegram', 'web', 'chat']),
      /** How far the fresh quote moved from what the owner was shown. */
      movedBps: Int,
    })
    .nullable()
    // Optional, not only nullable: sixteen real version 2 records were written before this field existed, and a
    // widening must leave every record already fixed on-chain readable.
    .optional(),
  /** Widened 22 Sep: `rule` names the owner's standing instruction that raised this need, when one did. */
  need: z
    .strictObject({
      driftBps: Int,
      thresholdBps: Int,
      limitedByPerActionLimit: z.boolean(),
      rule: z
        .strictObject({ id: z.string(), kind: z.literal('price_move_sell') })
        .nullable()
        .optional(),
    })
    .nullable(),
}).strict()
export type DecisionRecordV2 = z.infer<typeof DecisionRecordV2>

const VERSIONS = { 0: DecisionRecordV0, 1: DecisionRecordV1, 2: DecisionRecordV2 } as const
export const LATEST_RECORD_VERSION = 2

/**
 * Plain sentences naming each place a body breaks the shape of the version it claims to be.
 * Empty means it conforms. A version this code does not know is itself a problem.
 */
export function checkRecord(body: unknown): string[] {
  const version = (body as { schemaVersion?: unknown } | null)?.schemaVersion
  const schema = typeof version === 'number' ? VERSIONS[version as keyof typeof VERSIONS] : undefined
  if (!schema) return [`schemaVersion ${String(version)} is not a known record version`]
  const parsed = schema.safeParse(body)
  if (parsed.success) return []
  return parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
}
