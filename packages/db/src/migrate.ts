import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createDb } from './client'

export const MIGRATIONS_FOLDER = resolve(import.meta.dirname, '../drizzle')

/** Applies every migration that has not run yet. Safe to call on every boot. */
export async function migrateDb(url: string): Promise<void> {
  const handle = createDb(url, { max: 1 })
  try {
    await migrate(handle.db, { migrationsFolder: MIGRATIONS_FOLDER })
  } finally {
    await handle.close()
  }
}
