import { readQualification } from '@desk/shared'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { desks, deskValueSnapshots, wakes } from '../schema'
import { draftFor, makeDesk, openTestDb, TEST_DATABASE_URL } from '../testing/context'
import {
  completedChecksOf,
  deskByShareSlug,
  deskRecord,
  isQuiet,
  lastCheckOf,
  latestDecisionOf,
  sharedDesks,
  valueHistory,
} from './public'
import { appendRecord, recordChain, verifyChain } from './records'

describe.skipIf(!TEST_DATABASE_URL)('visible records and current values', () => {
  const { db, close } = openTestDb()
  afterAll(close)

  it('makes published beta agents public regardless of the legacy sharing flag, excluding unfinished drafts', async () => {
    const desk = await makeDesk(db)
    const slug = `public-${desk.id}`
    await db
      .update(desks)
      .set({ lifecycle: 'running', shareEnabled: false, shareSlug: slug })
      .where(eq(desks.id, desk.id))
    expect((await deskByShareSlug(db, desk.id))?.id).toBe(desk.id)
    expect((await deskByShareSlug(db, slug))?.id).toBe(desk.id)
    expect((await sharedDesks(db)).some((d) => d.id === desk.id)).toBe(true)
    const draft = await makeDesk(db)
    expect(await deskByShareSlug(db, draft.id)).toBeUndefined()
    expect((await sharedDesks(db)).some((d) => d.id === draft.id)).toBe(false)
  })

  it('retains quiet records and finds the last real decision beyond the recent feed', async () => {
    const desk = await makeDesk(db)
    const first = await appendRecord(db, desk.id, (slot) => draftFor(desk, slot, { outcome: 'acted' }))
    for (let i = 0; i < 81; i++)
      await appendRecord(db, desk.id, (slot) =>
        i % 2 === 0
          ? draftFor(desk, slot)
          : draftFor(desk, slot, { outcome: 'waited' }, { deferral: { stillStanding: true } }),
      )
    const recent = await deskRecord(db, desk.id, { limit: 80 })
    expect(recent).toHaveLength(80)
    expect(recent.every(isQuiet)).toBe(true)
    expect((await latestDecisionOf(db, desk.id))?.id).toBe(first.decision.id)
    expect(verifyChain(await recordChain(db, desk.id))).toEqual([])
  }, 15000)

  it('counts completed checks separately from decisions and exposes validated qualification metadata', async () => {
    const desk = await makeDesk(db)
    const qualification = {
      summary: 'No trade qualified: cash reserve.',
      eligibleSymbols: [],
      excluded: [
        { symbol: 'NVDA', rule: 'CASH_RESERVE', text: 'Cash is below the minimum after the reserve.' },
      ],
    }
    await db.insert(wakes).values([
      {
        deskId: desk.id,
        scheduledFor: new Date('2026-10-01T18:00:00Z'),
        trigger: 'watch',
        status: 'completed',
        sourceHealth: { rpc: true, qualification },
        startedAt: new Date('2026-10-01T18:00:00Z'),
      },
      {
        deskId: desk.id,
        scheduledFor: new Date('2026-10-01T17:55:00Z'),
        trigger: 'watch',
        status: 'completed',
        startedAt: new Date('2026-10-01T17:55:00Z'),
      },
      {
        deskId: desk.id,
        scheduledFor: new Date('2026-10-01T17:50:00Z'),
        trigger: 'watch',
        status: 'failed',
        startedAt: new Date('2026-10-01T17:50:00Z'),
      },
    ])
    expect(await completedChecksOf(db, desk.id)).toBe(2)
    expect(await deskRecord(db, desk.id)).toEqual([])
    expect(readQualification((await lastCheckOf(db, desk.id))?.sourceHealth)).toEqual(qualification)
    expect(readQualification({ rpc: true })).toBeNull()
    expect(readQualification({ qualification: { summary: 'invalid' } })).toBeNull()
  })

  it('keeps older hours and the latest value when five-minute snapshots exceed the point limit', async () => {
    const desk = await makeDesk(db)
    const start = Date.parse('2026-09-28T00:00:00Z')
    await db.insert(deskValueSnapshots).values(
      Array.from({ length: 73 * 12 }, (_, i) => ({
        deskId: desk.id,
        kind: 'hourly' as const,
        takenAt: new Date(start + i * 5 * 60000),
        totalUsdg: BigInt(1000000 + i),
        cashUsdg: 400000n,
        vaultUsdg: 0n,
        vaultShares: 0n,
        holdings: [],
        priceSource: 'pool_twap_30m',
        flowsUsdg: 10000n,
      })),
    )
    const history = await valueHistory(db, desk.id, 80)
    expect(history).toHaveLength(73)
    expect(history[0]?.takenAt.toISOString()).toBe('2026-09-28T00:55:00.000Z')
    expect(history.at(-1)?.takenAt.toISOString()).toBe('2026-10-01T00:55:00.000Z')
    expect(history.at(-1)?.totalUsdg).toBe(1000875n)
    expect(history.every((h) => h.flowsUsdg === 10000n)).toBe(true)
  })
})
