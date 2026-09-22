import { eq, sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { appendRecord } from './queries/records'
import { actions, approvals, desks, mandates, owners } from './schema'
import { draftFor, makeDesk, OPERATOR, openTestDb, randomAddress, TEST_DATABASE_URL } from './testing/context'

/** The data model of docs/ARCHITECTURE.md section 1.7, table for table. */
const ARCHITECTURE_TABLES = [
  'owners',
  'disclosure_acceptances',
  'desks',
  'mandates',
  'wakes',
  'decisions',
  'deferrals',
  'actions',
  'approvals',
  'grades',
  'desk_value_snapshots',
  'cash_flows',
  'fee_accruals',
  'reference_snapshots',
  'price_points',
  'multiplier_events',
  'company_events',
  'desk_token_flags',
  'news_cache',
  'desk_events',
  'telegram_links',
  'notifications',
  'serv_calls',
  'invite_codes',
  'ask_requests',
  'ask_proposals',
  'check_requests',
  'price_alerts',
  'worker_beats',
  'room_posts',
  'takes',
]

const UINT256_MAX = 2n ** 256n - 1n

describe.skipIf(!TEST_DATABASE_URL)('schema guards, enforced by Postgres itself', () => {
  const { db, close } = openTestDb()
  afterAll(close)

  it('migrations alone build exactly the tables the architecture lists', async () => {
    const result = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    )
    expect(result.rows.map((r) => r.table_name).sort()).toEqual([...ARCHITECTURE_TABLES].sort())
  })

  it('stores a full uint256 exactly and gives it back as a bigint', async () => {
    const desk = await makeDesk(db)
    const { actions: planned } = await appendRecord(db, desk.id, (slot) =>
      draftFor(desk, slot, { actions: [{ kind: 'buy', operator: OPERATOR, amountIn: UINT256_MAX }] }),
    )
    const [row] = await db
      .select()
      .from(actions)
      .where(eq(actions.id, planned[0]?.id ?? ''))
    expect(row?.amountIn).toBe(UINT256_MAX)
    expect(typeof row?.amountIn).toBe('bigint')
  })

  it('refuses a negative amount, which JavaScript bigint arithmetic can produce silently', async () => {
    const desk = await makeDesk(db)
    await expect(
      appendRecord(db, desk.id, (slot) =>
        draftFor(desk, slot, { actions: [{ kind: 'buy', operator: OPERATOR, amountIn: 5n - 6n }] }),
      ),
    ).rejects.toThrow()
  })

  it('refuses an address that is not lowercase, and registerDesk lowercases for the caller', async () => {
    await expect(
      db.insert(owners).values({ address: '0xABCDEF0123456789abcdef0123456789ABCDEF01' }),
    ).rejects.toThrow()
    const mixed = `0xAB${randomAddress().slice(4)}`
    const desk = await makeDesk(db)
    const [updated] = await db
      .update(desks)
      .set({ name: 'guard test' })
      .where(eq(desks.id, desk.id))
      .returning()
    expect(updated?.address).toBe(updated?.address.toLowerCase())
    await expect(db.update(desks).set({ operator: mixed }).where(eq(desks.id, desk.id))).rejects.toThrow()
  })

  it('allows only one applied mandate per desk', async () => {
    const desk = await makeDesk(db)
    const mandate = (version: number) => ({
      deskId: desk.id,
      version,
      status: 'applied' as const,
      targets: { cashBps: 10_000, tokens: [] },
      driftToleranceBps: 300,
      maxPositionBps: 4000,
      perActionCapUsdg: 5_000_000n,
      dailyCapUsdg: 15_000_000n,
      lossStopBps: 1500,
      largeActionUsdg: 100_000_000n,
    })
    await db.insert(mandates).values(mandate(1))
    await expect(db.insert(mandates).values(mandate(2))).rejects.toThrow()
    await db.update(mandates).set({ status: 'superseded' }).where(eq(mandates.deskId, desk.id))
    await db.insert(mandates).values(mandate(2))
  })

  it('refuses an approval marked approved that does not say who answered, when and where', async () => {
    const desk = await makeDesk(db)
    const { decision } = await appendRecord(db, desk.id, (slot) => draftFor(desk, slot, { outcome: 'asked' }))
    await expect(
      db.insert(approvals).values({
        deskId: desk.id,
        decisionId: decision.id,
        status: 'approved',
        reason: 'ask_first',
        preview: {},
        expiresAt: new Date(Date.now() + 3_600_000),
      }),
    ).rejects.toThrow()
  })
})
