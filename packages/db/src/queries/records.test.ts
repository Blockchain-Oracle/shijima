import { hashRecord, ZERO_HASH } from '@desk/shared'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { decisions } from '../schema'
import { draftFor, makeDesk, openTestDb, TEST_DATABASE_URL } from '../testing/context'
import { appendRecord, RecordChainError, recordChain, verifyChain } from './records'

describe.skipIf(!TEST_DATABASE_URL)('the record chain', () => {
  const { db, close } = openTestDb()
  afterAll(close)

  it('starts at seq 1 from the zero hash, and links each record to the one before', async () => {
    const desk = await makeDesk(db)
    const first = await appendRecord(db, desk.id, (slot) => draftFor(desk, slot))
    const second = await appendRecord(db, desk.id, (slot) => draftFor(desk, slot))

    expect(first.decision.seq).toBe(1)
    expect(first.decision.prevHash).toBe(ZERO_HASH)
    expect(second.decision.seq).toBe(2)
    expect(second.decision.prevHash).toBe(first.recordHash)
    // The link is inside the hashed body, so the second fingerprint commits to the first record too.
    expect(second.decision.record.prevHash).toBe(first.recordHash)
    expect(second.recordHash).toBe(hashRecord(second.decision.record))
  })

  it('refuses a body that names the wrong seq or the wrong previous hash, and stores nothing', async () => {
    const desk = await makeDesk(db)
    await appendRecord(db, desk.id, (slot) => draftFor(desk, slot))
    await expect(
      appendRecord(db, desk.id, (slot) => draftFor(desk, slot, {}, { seq: slot.seq + 1 })),
    ).rejects.toThrow(RecordChainError)
    await expect(
      appendRecord(db, desk.id, (slot) => draftFor(desk, slot, {}, { prevHash: ZERO_HASH })),
    ).rejects.toThrow(RecordChainError)
    expect(await recordChain(db, desk.id)).toHaveLength(1)
  })

  it('refuses a float anywhere in the body, and stores nothing', async () => {
    const desk = await makeDesk(db)
    await expect(
      appendRecord(db, desk.id, (slot) => draftFor(desk, slot, {}, { evidence: [{ gap: 0.1 + 0.2 }] })),
    ).rejects.toThrow(/not a safe integer/)
    expect(await recordChain(db, desk.id)).toHaveLength(0)
  })

  it('gives back a body that still hashes the same after a trip through jsonb', async () => {
    const desk = await makeDesk(db)
    const awkward = {
      // jsonb reorders keys, drops whitespace and re-encodes text. None of that may change the fingerprint.
      zebra: 1,
      alpha: { z: [3, 2, 1], a: null, m: { deep: [true, false, null] } },
      unicode: 'Nvidia 正夢 🚀 café — "quoted" \\ back/slash',
      escapes: 'line\nbreak\ttab\r  ',
      numbers: [0, -1, 9007199254740991, -9007199254740991],
      amounts: ['0.004528840493392346', '115792089237316195423570985008687907853269984665640564039457'],
      empty: { object: {}, array: [], string: '' },
      'key with spaces': 'ok',
      '10': 'numeric-looking keys sort as text',
      '9': 'so nine comes after ten',
    }
    const { decision, recordHash } = await appendRecord(db, desk.id, (slot) =>
      draftFor(desk, slot, {}, awkward),
    )
    const [fresh] = await db.select().from(decisions).where(eq(decisions.id, decision.id))
    expect(hashRecord(fresh?.record)).toBe(recordHash)
    expect(verifyChain(await recordChain(db, desk.id))).toEqual([])
  })

  it('stays gap free and linked when twenty writers hit one desk at once', async () => {
    const desk = await makeDesk(db)
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        appendRecord(db, desk.id, (slot) => draftFor(desk, slot, {}, { writer: i })),
      ),
    )
    const chain = await recordChain(db, desk.id)
    expect(chain.map((r) => r.seq)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    expect(verifyChain(chain)).toEqual([])
  })

  it('keeps separate desks independent', async () => {
    const [a, b] = await Promise.all([makeDesk(db), makeDesk(db)])
    await appendRecord(db, a.id, (slot) => draftFor(a, slot))
    await appendRecord(db, a.id, (slot) => draftFor(a, slot))
    const first = await appendRecord(db, b.id, (slot) => draftFor(b, slot))
    expect(first.decision.seq).toBe(1)
    expect(first.decision.prevHash).toBe(ZERO_HASH)
  })

  it('refuses a body that names another desk or another chain, so a fingerprint belongs to one desk only', async () => {
    const [mine, other] = await Promise.all([makeDesk(db), makeDesk(db)])
    await expect(appendRecord(db, mine.id, (slot) => draftFor(other, slot))).rejects.toThrow(RecordChainError)
    await expect(
      appendRecord(db, mine.id, (slot) => draftFor(mine, slot, {}, { chainId: 1 })),
    ).rejects.toThrow(RecordChainError)
    // A checksummed (mixed case) address in the body is the same desk, and is accepted.
    const upper = `0x${mine.address.slice(2).toUpperCase()}`
    const ok = await appendRecord(db, mine.id, (slot) => draftFor(mine, slot, {}, { desk: upper }))
    expect(ok.decision.record.desk).toBe(upper)
    expect(await recordChain(db, other.id)).toHaveLength(0)
  })

  it('notices a record that was edited behind its back', async () => {
    const desk = await makeDesk(db)
    await appendRecord(db, desk.id, (slot) => draftFor(desk, slot, {}, { usdgIn: '1' }))
    const second = await appendRecord(db, desk.id, (slot) => draftFor(desk, slot, {}, { usdgIn: '1' }))
    await appendRecord(db, desk.id, (slot) => draftFor(desk, slot))

    await db
      .update(decisions)
      .set({ record: { ...second.decision.record, usdgIn: '100' } })
      .where(eq(decisions.id, second.decision.id))

    expect(verifyChain(await recordChain(db, desk.id))).toEqual([
      { seq: 2, problem: 'the body no longer hashes to record_hash' },
    ])
  })

  it('imports a legacy body with no prevHash only when asked to, and only at schema version 0', async () => {
    const desk = await makeDesk(db)
    const legacy = (seq: number) => ({
      schemaVersion: 0,
      kind: 'decision',
      chainId: desk.chainId,
      desk: desk.address,
      seq,
      prevHead: ZERO_HASH,
    })

    await expect(
      appendRecord(db, desk.id, (slot) => ({ ...draftFor(desk, slot), record: legacy(slot.seq) })),
    ).rejects.toThrow(RecordChainError)

    const imported = await appendRecord(
      db,
      desk.id,
      (slot) => ({ ...draftFor(desk, slot), record: legacy(slot.seq) }),
      { legacyBodyWithoutPrevHash: true },
    )
    expect(imported.decision.seq).toBe(1)
    // A modern record then links to the imported one, and the whole chain verifies.
    await appendRecord(db, desk.id, (slot) => draftFor(desk, slot))
    expect(verifyChain(await recordChain(db, desk.id))).toEqual([])

    await expect(
      appendRecord(
        db,
        desk.id,
        (slot) => ({
          ...draftFor(desk, slot),
          schemaVersion: 1,
          record: { ...legacy(slot.seq), schemaVersion: 1 },
        }),
        { legacyBodyWithoutPrevHash: true },
      ),
    ).rejects.toThrow(RecordChainError)
  })
})
