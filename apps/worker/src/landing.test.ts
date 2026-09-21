import { describe, expect, it } from 'vitest'
import { judgeMissingReceipt, type MissingReceipt, NO_DEADLINE_GRACE_S, NODE_LAG_MARGIN_S } from './landing'

const now = new Date('2026-09-26T14:00:00Z')
const nowUnix = Math.floor(now.getTime() / 1000)
const secondsAgo = (s: number) => new Date(now.getTime() - s * 1000)

/** A buy signed 10 seconds ago with two minutes on its deadline, nonce 7 still unused. */
const fresh: MissingReceipt = {
  status: 'sent',
  deadlineUnix: nowUnix + 110,
  nonce: 7,
  preparedAt: secondsAgo(10),
  chainTimeUnix: nowUnix,
  minedNonce: 7,
  now,
}

describe('a transaction with no receipt', () => {
  it('is dead at once if it was never signed', () => {
    expect(judgeMissingReceipt({ ...fresh, status: 'planned', nonce: null, preparedAt: null })).toMatchObject(
      {
        verdict: 'never_landed',
        code: 'never_signed',
      },
    )
  })

  it('waits while its deadline is still ahead', () => {
    expect(judgeMissingReceipt(fresh).verdict).toBe('wait')
  })

  it('still waits just after the deadline, because a lagging node may not have shown the receipt yet', () => {
    const m = { ...fresh, deadlineUnix: nowUnix - 1 }
    expect(judgeMissingReceipt(m).verdict).toBe('wait')
    expect(judgeMissingReceipt({ ...m, deadlineUnix: nowUnix - NODE_LAG_MARGIN_S }).verdict).toBe('wait')
  })

  it('is dead once the chain clock is past the deadline plus the margin', () => {
    const m = { ...fresh, deadlineUnix: nowUnix - NODE_LAG_MARGIN_S - 1 }
    expect(judgeMissingReceipt(m)).toMatchObject({ verdict: 'never_landed', code: 'deadline_passed' })
  })

  it('judges the deadline by the CHAIN clock, never the laptop clock', () => {
    // The laptop says an hour has passed, but the chain has not moved: a stalled chain can still include it.
    const m = { ...fresh, now: new Date(now.getTime() + 3_600_000), chainTimeUnix: nowUnix }
    expect(judgeMissingReceipt(m).verdict).toBe('wait')
  })

  it('is dead if its nonce was mined by another transaction, but only after the margin', () => {
    expect(judgeMissingReceipt({ ...fresh, minedNonce: 8 }).verdict).toBe('wait') // 10 s old: too soon to say
    expect(judgeMissingReceipt({ ...fresh, minedNonce: 8, preparedAt: secondsAgo(61) })).toMatchObject({
      verdict: 'never_landed',
      code: 'nonce_used_elsewhere',
    })
  })

  it('gives a call with no deadline, such as a checkpoint, five minutes and then lets its nonce be reused', () => {
    const seal = { ...fresh, deadlineUnix: null }
    expect(judgeMissingReceipt({ ...seal, preparedAt: secondsAgo(NO_DEADLINE_GRACE_S) }).verdict).toBe('wait')
    expect(judgeMissingReceipt({ ...seal, preparedAt: secondsAgo(NO_DEADLINE_GRACE_S + 1) })).toMatchObject({
      verdict: 'never_landed',
      code: 'not_seen',
    })
  })

  it('never uses the five minute rule on a call that has a deadline', () => {
    const m = { ...fresh, deadlineUnix: nowUnix + 3600, preparedAt: secondsAgo(NO_DEADLINE_GRACE_S + 60) }
    expect(judgeMissingReceipt(m).verdict).toBe('wait')
  })

  it('waits for a person when a signed action has lost its nonce or time', () => {
    expect(judgeMissingReceipt({ ...fresh, nonce: null }).verdict).toBe('wait')
    expect(judgeMissingReceipt({ ...fresh, preparedAt: null }).verdict).toBe('wait')
  })
})
