import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { actions, decisions, desks } from '../schema'
import { draftFor, makeDesk, OPERATOR, openTestDb, randomHash, TEST_DATABASE_URL } from '../testing/context'
import {
  ActionStateError,
  markActionPrepared,
  markActionSent,
  resolveAction,
  unresolvedActions,
} from './actions'
import { appendRecord, recordChain } from './records'
import { finishWake, startWake } from './wakes'

const signed = (nonce = 7) => ({
  txHash: randomHash(),
  nonce,
  calldataHash: randomHash(),
  deadlineUnix: 1_789_915_184,
})
const confirmed = (chainSeq: number) => ({
  status: 'confirmed' as const,
  chainSeq,
  blockNumber: 68_015_649,
  gasUsed: 270_406n,
  effectiveGasPrice: 10_000_000n,
  actualOut: 4_528_828_406_169_925n,
})

describe.skipIf(!TEST_DATABASE_URL)('the life of an operator transaction', () => {
  const { db, close } = openTestDb()
  afterAll(close)

  const buy = { kind: 'buy' as const, operator: OPERATOR, amountIn: 1_000_000n }
  const seal = { kind: 'checkpoint' as const, operator: OPERATOR }

  it('walks planned, prepared, sent, confirmed, and seals every record behind it but none after', async () => {
    const desk = await makeDesk(db)
    await appendRecord(db, desk.id, (slot) => draftFor(desk, slot)) // a quiet hour
    await appendRecord(db, desk.id, (slot) => draftFor(desk, slot)) // another
    const acted = await appendRecord(db, desk.id, (slot) =>
      draftFor(desk, slot, { outcome: 'acted', mode: 'on_its_own', actions: [buy] }),
    )
    const later = await appendRecord(db, desk.id, (slot) => draftFor(desk, slot))
    const action = acted.actions[0]
    if (!action) throw new Error('no planned action')
    expect(action.status).toBe('planned')

    const tx = signed()
    expect((await markActionPrepared(db, action.id, tx)).status).toBe('prepared')
    expect((await markActionSent(db, action.id)).status).toBe('sent')
    const done = await resolveAction(db, action.id, confirmed(1))
    expect(done.status).toBe('confirmed')
    expect(done.actualOut).toBe(4_528_828_406_169_925n)

    const chain = await recordChain(db, desk.id)
    expect(chain.slice(0, 3).map((r) => r.sealedByTx)).toEqual([tx.txHash, tx.txHash, tx.txHash])
    expect(chain[3]?.id).toBe(later.decision.id)
    expect(chain[3]?.sealedByTx).toBeNull()
    const [after] = await db.select().from(desks).where(eq(desks.id, desk.id))
    expect(after?.chainSeq).toBe(1)
  })

  it('never reseals a record that an earlier transaction already sealed', async () => {
    const desk = await makeDesk(db)
    const first = await appendRecord(db, desk.id, (slot) => draftFor(desk, slot, { actions: [seal] }))
    const second = await appendRecord(db, desk.id, (slot) => draftFor(desk, slot, { actions: [seal] }))
    const [a, b] = [first.actions[0], second.actions[0]]
    if (!a || !b) throw new Error('no planned action')
    const [txA, txB] = [signed(1), signed(2)]
    await markActionPrepared(db, a.id, txA)
    await resolveAction(db, a.id, confirmed(1))
    await markActionPrepared(db, b.id, txB)
    await resolveAction(db, b.id, confirmed(2))
    expect((await recordChain(db, desk.id)).map((r) => r.sealedByTx)).toEqual([txA.txHash, txB.txHash])
  })

  it('refuses to skip or repeat a step', async () => {
    const desk = await makeDesk(db)
    const { actions: planned } = await appendRecord(db, desk.id, (slot) =>
      draftFor(desk, slot, { actions: [buy] }),
    )
    const action = planned[0]
    if (!action) throw new Error('no planned action')

    await expect(markActionSent(db, action.id)).rejects.toThrow(ActionStateError) // not signed yet
    await markActionPrepared(db, action.id, signed())
    await expect(markActionPrepared(db, action.id, signed())).rejects.toThrow(ActionStateError) // signed twice
    await resolveAction(db, action.id, confirmed(1))
    await expect(resolveAction(db, action.id, confirmed(1))).rejects.toThrow(ActionStateError) // settled twice
  })

  it('resolves a prepared action straight to confirmed, because a crash can hide that it was broadcast', async () => {
    const desk = await makeDesk(db)
    const { actions: planned } = await appendRecord(db, desk.id, (slot) =>
      draftFor(desk, slot, { actions: [buy] }),
    )
    const action = planned[0]
    if (!action) throw new Error('no planned action')
    await markActionPrepared(db, action.id, signed())
    expect((await resolveAction(db, action.id, confirmed(1))).status).toBe('confirmed')
  })

  it('cannot confirm an action that was never signed, and leaves it untouched', async () => {
    const desk = await makeDesk(db)
    const { actions: planned } = await appendRecord(db, desk.id, (slot) =>
      draftFor(desk, slot, { actions: [buy] }),
    )
    const action = planned[0]
    if (!action) throw new Error('no planned action')
    await expect(resolveAction(db, action.id, confirmed(1))).rejects.toThrow()
    const [still] = await db.select().from(actions).where(eq(actions.id, action.id))
    expect(still?.status).toBe('planned')
    // It CAN be settled as never landed: nothing was signed, so nothing could have been broadcast.
    const settled = await resolveAction(db, action.id, {
      status: 'never_landed',
      failureCode: 'never_signed',
    })
    expect(settled.status).toBe('never_landed')
  })

  it('marks the decision failed when a trade leg fails, with the named cause', async () => {
    const desk = await makeDesk(db)
    const acted = await appendRecord(db, desk.id, (slot) =>
      draftFor(desk, slot, { outcome: 'acted', actions: [buy] }),
    )
    const action = acted.actions[0]
    if (!action) throw new Error('no planned action')
    await markActionPrepared(db, action.id, signed())
    await markActionSent(db, action.id)
    await resolveAction(db, action.id, {
      status: 'reverted',
      blockNumber: 1,
      gasUsed: 50_000n,
      effectiveGasPrice: 10_000_000n,
      failureCode: 'BelowOracleFloor',
    })
    const [decision] = await db.select().from(decisions).where(eq(decisions.id, acted.decision.id))
    expect(decision?.outcome).toBe('failed')
    expect(decision?.failureCode).toBe('BelowOracleFloor')
    expect(decision?.sealedByTx).toBeNull()
  })

  it('leaves a "waited" decision standing when only its seal failed to land', async () => {
    const desk = await makeDesk(db)
    const waited = await appendRecord(db, desk.id, (slot) =>
      draftFor(desk, slot, { outcome: 'waited', actions: [seal] }),
    )
    const action = waited.actions[0]
    if (!action) throw new Error('no planned action')
    await markActionPrepared(db, action.id, signed())
    await resolveAction(db, action.id, { status: 'never_landed', failureCode: 'never_landed' })
    const [decision] = await db.select().from(decisions).where(eq(decisions.id, waited.decision.id))
    expect(decision?.outcome).toBe('waited')
    expect(decision?.sealedByTx).toBeNull()
  })

  it('hands the resolver exactly the unsettled actions of a desk, with what it needs to find them on-chain', async () => {
    const desk = await makeDesk(db)
    const make = () => appendRecord(db, desk.id, (slot) => draftFor(desk, slot, { actions: [buy] }))
    const [planned, prepared, sent, settled] = [await make(), await make(), await make(), await make()]
    const id = (r: Awaited<ReturnType<typeof make>>) => r.actions[0]?.id ?? ''
    await markActionPrepared(db, id(prepared), signed(1))
    await markActionPrepared(db, id(sent), signed(2))
    await markActionSent(db, id(sent))
    await markActionPrepared(db, id(settled), signed(3))
    await resolveAction(db, id(settled), confirmed(1))

    const mine = (await unresolvedActions(db)).filter((u) => u.deskAddress === desk.address)
    expect(mine.map((u) => u.action.status)).toEqual(['planned', 'prepared', 'sent'])
    expect(mine.map((u) => u.recordHash)).toEqual([planned, prepared, sent].map((r) => r.recordHash))
    expect(mine.map((u) => u.recordSeq)).toEqual([1, 2, 3])
  })

  it('makes a double fire of the same hour harmless', async () => {
    const desk = await makeDesk(db)
    const hour = new Date('2026-09-26T14:00:00Z')
    const fromCron = await startWake(db, { deskId: desk.id, scheduledFor: hour, trigger: 'cron' })
    const fromTick = await startWake(db, { deskId: desk.id, scheduledFor: hour, trigger: 'tick' })
    expect(fromCron?.status).toBe('running')
    expect(fromTick).toBeUndefined()
    if (fromCron) await finishWake(db, fromCron.id, { status: 'completed', sourceHealth: { rpc: 'ok' } })
  })
})
