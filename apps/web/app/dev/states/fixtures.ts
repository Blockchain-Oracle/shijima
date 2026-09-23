/**
 * Fixtures for /dev/states: a desk as `loadDesk` would return it, in every awkward state of design brief 8.16,
 * and a decision of every outcome. Typed against the real `DeskView` and `PublicDecision`, so a fixture cannot
 * drift from what the pages are given. Nothing here reads a database or a chain.
 */
import type { PublicDecision, RecordRow } from '@desk/db'
import { engineCopy } from '@desk/shared'
import type { DeskView } from '@/lib/desk.server'

const NOW = Date.now()
const HOUR = 3_600_000
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * HOUR)
const iso = (hoursAgo: number) => at(hoursAgo).toISOString()
const NVDA = '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC'
const HASH = `0x${'ab'.repeat(32)}`

type Holding = DeskView['holdings'][number]
type Flags = Holding['flags']
const noFlags: Flags = { halted: false, feedMissing: false, beyondBandBps: null, report: null }

export function holding(name: string, symbol: string, flags: Partial<Flags> = {}): Holding {
  return {
    symbol,
    name,
    amount: '0.0203',
    valueUsdg: '4120000',
    weightBps: 4120,
    targetBps: 4000,
    price: { value: '$203.1040', at: iso(0.1) },
    reference: { value: '$202.0000', kind: 'last_regular_close', at: iso(50) },
    gapBps: 55,
    gapToFeedBps: flags.beyondBandBps ?? null,
    spark: [202.4, 202.9, 202.6, 203.3, 203.1],
    flags: { ...noFlags, ...flags },
  }
}

export function decision(
  seq: number,
  outcome: PublicDecision['outcome'],
  summary: string,
  extra: Partial<PublicDecision> = {},
): PublicDecision {
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    seq,
    kind: 'decision',
    schemaVersion: 2,
    outcome,
    mode: 'ask_first',
    shadow: false,
    token: NVDA.toLowerCase(),
    side: 'buy',
    amountUsdg: 5_000_000n,
    confidencePercent: 72,
    summary,
    failureCode: null,
    record: {},
    recordHash: HASH,
    prevHash: HASH,
    result: null,
    sealedByTx: null,
    sealedAt: null,
    decidedAt: at(seq),
    ...extra,
  }
}

const entries = (...ds: PublicDecision[]): RecordRow[] => ds.map((d) => ({ kind: 'entry', decision: d }))

export function desk(overrides: {
  desk?: Partial<DeskView['desk']>
  plate?: DeskView['plate']
  holdings?: Holding[]
  approvals?: DeskView['approvals']
  record?: RecordRow[]
  notes?: DeskView['notes']
}): DeskView {
  return {
    isOwner: true,
    slug: 'fixture',
    owner: '0x0000000000000000000000000000000000000001',
    desk: {
      id: '00000000-0000-4000-8000-000000000000',
      name: 'Fixture agent',
      address: '0x0000000000000000000000000000000000000002',
      mode: 'ask_first',
      state: 'active',
      stateReason: null,
      lifecycle: 'running',
      assistantRemoved: false,
      contractVersion: 'v1',
      shareSlug: null,
      shadowChecks: 30,
      goLiveChecks: 24,
      reportOpened: true,
      startedAt: iso(240),
      lastCheckAt: iso(0.3),
      nextCheckAt: new Date(Math.ceil(NOW / HOUR) * HOUR).toISOString(),
      telegramLinked: false,
      ...overrides.desk,
    },
    limitsInUse: {
      spentTodayUsdg: '1440000',
      lossStop: { stopAtUsdg: '8500000', roomUsdg: '1500000', roomBps: 1500 },
    },
    plate:
      overrides.plate === undefined
        ? {
            totalUsdg: '10000000',
            cashUsdg: '980000',
            vaultUsdg: '2000000',
            vaultRateBps: 400,
            cashBps: 2980,
            takenAt: iso(0.3),
            priceSource: 'pool_twap_30m',
            baselineUsdg: '10000000',
            sinceReopenUsdg: '-120000',
            reopenedAt: iso(30),
          }
        : overrides.plate,
    holdings: overrides.holdings ?? [holding('Nvidia', 'NVDA')],
    mandate: {
      preset: null,
      presetId: null,
      targets: [{ symbol: 'NVDA', weightBps: 4000 }],
      rules: [],
      cashTargetBps: 3000,
      driftToleranceBps: 300,
      maxPositionBps: 5000,
      lossStopBps: 1500,
      perActionCapUsdg: '10000000',
      dailyCapUsdg: '50000000',
      largeActionUsdg: '100000000',
      notes: '',
      version: 1,
    },
    approvals: overrides.approvals ?? [],
    record: overrides.record ?? [],
    notes: overrides.notes ?? [],
    history: [],
    flows: [],
    earlier: null,
    tokenSymbols: {},
    markers: [],
    timing: { live: { usdg: '0', decisions: 0 }, practice: { usdg: '0', decisions: 0 } },
    feeUsdg: '0',
    turns: [],
    agent: { waits: [], total: 0, acted: 0, waited: 0, latest: null },
  }
}

/** Every outcome the record can hold, each with the kind of sentence the engine writes for it. */
export const OUTCOME_ROWS: RecordRow[] = entries(
  decision(1, 'acted', 'Bought $5.00 of Nvidia: the pool is in line with the reference and the cost is low.'),
  decision(2, 'acted_in_part', 'Bought half now; the rest waits for the reopen because the pool is thin.'),
  decision(
    3,
    'acted_by_override',
    'Bought on your call. The agent had chosen to wait; every limit still held.',
  ),
  decision(4, 'waited', 'Waiting for the market to reopen: the weekend price is not anchored.'),
  decision(5, 'declined', 'Declined: your note says not to add before the report.'),
  decision(6, 'nothing_to_do', 'Nothing needed: every holding is inside its tolerance.'),
  decision(7, 'blocked_by_limit', 'Wanted to buy $12.00; your per-action limit is $10.00.'),
  decision(8, 'asked', 'Asked you first, because you asked to be asked.'),
  decision(
    9,
    'failed',
    'Failed: the assistant’s wallet is short of ETH for the network fee. Nothing was sent; it retries at the next check.',
    {
      failureCode: 'operator_low_gas',
    },
  ),
  decision(10, 'would_have_acted', 'In practice: it would have bought $5.00 of Nvidia now.', {
    shadow: true,
    mode: 'shadow',
  }),
  decision(11, 'not_executed', engineCopy.approvalExpired),
  decision(12, 'waited', 'In practice: waiting for the reopen.', { shadow: true, mode: 'shadow' }),
)

export const FIXTURE_TIMES = { at, iso, NVDA }
