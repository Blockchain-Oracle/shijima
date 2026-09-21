/** Small administrative helpers, kept here so nothing outside this package needs to import pg or drizzle. */
import { sql } from 'drizzle-orm'
import { createDb, type Db, databaseName } from './client'
import { migrateDb } from './migrate'

/** False on a database that has not been migrated yet. Commands check this to give a useful hint. */
export async function hasSchema(db: Db): Promise<boolean> {
  const result = await db.execute<{ found: string | null }>(
    sql`select to_regclass('public.decisions')::text as found`,
  )
  return Boolean(result.rows[0]?.found)
}

/**
 * Drops, recreates and migrates a THROWAWAY database. It refuses any name without the given suffix, so it can
 * never be pointed at the database that holds the real record of real trades.
 */
export async function recreateDatabase(
  url: string,
  requiredSuffix: '_rehearsal' | '_test',
  options: { migrate?: boolean } = {},
): Promise<void> {
  const name = databaseName(url)
  if (!name.endsWith(requiredSuffix) || !/^[a-z0-9_]+$/.test(name)) {
    throw new Error(
      `Refusing to recreate "${name}". Only a database ending in ${requiredSuffix} may be dropped.`,
    )
  }
  const maintenance = new URL(url)
  maintenance.pathname = '/postgres'
  const admin = createDb(maintenance.toString(), { max: 1 })
  try {
    // The name was checked against a strict pattern above, so it is safe to place in the statement.
    await admin.db.execute(sql.raw(`drop database if exists "${name}" with (force)`))
    await admin.db.execute(sql.raw(`create database "${name}"`))
  } finally {
    await admin.close()
  }
  // A database about to be filled from a copy of another must stay empty: the copy brings its own tables.
  if (options.migrate !== false) await migrateDb(url)
}
