/** Shared by the database tests. Each test makes its own owner and desk, so tests never see each other's rows. */
import { randomBytes } from 'node:crypto'
import { inject } from 'vitest'
import { createDb, type Db, type DbHandle } from '../client'
import { type DeskRow, registerDesk } from '../queries/desks'
import type { RecordDraft, RecordSlot } from '../queries/records'

/** null when no test database is configured. Test files skip themselves, and global setup says so loudly. */
export const TEST_DATABASE_URL = inject('testDatabaseUrl')

export function openTestDb(): DbHandle {
  if (!TEST_DATABASE_URL) throw new Error('no test database configured')
  return createDb(TEST_DATABASE_URL, { max: 8 })
}

export const randomAddress = () => `0x${randomBytes(20).toString('hex')}`
export const randomHash = () => `0x${randomBytes(32).toString('hex')}`
export const OPERATOR = `0x${'ab'.repeat(20)}`

export function makeDesk(db: Db): Promise<DeskRow> {
  return registerDesk(db, {
    ownerAddress: randomAddress(),
    deskAddress: randomAddress(),
    factory: randomAddress(),
    salt: randomHash(),
    contractVersion: 'test',
    operator: OPERATOR,
  })
}

/** A minimal valid draft for the given desk and slot. `body` adds fields to the hashed record. */
export function draftFor(
  desk: DeskRow,
  slot: RecordSlot,
  overrides: Partial<RecordDraft> = {},
  body: Record<string, unknown> = {},
): RecordDraft {
  return {
    record: {
      schemaVersion: 0,
      kind: 'decision',
      chainId: desk.chainId,
      desk: desk.address,
      seq: slot.seq,
      prevHash: slot.prevHash,
      ...body,
    },
    schemaVersion: 0,
    outcome: 'nothing_to_do',
    mode: 'shadow',
    summary: 'test record',
    decidedAt: new Date(),
    ...overrides,
  }
}
