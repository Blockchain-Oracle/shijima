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

/**
 * Takes the lock, or explains who has it. Any command that can SEND must hold this, not just the worker: a
 * command run by hand while the worker is up would be a second sender on one key, and both could act on the
 * same need.
 */
export async function requireLeader(pool: Pool, what: string) {
  const lock = await tryBecomeLeader(pool)
  if (!lock) {
    throw new Error(
      `The worker is running and holds the operator key, so ${what} would be a second sender on one key. ` +
        'Stop the worker first, or let it do this on its next check.',
    )
  }
  return lock
}

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
