/**
 * One way to open the database, used by the worker, the web app, scripts and tests.
 * node-postgres in both apps, so approvals can be a guarded update inside a real transaction.
 */

import { errorText } from '@desk/shared'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

export type Db = NodePgDatabase<typeof schema>
/** The handle passed to a `db.transaction` callback. Queries accept either, so they compose into transactions. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type DbOrTx = Db | Tx

export interface DbHandle {
  db: Db
  pool: Pool
  close: () => Promise<void>
}

export interface CreateDbOptions {
  /** Worker: 5 on the direct URL. Web on Vercel: 2 on the pooled URL. */
  max?: number
  onIdleError?: (error: Error) => void
}

export function createDb(url: string, options: CreateDbOptions = {}): DbHandle {
  const pool = new Pool({ connectionString: url, max: options.max ?? 5, idleTimeoutMillis: 5_000 })
  // An idle connection dropped by the network emits 'error' on the pool. With no listener Node treats that as
  // an uncaught exception and the whole worker dies. The pool replaces the connection on its own.
  pool.on(
    'error',
    options.onIdleError ?? ((e) => console.error(`[db] idle connection dropped: ${errorText(e)}`)),
  )
  return { db: drizzle(pool, { schema }), pool, close: () => pool.end() }
}

/** The database name in a connection URL. Used by guards that must never run against the wrong database. */
export function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''))
}
