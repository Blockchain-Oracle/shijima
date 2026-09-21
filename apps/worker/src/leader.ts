/**
 * Only one worker may run the clock and hold the operator key at a time. Two would mean two senders on one
 * nonce. A deploy that overlaps the old and new process would otherwise cause exactly that.
 *
 * The lock is a Postgres SESSION advisory lock, held on one dedicated connection for the life of the process.
 * If the process dies, Postgres drops the connection and the lock with it, so a crash never leaves it stuck.
 */
import type { Pool, PoolClient } from 'pg'

/** Any fixed number. Every worker of this product asks for the same one. */
const LEADER_LOCK_KEY = 4663_001

export async function tryBecomeLeader(pool: Pool): Promise<{ release: () => Promise<void> } | undefined> {
  const client: PoolClient = await pool.connect()
  const { rows } = await client.query<{ locked: boolean }>('select pg_try_advisory_lock($1) as locked', [
    LEADER_LOCK_KEY,
  ])
  if (!rows[0]?.locked) {
    client.release()
    return undefined
  }
  return {
    release: async () => {
      await client.query('select pg_advisory_unlock($1)', [LEADER_LOCK_KEY]).catch(() => undefined)
      client.release()
    },
  }
}
